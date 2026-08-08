export * from "./generated/api";
export * from "./generated/types";

// These names are emitted as both a zod schema (value) in ./generated/api and a
// TypeScript type in ./generated/types, which makes the two `export *` above
// ambiguous (TS2308). Explicitly re-exporting the runtime schema from ./generated/api
// resolves the ambiguity in favor of the value, which is what consumers use.
export {
  TrackClickResponse,
  HandleWhopWebhookBody,
  MarkPayoutPaidBody,
  ClientVerifyEmailResponse,
  ClientLogoutResponse,
} from "./generated/api";
