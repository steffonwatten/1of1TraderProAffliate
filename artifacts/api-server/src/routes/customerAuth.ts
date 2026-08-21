import { Router, type IRouter } from "express";
import {
  db,
  customerAccountsTable,
  customerSessionsTable,
  whopCustomersTable,
  whopMembershipsTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import {
  hashCustomerPassword,
  verifyCustomerPassword,
  generateCustomerToken,
  storeCustomerToken,
  removeCustomerToken,
  issueEmailCode,
  consumeEmailCode,
  customerToProfile,
  requireCustomer,
  getReqCustomer,
} from "../lib/customerAuth";
import { sendCustomerCode } from "../lib/emailCustomer";

// Auth for indicator customers. Mounted at /api/customer/auth.
//
// There is no open sign-up. A customer_accounts row can only be claimed by
// somebody whose email already exists in whop_customers — i.e. somebody who has
// actually bought the indicator. Registration is therefore "claim the account
// your purchase created", not "create an account".
const router: IRouter = Router();

// Every lookup-by-email endpoint answers identically whether or not the address
// belongs to a customer. Anything else turns this into an oracle for "is this
// person a paying customer of 1OF1?", which is exactly the customer list we are
// otherwise careful never to expose.
const GENERIC_EMAIL_RESPONSE = {
  ok: true,
  message: "If that email matches a purchase, we've sent a 6-digit code to it.",
};

function normaliseEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const e = email.trim().toLowerCase();
  return e.length > 3 && e.includes("@") ? e : null;
}

function passwordProblem(password: unknown): string | null {
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (password.length > 200) return "Password is too long.";
  return null;
}

/**
 * POST /customer/auth/register — claim the account a purchase created.
 * Always 200. See GENERIC_EMAIL_RESPONSE.
 */
