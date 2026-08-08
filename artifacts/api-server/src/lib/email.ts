import { Resend } from "resend";
import { db, emailLogsTable } from "@workspace/db";

let connectionSettings: any;

async function getCredentials() {
  // Env-first so the app runs outside Replit (any host with a RESEND_API_KEY
  // secret). The Replit connector below remains the source inside Replit.
  if (process.env.RESEND_API_KEY) {
    return {
      apiKey: process.env.RESEND_API_KEY,
      fromEmail: process.env.RESEND_FROM_EMAIL ?? "noreply@1of1traderpro.com",
    };
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? "depl " + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error("X-Replit-Token not found for repl/depl");
  }

  connectionSettings = await fetch(
    "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=resend",
    {
      headers: {
        Accept: "application/json",
        "X-Replit-Token": xReplitToken,
      },
    }
  )
    .then((res) => res.json())
    .then((data: any) => data.items?.[0]);

  if (!connectionSettings || !connectionSettings.settings.api_key) {
    throw new Error("Resend not connected");
  }

  return {
    apiKey: connectionSettings.settings.api_key as string,
    fromEmail: (connectionSettings.settings.from_email as string) ?? "noreply@1of1traderpro.com",
  };
}

export async function getUncachableResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return { client: new Resend(apiKey), fromEmail };
}

const BRAND_NAME = "1OF1 Trader Pro";
const DASHBOARD_URL = process.env.DASHBOARD_URL ?? "https://1of1traderpro.com/login";

async function recordEmail(
  recipient: string,
  subject: string,
  emailType: string,
  status: "sent" | "failed",
  errorMessage: string | null
): Promise<void> {
  try {
    await db.insert(emailLogsTable).values({ recipient, subject, emailType, status, errorMessage });
  } catch (err) {
    console.error("Failed to write email log:", err);
  }
}

