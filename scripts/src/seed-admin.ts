import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "1of1traderpro_salt").digest("hex");
}

const ADMIN_EMAIL = "admin@1of1traderpro.com";
const ADMIN_PASSWORD = "Admin1234!";

const existing = await db.select().from(usersTable).where(eq(usersTable.email, ADMIN_EMAIL)).limit(1);
if (existing.length > 0) {
  console.log("Admin user already exists:", ADMIN_EMAIL);
} else {
  await db.insert(usersTable).values({
    email: ADMIN_EMAIL,
    passwordHash: hashPassword(ADMIN_PASSWORD),
    fullName: "Admin",
    role: "admin",
    status: "active",
  });
  console.log("Admin user created!");
  console.log("Email:", ADMIN_EMAIL);
  console.log("Password:", ADMIN_PASSWORD);
}

process.exit(0);
