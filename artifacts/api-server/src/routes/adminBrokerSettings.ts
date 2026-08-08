import { Router, type IRouter } from "express";
import { db, brokerAccountTypesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { requireAdmin } from "../lib/auth";
import {
  getWireDetails,
  setWireDetails,
  getCryptoAddresses,
  setCryptoAddresses,
  wireDetailsSchema,
  cryptoAddressesSchema,
} from "../lib/brokerSettings";

const router: IRouter = Router();

router.get("/settings/wire", requireAdmin, async (req, res) => {
  try {
    res.json({ wire: await getWireDetails() });
  } catch (err) {
    req.log.error({ err }, "Get wire settings error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/settings/wire", requireAdmin, async (req, res) => {
  try {
    const admin = (req as any).user;
    const parsed = wireDetailsSchema.safeParse(req.body?.wire);
    if (!parsed.success) {
      res.status(400).json({ error: "Bad Request", message: "beneficiaryName and bankName are required" });
      return;
    }
    await setWireDetails(parsed.data, admin.id);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Update wire settings error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/settings/crypto-addresses", requireAdmin, async (req, res) => {
  try {
    res.json({ cryptoAddresses: await getCryptoAddresses() });
  } catch (err) {
    req.log.error({ err }, "Get crypto addresses error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/settings/crypto-addresses", requireAdmin, async (req, res) => {
  try {
    const admin = (req as any).user;
    const parsed = cryptoAddressesSchema.safeParse(req.body?.cryptoAddresses);
    if (!parsed.success) {
      res.status(400).json({ error: "Bad Request", message: "Each address needs coin, network and address" });
      return;
    }
    await setCryptoAddresses(parsed.data, admin.id);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Update crypto addresses error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

function toAccountTypeView(t: typeof brokerAccountTypesTable.$inferSelect) {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    mt5Group: t.mt5Group,
    currency: t.currency,
    minDeposit: t.minDeposit,
    leverages: t.leverages,
    isActive: t.isActive,
    sortOrder: t.sortOrder,
  };
}

const leveragesSchema = z.array(z.number().int().positive()).min(1);

router.get("/account-types", requireAdmin, async (req, res) => {
  try {
    const rows = await db.select().from(brokerAccountTypesTable).orderBy(brokerAccountTypesTable.sortOrder);
    res.json({ accountTypes: rows.map(toAccountTypeView) });
  } catch (err) {
    req.log.error({ err }, "List account types error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/account-types", requireAdmin, async (req, res) => {
  try {
    const { name, description, mt5Group, currency, minDeposit, leverages, isActive, sortOrder } = req.body;
    const parsedLeverages = leveragesSchema.safeParse(leverages);
    if (!name || !mt5Group || !parsedLeverages.success) {
      res.status(400).json({ error: "Bad Request", message: "name, mt5Group and a leverages array are required" });
      return;
    }
    const inserted = await db
      .insert(brokerAccountTypesTable)
      .values({
        name,
        description: description ?? null,
        mt5Group,
        currency: currency ?? "USD",
        minDeposit: minDeposit ?? "0",
        leverages: parsedLeverages.data,
        isActive: isActive ?? true,
        sortOrder: sortOrder ?? 0,
      })
      .returning();
    res.status(201).json({ success: true, accountType: toAccountTypeView(inserted[0]) });
  } catch (err) {
    req.log.error({ err }, "Create account type error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/account-types/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const { name, description, mt5Group, minDeposit, leverages, isActive, sortOrder } = req.body;
    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = name;
    if (description !== undefined) patch.description = description;
    if (mt5Group !== undefined) patch.mt5Group = mt5Group;
    if (minDeposit !== undefined) patch.minDeposit = minDeposit;
    if (isActive !== undefined) patch.isActive = Boolean(isActive);
    if (sortOrder !== undefined) patch.sortOrder = Number(sortOrder);
    if (leverages !== undefined) {
      const parsed = leveragesSchema.safeParse(leverages);
      if (!parsed.success) {
        res.status(400).json({ error: "Bad Request", message: "leverages must be a non-empty array of positive integers" });
        return;
      }
      patch.leverages = parsed.data;
    }
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "Bad Request", message: "Nothing to update" });
      return;
    }
    const updated = await db
      .update(brokerAccountTypesTable)
      .set(patch)
      .where(eq(brokerAccountTypesTable.id, id))
      .returning();
    if (!updated[0]) {
      res.status(404).json({ error: "Not Found", message: "Account type not found" });
      return;
    }
    res.json({ success: true, accountType: toAccountTypeView(updated[0]) });
  } catch (err) {
    req.log.error({ err }, "Update account type error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