// Central send: composes the from-address, sends via Resend, and records the
// outcome to the email_logs table. The Resend SDK does NOT throw on API errors
// (e.g. an unverified domain returns { error } instead of rejecting), so we must
// inspect result.error explicitly — otherwise failures are invisible.
async function sendAndLog(
  emailType: string,
  options: {
    fromName: string;
    to: string | string[];
    subject: string;
    html: string;
    replyTo?: string;
  }
): Promise<void> {
  const recipient = Array.isArray(options.to) ? options.to.join(", ") : options.to;
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    const payload: Parameters<typeof client.emails.send>[0] = {
      from: `${options.fromName} <${fromEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    };
    if (options.replyTo) payload.replyTo = options.replyTo;

    const result = await client.emails.send(payload);
    if (result.error) {
      console.error(`${emailType} send error:`, result.error);
      await recordEmail(
        recipient,
        options.subject,
        emailType,
        "failed",
        result.error.message ?? JSON.stringify(result.error)
      );
      return;
    }
    await recordEmail(recipient, options.subject, emailType, "sent", null);
  } catch (err) {
    console.error(`${emailType} error:`, err);
    await recordEmail(
      recipient,
      options.subject,
      emailType,
      "failed",
      err instanceof Error ? err.message : String(err)
    );
  }
}

function emailWrapper(body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0b0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0b0f;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="text-align:center;padding-bottom:32px;">
          <div style="display:inline-block;width:56px;height:56px;background:#facc15;border-radius:14px;line-height:56px;font-size:24px;font-weight:900;color:#0a0b0f;">1</div>
          <p style="margin:12px 0 0;color:#facc15;font-weight:700;font-size:18px;letter-spacing:0.05em;">${BRAND_NAME}</p>
        </td></tr>
        <tr><td style="background:#13151f;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:40px;">
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

export async function sendApplicationReceived(to: string, fullName: string): Promise<void> {
  const body = `
    <h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 8px;">Application Received!</h1>
    <p style="color:#9ca3af;font-size:16px;margin:0 0 24px;">Hi ${fullName},</p>
    <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 16px;">
      Thank you for applying to the <strong style="color:#facc15;">${BRAND_NAME}</strong> Affiliate Program. We've received your application and our team will review it shortly.
    </p>
    <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 24px;">
      We typically review applications within 1–3 business days. You'll receive an email once a decision has been made.
    </p>
    <div style="background:#0a0b0f;border:1px solid rgba(250,204,21,0.2);border-radius:10px;padding:20px;margin:0 0 24px;">
      <p style="color:#facc15;font-size:14px;font-weight:600;margin:0 0 8px;">What happens next?</p>
      <ul style="color:#9ca3af;font-size:14px;line-height:1.8;margin:0;padding-left:20px;">
        <li>Our team reviews your application</li>
        <li>You'll receive an approval or feedback email</li>
        <li>Upon approval, you'll get your unique referral link and login credentials</li>
      </ul>
    </div>
    <p style="color:#6b7280;font-size:14px;margin:0;">Questions? Reply to this email or contact us.</p>
  `;
  await sendAndLog("application_received", {
    fromName: BRAND_NAME,
    to,
    subject: `Application Received — ${BRAND_NAME} Affiliate Program`,
    html: emailWrapper(body),
  });
}

export async function sendApplicationApproved(
  to: string,
  fullName: string,
  affiliateCode: string,
  setPasswordUrl: string,
  referralUrl: string
): Promise<void> {
  const body = `
    <h1 style="color:#facc15;font-size:24px;font-weight:700;margin:0 0 8px;">You're Approved! 🎉</h1>
    <p style="color:#9ca3af;font-size:16px;margin:0 0 24px;">Hi ${fullName},</p>
    <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Congratulations! Your application to the <strong style="color:#facc15;">${BRAND_NAME}</strong> Affiliate Program has been <strong style="color:#22c55e;">approved</strong>. Welcome to the team!
    </p>
    <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 24px;">
      To get started, set your password using the button below. Then sign in with your email and the password you choose.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr><td align="center">
        <a href="${setPasswordUrl}" style="display:inline-block;background:#facc15;color:#0a0b0f;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none;">
          Set Your Password →
        </a>
      </td></tr>
    </table>
    <div style="background:#0a0b0f;border:1px solid rgba(250,204,21,0.3);border-radius:12px;padding:24px;margin:0 0 24px;">
      <p style="color:#facc15;font-size:14px;font-weight:700;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.05em;">Your Account Details</p>
      <table cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="color:#6b7280;font-size:13px;padding:6px 0;">Email</td>
          <td style="color:#fff;font-size:13px;font-weight:600;padding:6px 0;">${to}</td>
        </tr>
        <tr>
          <td style="color:#6b7280;font-size:13px;padding:6px 0;">Affiliate Code</td>
          <td style="color:#fff;font-size:13px;font-weight:600;font-family:monospace;padding:6px 0;">${affiliateCode}</td>
        </tr>
      </table>
    </div>
    <div style="background:#0a0b0f;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;margin:0 0 24px;">
      <p style="color:#9ca3af;font-size:13px;font-weight:600;margin:0 0 8px;">YOUR REFERRAL LINK</p>
      <p style="color:#facc15;font-size:14px;font-family:monospace;word-break:break-all;margin:0;">${referralUrl}</p>
    </div>
    <div style="background:#0a0b0f;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;margin:0 0 24px;">
      <p style="color:#9ca3af;font-size:13px;margin:0 0 8px;">Or copy and paste this link into your browser:</p>
      <p style="color:#facc15;font-size:13px;font-family:monospace;word-break:break-all;margin:0;">${setPasswordUrl}</p>
    </div>
    <p style="color:#6b7280;font-size:13px;margin:0;text-align:center;">This password setup link expires in 7 days. Need a new one? Use "Forgot password?" on the sign-in page.</p>
  `;
  await sendAndLog("application_approved", {
    fromName: BRAND_NAME,
    to,
    subject: `You're Approved — ${BRAND_NAME} Affiliate Program`,
    html: emailWrapper(body),
  });
}

export async function sendApplicationDenied(
  to: string,
  fullName: string,
  notes?: string | null
): Promise<void> {
  const body = `
    <h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 8px;">Application Update</h1>
    <p style="color:#9ca3af;font-size:16px;margin:0 0 24px;">Hi ${fullName},</p>
    <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 16px;">
      Thank you for your interest in the <strong style="color:#facc15;">${BRAND_NAME}</strong> Affiliate Program.
    </p>
    <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 24px;">
      After reviewing your application, we're unable to move forward at this time. We appreciate you taking the time to apply.
    </p>
    ${notes ? `<div style="background:#0a0b0f;border-left:3px solid #facc15;border-radius:4px;padding:16px;margin:0 0 24px;">
      <p style="color:#9ca3af;font-size:13px;font-weight:600;margin:0 0 8px;">FEEDBACK</p>
      <p style="color:#d1d5db;font-size:14px;line-height:1.6;margin:0;">${notes}</p>
    </div>` : ""}
    <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 8px;">
      You're welcome to apply again in the future if your circumstances change.
    </p>
    <p style="color:#6b7280;font-size:14px;margin:0;">Thank you for your understanding.</p>
  `;
  await sendAndLog("application_denied", {
    fromName: BRAND_NAME,
    to,
    subject: `Your Application to ${BRAND_NAME} Affiliate Program`,
    html: emailWrapper(body),
  });
}

