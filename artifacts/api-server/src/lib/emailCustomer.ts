import { getUncachableResendClient } from "./email";
import { db, emailLogsTable } from "@workspace/db";

// Email for indicator CUSTOMERS. Separate from email.ts (affiliates) and
// emailBroker.ts (trading clients), matching the one-module-per-population rule
// in CLAUDE.md.
//
// 🔴 These sends THROW on failure, deliberately, unlike the affiliate sends
// which swallow and log. A verification code that silently fails to send leaves
// the customer stuck on a form waiting for an email that is never coming, with
// nothing on screen to explain it. The caller needs to know.
//
// ⚠️ The Resend SDK does NOT throw on API errors — it returns { error }. That
// is the trap this module exists to close; check result.error, never assume a
// resolved promise means delivered.

const BRAND_NAME = "1OF1 Trader Pro";

type CodePurpose = "verify_email" | "password_reset";

function wrapper(body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#060a12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#060a12;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="text-align:center;padding-bottom:32px;">
          <div style="display:inline-block;width:56px;height:56px;background:#2F8BFF;border-radius:14px;line-height:56px;font-size:24px;font-weight:900;color:#ffffff;">1</div>
          <p style="margin:12px 0 0;color:#2F8BFF;font-weight:700;font-size:18px;letter-spacing:0.05em;">${BRAND_NAME}</p>
        </td></tr>
        <tr><td style="background:#0d1420;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:40px;">
          ${body}
        </td></tr>
        <tr><td style="padding-top:24px;text-align:center;">
          <p style="color:#4b5563;font-size:13px;margin:0;">&copy; ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function recordEmail(
  recipient: string,
  subject: string,
  emailType: string,
  status: string,
  errorMessage: string | null
) {
  try {
    await db.insert(emailLogsTable).values({ recipient, subject, emailType, status, errorMessage });
  } catch (err) {
    // Never let the audit write break the send path it is auditing.
    console.error("emailLogs insert failed:", err);
  }
}

export async function sendCustomerCode(
  to: string,
  fullName: string,
  code: string,
  purpose: CodePurpose
): Promise<void> {
  const isReset = purpose === "password_reset";
  const subject = isReset
    ? `Your ${BRAND_NAME} password reset code`
    : `Your ${BRAND_NAME} verification code`;
  const emailType = isReset ? "customer_password_reset" : "customer_verify_email";

  const body = `
    <h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 8px;">${
      isReset ? "Reset your password" : "Verify your email"
    }</h1>
    <p style="color:#9ca3af;font-size:16px;margin:0 0 24px;">Hi ${fullName},</p>
    <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 24px;">
      ${
        isReset
          ? "Use this code to set a new password. It expires in 15 minutes."
          : "Use this code to finish setting up your 1OF1 Trader Pro account. It expires in 15 minutes."
      }
    </p>
    <div style="text-align:center;margin:0 0 24px;">
      <span style="display:inline-block;background:#0b1220;border:1px solid rgba(47,139,255,0.35);border-radius:12px;padding:18px 28px;color:#fff;font-size:32px;font-weight:800;letter-spacing:8px;">${code}</span>
    </div>
    <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0;">
      If you didn't request this, you can ignore this email — nothing has changed on your account.
    </p>`;

  try {
    // Returns { client, fromEmail } — the helper owns the sender address, so
    // this module must not second-guess it with its own env read.
    const { client, fromEmail } = await getUncachableResendClient();
    const result = await client.emails.send({
      from: `${BRAND_NAME} <${fromEmail}>`,
      to,
      subject,
      html: wrapper(body),
    });

    // The SDK resolves with { error } rather than rejecting. Without this
    // check a failed send looks exactly like a successful one.
    if (result.error) {
      const message = result.error.message ?? JSON.stringify(result.error);
      await recordEmail(to, subject, emailType, "failed", message);
      throw new Error(`Failed to send customer ${purpose} email: ${message}`);
    }

    await recordEmail(to, subject, emailType, "sent", null);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.startsWith("Failed to send customer")) {
      await recordEmail(to, subject, emailType, "failed", message);
    }

    // In development a missing Resend key must not block the signup flow — log
    // the code to the server output so the flow is testable, then swallow. In
    // production this rethrows, because a customer who never receives the code
    // is stuck with no way forward.
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[dev] Could not email ${purpose} code to ${to} (${message}).\n` +
          `[dev] The code is: ${code}`
      );
      return;
    }
    throw err instanceof Error ? err : new Error(message);
  }
}
