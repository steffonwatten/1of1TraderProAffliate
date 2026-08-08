import { db, brokerSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";

// Typed access to the broker_settings key-value store. Values are validated
// on write AND on read (a hand-edited row should fail loudly, not render).
// These are NON-SECRET display values (what clients see on the deposit page).

// Wire instructions split into domestic and international blocks because
// real-world receiving banks (and this broker's actual setup) route the two
// differently — one shared account field could not represent it.
export const wireDetailsSchema = z.object({
  beneficiaryName: z.string().min(1),
  beneficiaryAddress: z.string().nullish(),
  bankName: z.string().min(1),
  bankAddress: z.string().nullish(),
  domestic: z
    .object({
      routingNumber: z.string().min(1),
      accountNumber: z.string().min(1),
    })
    .nullish(),
  international: z
    .object({
      intermediaryBank: z.string().nullish(),
      swift: z.string().min(1),
      beneficiaryBank: z.string().nullish(),
      routingNumber: z.string().nullish(),
      accountNumber: z.string().nullish(),
      memo: z.string().nullish(),
    })
    .nullish(),
  referenceInstructions: z.string().nullish(),
});
export type WireDetails = z.infer<typeof wireDetailsSchema>;

export const cryptoAddressesSchema = z.array(
  z.object({
    coin: z.string().min(1),
    network: z.string().min(1),
    address: z.string().min(1),
  })
);
export type CryptoAddresses = z.infer<typeof cryptoAddressesSchema>;

const WIRE_KEY = "wire_details";
const CRYPTO_KEY = "crypto_addresses";

async function readSetting(key: string): Promise<unknown | null> {
  const rows = await db
    .select({ value: brokerSettingsTable.value })
    .from(brokerSettingsTable)
    .where(eq(brokerSettingsTable.key, key))
    .limit(1);
  return rows[0]?.value ?? null;
}

async function writeSetting(key: string, value: unknown, adminId: number): Promise<void> {
  await db
    .insert(brokerSettingsTable)
    .values({ key, value, updatedBy: adminId, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: brokerSettingsTable.key,
      set: { value, updatedBy: adminId, updatedAt: new Date() },
    });
}

export async function getWireDetails(): Promise<WireDetails | null> {
  const raw = await readSetting(WIRE_KEY);
  if (raw === null) return null;
  return wireDetailsSchema.parse(raw);
}

export async function setWireDetails(value: WireDetails, adminId: number): Promise<void> {
  await writeSetting(WIRE_KEY, wireDetailsSchema.parse(value), adminId);
}

export async function getCryptoAddresses(): Promise<CryptoAddresses> {
  const raw = await readSetting(CRYPTO_KEY);
  if (raw === null) return [];
  return cryptoAddressesSchema.parse(raw);
}

export async function setCryptoAddresses(value: CryptoAddresses, adminId: number): Promise<void> {
  await writeSetting(CRYPTO_KEY, cryptoAddressesSchema.parse(value), adminId);
}