export async function sendSupportTicketNotification(
  affiliateName: string,
  affiliateEmail: string,
  subject: string,
  category: string | undefined | null,
  message: string,
): Promise<void> {
  const categoryLabel = category ? category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, " ") : "General";
  const body = `
    <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 8px;">New Support Ticket</h1>
    <p style="color:#9ca3af;font-size:15px;margin:0 0 24px;">A partner has submitted a support request.</p>
    <div style="background:#0a0b0f;border:1px solid rgba(250,204,21,0.2);border-radius:10px;padding:20px;margin:0 0 20px;">
      <table cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="color:#6b7280;font-size:13px;padding:5px 0;width:120px;">From</td>
          <td style="color:#fff;font-size:13px;font-weight:600;padding:5px 0;">${affiliateName} &lt;${affiliateEmail}&gt;</td>
        </tr>
        <tr>
          <td style="color:#6b7280;font-size:13px;padding:5px 0;">Category</td>
          <td style="color:#facc15;font-size:13px;font-weight:600;padding:5px 0;">${categoryLabel}</td>
        </tr>
        <tr>
          <td style="color:#6b7280;font-size:13px;padding:5px 0;">Subject</td>
          <td style="color:#fff;font-size:13px;font-weight:600;padding:5px 0;">${subject}</td>
        </tr>
      </table>
    </div>
    <div style="background:#0a0b0f;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:20px;margin:0 0 20px;">
      <p style="color:#9ca3af;font-size:12px;font-weight:600;margin:0 0 10px;text-transform:uppercase;letter-spacing:0.05em;">Message</p>
      <p style="color:#d1d5db;font-size:14px;line-height:1.7;margin:0;">${message.replace(/\n/g, "<br>")}</p>
    </div>
    <p style="color:#6b7280;font-size:13px;margin:0;">Reply directly to this email to respond to the affiliate.</p>
  `;
  await sendAndLog("support_ticket", {
    fromName: BRAND_NAME,
    to: ["support@1of1traderpro.com"],
    replyTo: affiliateEmail,
    subject: `[Partner Support] ${subject}`,
    html: emailWrapper(body),
  });
}

export async function sendAdminReply(
  to: string,
  affiliateName: string,
  subject: string,
  replyMessage: string
): Promise<void> {
  const body = `
    <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 8px;">New Reply on Your Ticket</h1>
    <p style="color:#9ca3af;font-size:15px;margin:0 0 20px;">Hi ${affiliateName},</p>
    <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 16px;">
      The support team has replied to your ticket: <strong style="color:#facc15;">${subject}</strong>
    </p>
    <div style="background:#0a0b0f;border-left:3px solid #facc15;border-radius:8px;padding:16px 20px;margin:0 0 24px;">
      <p style="color:#e5e7eb;font-size:15px;line-height:1.7;margin:0;white-space:pre-wrap;">${replyMessage}</p>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
      <tr><td align="center">
        <a href="${DASHBOARD_URL}" style="display:inline-block;background:#facc15;color:#0a0b0f;font-weight:700;font-size:14px;padding:12px 28px;border-radius:10px;text-decoration:none;">
          View Full Conversation →
        </a>
      </td></tr>
    </table>
  `;
  await sendAndLog("admin_reply", {
    fromName: `${BRAND_NAME} Support`,
    to,
    subject: `Re: ${subject}`,
    html: emailWrapper(body),
  });
}

export async function sendPasswordReset(
  to: string,
  fullName: string,
  resetUrl: string
): Promise<void> {
  const body = `
    <h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 8px;">Reset Your Password</h1>
    <p style="color:#9ca3af;font-size:16px;margin:0 0 24px;">Hi ${fullName},</p>
    <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 24px;">
      We received a request to reset your <strong style="color:#facc15;">${BRAND_NAME}</strong> dashboard password.
      Click the button below to choose a new password. This link expires in <strong style="color:#fff;">1 hour</strong>.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr><td align="center">
        <a href="${resetUrl}" style="display:inline-block;background:#facc15;color:#0a0b0f;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none;">
          Reset My Password →
        </a>
      </td></tr>
    </table>
    <div style="background:#0a0b0f;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;margin:0 0 24px;">
      <p style="color:#9ca3af;font-size:13px;margin:0 0 8px;">Or copy and paste this link into your browser:</p>
      <p style="color:#facc15;font-size:13px;font-family:monospace;word-break:break-all;margin:0;">${resetUrl}</p>
    </div>
    <p style="color:#6b7280;font-size:13px;margin:0;text-align:center;">
      If you didn't request a password reset, you can safely ignore this email. Your password won't change.
    </p>
  `;
  await sendAndLog("password_reset", {
    fromName: BRAND_NAME,
    to,
    subject: `Reset your ${BRAND_NAME} dashboard password`,
    html: emailWrapper(body),
  });
}
