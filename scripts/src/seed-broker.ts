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

// The broker's real receiving details (supplied by the client 2026-08-08).
// These are deliberately committed: they are the public payment instructions
// shown to every depositing client — not credentials. Editable any time in
// broker-admin → Settings.
await db
  .insert(brokerSettingsTable)
  .values([
    {
      key: "wire_details",
      value: {
        beneficiaryName: "Blockcommerce LLC",
        beneficiaryAddress: "17918 Blue Ridge Shores Dr., Cypress, TX 77433",
        bankName: "Old Glory Bank",
        bankAddress: "PO Box 127, Elmore City, OK 73433",
        domestic: {
          routingNumber: "103113441",
          accountNumber: "4000055089",
        },
        international: {
          intermediaryBank: "The Bankers Bank",
          swift: "BBOKUS44",
          beneficiaryBank: "Old Glory Bank",
          routingNumber: "103113441",
          accountNumber: "10740",
          memo: "Blockcommerce",
        },
        referenceInstructions:
          "Include your client email in the wire memo/reference so we can match your deposit.",
      },
    },
    { key: "crypto_addresses", value: [] },
  ])
  .onConflictDoNothing({ target: brokerSettingsTable.key });
console.log("Deposit settings present (kept existing values if already configured)");

process.exit(0);