router.post("/auth/register", async (req, res) => {
  try {
    const email = normaliseEmail(req.body?.email);
    if (!email) {
      res.status(400).json({ error: "Bad Request", message: "A valid email is required." });
      return;
    }

    const [purchaser] = await db
      .select()
      .from(whopCustomersTable)
      .where(sql`lower(${whopCustomersTable.email}) = ${email}`)
      .limit(1);

    if (!purchaser) {
      req.log.info({ email }, "Customer registration attempted with no matching purchase");
      res.json(GENERIC_EMAIL_RESPONSE);
      return;
    }

    let [account] = await db
      .select()
      .from(customerAccountsTable)
      .where(eq(customerAccountsTable.whopUserId, purchaser.whopUserId))
      .limit(1);

    if (!account) {
      [account] = await db
        .insert(customerAccountsTable)
        .values({
          whopUserId: purchaser.whopUserId,
          email,
          fullName: purchaser.fullName,
          status: "pending_email",
        })
        .returning();
    } else if (account.status === "suspended") {
      // Do not hand a suspended account a fresh verification path.
      req.log.warn({ accountId: account.id }, "Suspended customer attempted to re-register");
      res.json(GENERIC_EMAIL_RESPONSE);
      return;
    }

    const code = await issueEmailCode(account.id, "verify_email");
    await sendCustomerCode(email, account.fullName ?? "there", code, "verify_email");
    res.json(GENERIC_EMAIL_RESPONSE);
  } catch (err) {
    req.log.error({ err }, "Customer registration failed");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/** POST /customer/auth/verify — exchange the code for a password and a session. */
router.post("/auth/verify", async (req, res) => {
  try {
    const email = normaliseEmail(req.body?.email);
    const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
    const pwProblem = passwordProblem(req.body?.password);
    if (!email || !code) {
      res.status(400).json({ error: "Bad Request", message: "Email and code are required." });
      return;
    }
    if (pwProblem) {
      res.status(400).json({ error: "Bad Request", message: pwProblem });
      return;
    }

    const [account] = await db
      .select()
      .from(customerAccountsTable)
      .where(eq(customerAccountsTable.email, email))
      .limit(1);

    // Same message for "no such account" and "wrong code" — a distinct error
    // here would undo the enumeration protection on /register.
    if (!account || account.status === "suspended") {
      res.status(400).json({ error: "Bad Request", message: "That code is not valid." });
      return;
    }

    const ok = await consumeEmailCode(account.id, "verify_email", code);
    if (!ok) {
      res.status(400).json({ error: "Bad Request", message: "That code is not valid." });
      return;
    }

    const passwordHash = await hashCustomerPassword(req.body.password);
    const now = new Date();
    // Return the UPDATED row rather than patching the stale one by hand —
    // spreading `{ ...account, status: "active" }` reported emailVerifiedAt as
    // null in the very response that had just set it.
    const [updated] = await db
      .update(customerAccountsTable)
      .set({ passwordHash, status: "active", emailVerifiedAt: now, lastLoginAt: now, updatedAt: now })
      .where(eq(customerAccountsTable.id, account.id))
      .returning();

    const token = generateCustomerToken();
    await storeCustomerToken(token, account.id);
    res.json({ token, customer: customerToProfile(updated) });
  } catch (err) {
    req.log.error({ err }, "Customer verification failed");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/** POST /customer/auth/login */
router.post("/auth/login", async (req, res) => {
  try {
    const email = normaliseEmail(req.body?.email);
    const password = req.body?.password;
    if (!email || typeof password !== "string") {
      res.status(400).json({ error: "Bad Request", message: "Email and password are required." });
      return;
    }

    const [account] = await db
      .select()
      .from(customerAccountsTable)
      .where(eq(customerAccountsTable.email, email))
      .limit(1);

    // One message for every failure mode below: unknown email, unclaimed
    // account, suspended account, wrong password.
    const reject = () =>
      res.status(401).json({ error: "Unauthorized", message: "Email or password is incorrect." });

    if (!account || !account.passwordHash || account.status !== "active") {
      // Still spend the bcrypt time so a missing account is not measurably
      // faster to reject than a wrong password.
      await verifyCustomerPassword(password, "$2a$12$" + "x".repeat(53));
      reject();
      return;
    }

    if (!(await verifyCustomerPassword(password, account.passwordHash))) {
      reject();
      return;
    }

    const token = generateCustomerToken();
    await storeCustomerToken(token, account.id);
    await db
      .update(customerAccountsTable)
      .set({ lastLoginAt: new Date() })
      .where(eq(customerAccountsTable.id, account.id));

    res.json({ token, customer: customerToProfile(account) });
  } catch (err) {
    req.log.error({ err }, "Customer login failed");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/** POST /customer/auth/logout */
router.post("/auth/logout", requireCustomer, async (req, res) => {
  try {
    const token = req.headers.authorization!.slice(7);
    await removeCustomerToken(token);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Customer logout failed");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/** GET /customer/auth/me — profile plus current membership state. */
router.get("/auth/me", requireCustomer, async (req, res) => {
  try {
    const customer = getReqCustomer(req);
    const memberships = await db
      .select({
        status: whopMembershipsTable.status,
        renewalDate: whopMembershipsTable.renewalDate,
        startDate: whopMembershipsTable.startDate,
      })
      .from(whopMembershipsTable)
      .where(eq(whopMembershipsTable.whopUserId, customer.whopUserId));

    res.json({
      customer: customerToProfile(customer),
      // Subscription state is read from Whop's records, never stored on the
      // account, so cancelling in Whop is reflected here without a sync step.
      memberships,
      hasActiveMembership: memberships.some((m) => m.status === "active" || m.status === "trialing"),
    });
  } catch (err) {
    req.log.error({ err }, "Customer profile fetch failed");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/** POST /customer/auth/forgot-password — always 200. */
router.post("/auth/forgot-password", async (req, res) => {
  try {
    const email = normaliseEmail(req.body?.email);
    if (!email) {
      res.status(400).json({ error: "Bad Request", message: "A valid email is required." });
      return;
    }
    const [account] = await db
      .select()
      .from(customerAccountsTable)
      .where(and(eq(customerAccountsTable.email, email), eq(customerAccountsTable.status, "active")))
      .limit(1);

    if (account) {
      const code = await issueEmailCode(account.id, "password_reset");
      await sendCustomerCode(email, account.fullName ?? "there", code, "password_reset");
    }
    res.json(GENERIC_EMAIL_RESPONSE);
  } catch (err) {
    req.log.error({ err }, "Customer password reset request failed");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/** POST /customer/auth/reset-password */
router.post("/auth/reset-password", async (req, res) => {
  try {
    const email = normaliseEmail(req.body?.email);
    const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
    const pwProblem = passwordProblem(req.body?.password);
    if (!email || !code) {
      res.status(400).json({ error: "Bad Request", message: "Email and code are required." });
      return;
    }
    if (pwProblem) {
      res.status(400).json({ error: "Bad Request", message: pwProblem });
      return;
    }

    const [account] = await db
      .select()
      .from(customerAccountsTable)
      .where(eq(customerAccountsTable.email, email))
      .limit(1);

    if (!account || !(await consumeEmailCode(account.id, "password_reset", code))) {
      res.status(400).json({ error: "Bad Request", message: "That code is not valid." });
      return;
    }

    const passwordHash = await hashCustomerPassword(req.body.password);
    await db
      .update(customerAccountsTable)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(customerAccountsTable.id, account.id));

    // Every existing session dies with the password. A reset is what somebody
    // does when they think an account is compromised; leaving old tokens alive
    // would make it useless for that.
    await db
      .delete(customerSessionsTable)
      .where(eq(customerSessionsTable.customerAccountId, account.id));
    res.json({ ok: true, message: "Password updated. Please sign in." });
  } catch (err) {
    req.log.error({ err }, "Customer password reset failed");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
