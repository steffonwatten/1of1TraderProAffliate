import { db, brokerAccountTypesTable, brokerSettingsTable } from "@workspace/db";

// Seeds the broker catalog: default account types and PLACEHOLDER deposit
// settings. Real wire details and crypto addresses are entered by the broker
// in broker-admin → Settings — placeholders make the deposit page render, not
// receive money. Idempotent: skips anything that already exists.

const existingTypes = await db.select({ id: brokerAccountTypesTable.id }).from(brokerAccountTypesTable).limit(1);
if (existingTypes.length > 0) {
  console.log("Account types already seeded, skipping");
} else {
  await db.insert(brokerAccountTypesTable).values([
    {
      name: "Standard",
      description: "Commission-free trading with competitive spreads",
      mt5Group: "real\\standard",
      currency: "USD",
      minDeposit: "100",
      leverages: [100, 200, 400],
      isActive: true,
      sortOrder: 0,
    },
    {
      name: "Pro",
      description: "Raw spreads for experienced traders",
      mt5Group: "real\\pro",
      currency: "USD",
      minDeposit: "1000",
      leverages: [100, 200],
      isActive: true,
      sortOrder: 1,
    },
  ]);
  console.log("Seeded account types: Standard, Pro");
}

await db
  .insert(brokerSettingsTable)
  .values([
    {
      key: "wire_details",
      value: {
        beneficiaryName: "SET IN ADMIN SETTINGS",
        bankName: "SET IN ADMIN SETTINGS",
        accountNumber: null,
        iban: null,
        swift: null,
        bankAddress: null,
        referenceInstructions: "Include your client email as the payment reference",
      },
    },
    { key: "crypto_addresses", value: [] },
  ])
  .onConflictDoNothing({ target: brokerSettingsTable.key });
console.log("Deposit settings present (placeholders unless already configured)");

process.exit(0);
