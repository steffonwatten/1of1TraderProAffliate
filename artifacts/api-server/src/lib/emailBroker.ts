import { db, emailLogsTable } from "@workspace/db";
import { getUncachableResendClient } from "./email";

// Broker (trading-client) emails. Unlike lib/email.ts, sends here THROW on
// failure — a verification code that silently fails to send strands the
// signup, so the route must know and tell the user.

const BRAND_NAME = "1OF1 Trader Pro";

export class EmailSendError extends Error {}

async function sendOrThrow(emailType: string, to: string, subject: string, html: string): Promise<void> {
  let errorMessage: string | null = null;
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    const result = await client.emails.send({
      from: `${BRAND_NAME} <${fromEmail}>`,
      to,
      subject,
      html,
    });
    // The Resend SDK does NOT throw on API errors — inspect result.error.
    if (result.error) {
      errorMessage = result.error.message ?? JSON.stringify(result.error);
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  }
  try {
    await db.insert(emailLogsTable).values({
      recipient: to,
      subject,
      emailType,
      status: errorMessage ? "failed" : "sent",
      errorMessage,
    });
  } catch (logErr) {
    console.error("Failed to write email log:", logErr);
  }
  if (errorMessage) throw new EmailSendError(errorMessage);
}

function brokerEmailWrapper(body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0b0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0b0f;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="text-align:center;padding-bottom:32px;">
          <p style="margin:12px 0 0;color:#f97316;font-weight:700;font-size:18px;letter-spacing:0.05em;">${BRAND_NAME}</p>
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

export async function sendClientVerificationCode(to: string, code: string): Promise<void> {
  const body = `
    <h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 8px;">Verify your email</h1>
    <p style="color:#9ca3af;font-size:16px;margin:0 0 24px;">Enter this code to continue setting up your trading account:</p>
    <p style="color:#fff;background:#1c1f2e;border-radius:12px;text-align:center;font-size:36px;font-weight:800;letter-spacing:0.35em;padding:20px 0;margin:0 0 24px;">${code}</p>
    <p style="color:#6b7280;font-size:14px;margin:0;">The code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>`;
  await sendOrThrow("client_verification_code", to, `Your ${BRAND_NAME} verification code`, brokerEmailWrapper(body));
}

export async function sendClientTransactionDecision(
  to: string,
  fullName: string,
  kind: "deposit" | "withdrawal",
  amount: string,
  currency: string,
  approved: boolean
): Promise<void> {
  const verdict = approved ? "approved" : "rejected";
  const body = `
    <h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 8px;">${kind === "deposit" ? "Deposit" : "Withdrawal"} ${verdict}</h1>
    <p style="color:#9ca3af;font-size:16px;margin:0 0 24px;">Hi ${fullName},</p>
    <p style="color:#9ca3af;font-size:16px;margin:0 0 24px;">Your ${kind} of <strong style="color:#fff;">${amount} ${currency}</strong> has been ${verdict}.${
      !approved && kind === "withdrawal" ? " The funds have been returned to your wallet." : ""
    }</p>
    <p style="color:#6b7280;font-size:14px;margin:0;">Log in to your client portal to see the details.</p>`;
  // Decision notices are best-effort: log the failure, don't fail the decision.
  try {
    await sendOrThrow(`client_${kind}_${verdict}`, to, `Your ${kind} was ${verdict}`, brokerEmailWrapper(body));
  } catch (err) {
    console.error(`Failed to send ${kind} decision email:`, err);
  }
}

export async function sendClientKycDecision(
  to: string,
  fullName: string,
  approved: boolean,
  notes: string | null
): Promise<void> {
  const body = approved
    ? `
    <h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 8px;">Identity verified ✓</h1>
    <p style="color:#9ca3af;font-size:16px;margin:0 0 24px;">Hi ${fullName},</p>
    <p style="color:#9ca3af;font-size:16px;margin:0 0 24px;">Your identity documents have been approved. You can now open live trading accounts from your client portal.</p>`
    : `
    <h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 8px;">Identity check needs attention</h1>
    <p style="color:#9ca3af;font-size:16px;margin:0 0 24px;">Hi ${fullName},</p>
    <p style="color:#9ca3af;font-size:16px;margin:0 0 24px;">We couldn't approve your identity documents.${notes ? ` Reason: ${notes}` : ""} Please upload new documents from your client portal.</p>`;
  try {
    await sendOrThrow(`client_kyc_${approved ? "approved" : "rejected"}`, to, approved ? "Your identity is verified" : "Your identity check needs attention", brokerEmailWrapper(body));
  } catch (err) {
    console.error("Failed to send KYC decision email:", err);
  }
}
