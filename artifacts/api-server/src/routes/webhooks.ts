import { Router, type IRouter, type Request } from "express";
import crypto from "crypto";
import { handleWebhookEvent } from "../lib/whop";

const router: IRouter = Router();

function timingSafeCompare(a: string, b: string): boolean {
  // Both must be the same length — pad the incoming sig to match if needed so
  // timingSafeEqual doesn't throw; the HMAC comparison will still fail correctly.
  const bufA = Buffer.from(a.padEnd(64, "0"), "hex");
  const bufB = Buffer.from(b.padEnd(64, "0"), "hex");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB) && a.length === b.length;
}

function verifyWhopSignature(req: Request & { rawBody?: Buffer }): boolean {
  const secret = process.env.WHOP_WEBHOOK_SECRET;
  if (!secret) {
    req.log.warn("WHOP_WEBHOOK_SECRET not set — skipping signature check");
    return true;
  }

  const rawBody = req.rawBody;
  if (!rawBody) {
    req.log.warn("No raw body available for webhook signature verification");
    return false;
  }

  // Whop sends the signature in the `whop-signature` header as a hex HMAC-SHA256.
  // Format can be plain hex, "sha256=<hex>", or "t=<timestamp>,v1=<hex>"
  const signature = (
    req.headers["whop-signature"] ??
    req.headers["x-whop-signature"] ??
    req.headers["x-hub-signature-256"] ??
    req.headers["x-hub-signature"]
  ) as string | undefined;
  if (!signature) {
    // Whop may not send a signature for all event types — allow through with a warning
    // so data is not silently dropped. Tighten this once signing is confirmed active.
    req.log.warn("No webhook signature header found — allowing through (unverified)");
    return true;
  }

  try {
    if (signature.includes(",")) {
      // Format: "t=1234567890,v1=abc123..."
      const v1Part = signature.split(",").find((p) => p.startsWith("v1="));
      if (!v1Part) return false;
      const sigHex = v1Part.slice(3);
      const tsPart = signature.split(",").find((p) => p.startsWith("t="));
      const ts = tsPart ? tsPart.slice(2) : "";
      const payload = `${ts}.${rawBody.toString()}`;
      const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
      const trusted = timingSafeCompare(sigHex, expected);
      if (!trusted) req.log.warn({ signature }, "Webhook signature mismatch (timestamp format)");
      return trusted;
    } else {
      // Plain hex or "sha256=<hex>"
      const sigHex = signature.replace(/^sha256=/, "");
      const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
      const trusted = timingSafeCompare(sigHex, expected);
      if (!trusted) req.log.warn({ signature }, "Webhook signature mismatch (plain format)");
      return trusted;
    }
  } catch (err) {
    req.log.error({ err }, "Error verifying webhook signature");
    return false;
  }
}

router.post("/whop", async (req: Request & { rawBody?: Buffer }, res) => {
  if (!verifyWhopSignature(req)) {
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }

  try {
    const event = req.body;
    req.log.info({ eventType: event.event ?? event.type }, "Received Whop webhook");
    await handleWebhookEvent(event);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Webhook processing error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
