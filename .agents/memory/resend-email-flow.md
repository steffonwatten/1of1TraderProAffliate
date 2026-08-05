---
name: Resend email flow (affiliate-dashboard)
description: How transactional email works for affiliate-dashboard and its silent failure modes
---

# Resend email sending (affiliate-dashboard / api-server)

All transactional email (password reset, application received/approved/denied, support
tickets, admin replies) is sent from `artifacts/api-server/src/lib/email.ts` via the
Resend connector. Credentials + `from_email` come from the Replit Resend connection at
runtime; sender is `support@1of1traderpro.com`.

## The big silent-failure trap
Email failures are INVISIBLE in the app:
- every `send*` function wraps the send in try/catch and only `console.error`s — never rethrows or surfaces to the UI.
- `/forgot-password` responds `{success:true}` BEFORE sending (anti-enumeration), so the UI always shows success even when nothing sends.
**Why:** a user reported "no reset email" — root cause was Resend rejecting sends, but the UI gave no signal. When email "doesn't arrive," do NOT trust the UI — check the Resend dashboard / API directly.

## Sending domain must be verified in Resend
Resend rejects sends from any unverified domain (HTTP 403 "domain is not verified").
The sending domain `1of1traderpro.com` must stay verified (DKIM TXT `resend._domainkey`,
SPF MX + TXT on `send`). DNS lives in GoDaddy. Resend free plan allows only 1 domain.

## Per-address suppression
A `last_event: "suppressed"` on a sent email means that recipient is on Resend's
suppression list (prior bounce/complaint) — it's per-address, not domain-wide. Clear it
in the Resend dashboard Suppressions section. `admin@1of1traderpro.com` was suppressed.
