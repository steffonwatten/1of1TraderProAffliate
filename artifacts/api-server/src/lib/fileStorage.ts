import fs from "fs";
import path from "path";
import crypto from "crypto";

// Minimal file store for KYC uploads. Local disk behind this interface so a
// persistent volume / object store can replace it later without touching the
// routes. The directory lives OUTSIDE the repo tree by default and must never
// be committed (customer identity documents).
//
// ⚠️ On autoscale deployments local disk is EPHEMERAL — production needs
// KYC_UPLOAD_DIR pointed at a persistent volume, or this module swapped for
// object storage. Flagged in docs/SESSION-LOG.md.

const uploadDir = process.env.KYC_UPLOAD_DIR ?? path.join(process.cwd(), ".data", "kyc-uploads");

function ensureDir(): void {
  fs.mkdirSync(uploadDir, { recursive: true, mode: 0o700 });
}

export function saveKycFile(buffer: Buffer, originalName: string): string {
  ensureDir();
  const ext = path.extname(originalName).toLowerCase().slice(0, 10);
  const storedName = crypto.randomUUID() + ext;
  fs.writeFileSync(path.join(uploadDir, storedName), buffer, { mode: 0o600 });
  return storedName;
}

export function openKycFileStream(storedName: string): fs.ReadStream {
  // storedName comes from the DB (UUID + ext), but normalize defensively so a
  // crafted value can never escape the upload directory.
  const safe = path.basename(storedName);
  return fs.createReadStream(path.join(uploadDir, safe));
}

export function kycFileExists(storedName: string): boolean {
  return fs.existsSync(path.join(uploadDir, path.basename(storedName)));
}
