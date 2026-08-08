import { Router, type IRouter } from "express";
import {
  db,
  brokerClientsTable,
  brokerKycDocumentsTable,
  brokerWalletsTable,
  brokerTradingAccountsTable,
  adminAuditLogsTable,
} from "@workspace/db";
import { eq, and, desc, ilike, or, sql } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";
import { openKycFileStream, kycFileExists } from "../lib/fileStorage";
import { sendClientKycDecision } from "../lib/emailBroker";

const router: IRouter = Router();

router.get("/clients", requireAdmin, async (req, res) => {
  try {
    const { kycStatus, search } = req.query as { kycStatus?: string; search?: string };
    const conditions = [];
    if (kycStatus && ["none", "pending", "approved", "rejected"].includes(kycStatus)) {
      conditions.push(eq(brokerClientsTable.kycStatus, kycStatus as "none"));
    }
    if (search) {
      conditions.push(
        or(
          ilike(brokerClientsTable.email, `%${search}%`),
          ilike(brokerClientsTable.fullName, `%${search}%`)
        )
      );
    }
    const rows = await db
      .select({
        client: brokerClientsTable,
        walletBalance: brokerWalletsTable.balance,
      })
      .from(brokerClientsTable)
      .leftJoin(brokerWalletsTable, eq(brokerWalletsTable.clientId, brokerClientsTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(brokerClientsTable.createdAt))
      .limit(200);
    res.json({
      clients: rows.map(({ client, walletBalance }) => ({
        id: client.id,
        email: client.email,
        fullName: client.fullName,
        country: client.country,
        status: client.status,
        kycStatus: client.kycStatus,
        walletBalance,
        createdAt: client.createdAt,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "List broker clients error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/clients/:id", requireAdmin, async (req, res) => {
  try {
    const clientId = parseInt(req.params.id as string);
    const rows = await db
      .select({ client: brokerClientsTable, walletBalance: brokerWalletsTable.balance })
      .from(brokerClientsTable)
      .leftJoin(brokerWalletsTable, eq(brokerWalletsTable.clientId, brokerClientsTable.id))
      .where(eq(brokerClientsTable.id, clientId))
      .limit(1);
    if (!rows[0]) {
      res.status(404).json({ error: "Not Found", message: "Client not found" });
      return;
    }
    const { client, walletBalance } = rows[0];
    const documents = await db
      .select()
      .from(brokerKycDocumentsTable)
      .where(eq(brokerKycDocumentsTable.clientId, clientId))
      .orderBy(desc(brokerKycDocumentsTable.createdAt));
    const [{ count: tradingAccountCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(brokerTradingAccountsTable)
      .where(eq(brokerTradingAccountsTable.clientId, clientId));
    res.json({
      client: {
        id: client.id,
        email: client.email,
        fullName: client.fullName,
        country: client.country,
        status: client.status,
        kycStatus: client.kycStatus,
        walletBalance,
        createdAt: client.createdAt,
      },
      phone: client.phone,
      kycNotes: client.kycNotes,
      documents: documents.map((d) => ({
        id: d.id,
        docType: d.docType,
        originalName: d.originalName,
        status: d.status,
        reviewNotes: d.reviewNotes,
        createdAt: d.createdAt,
      })),
      tradingAccountCount,
    });
  } catch (err) {
    req.log.error({ err }, "Get broker client detail error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/clients/:id/kyc-decision", requireAdmin, async (req, res) => {
  try {
    const admin = (req as any).user;
    const clientId = parseInt(req.params.id as string);
    const { decision, notes } = req.body;
    if (decision !== "approved" && decision !== "rejected") {
      res.status(400).json({ error: "Bad Request", message: "decision must be approved or rejected" });
      return;
    }
    const clients = await db
      .select()
      .from(brokerClientsTable)
      .where(eq(brokerClientsTable.id, clientId))
      .limit(1);
    if (!clients[0]) {
      res.status(404).json({ error: "Not Found", message: "Client not found" });
      return;
    }

    await db
      .update(brokerClientsTable)
      .set({ kycStatus: decision, kycNotes: notes ?? null })
      .where(eq(brokerClientsTable.id, clientId));
    // Mirror the decision onto the pending documents so the client sees
    // per-document state, not just the headline status.
    await db
      .update(brokerKycDocumentsTable)
      .set({ status: decision, reviewNotes: notes ?? null, reviewedBy: admin.id, reviewedAt: new Date() })
      .where(
        and(eq(brokerKycDocumentsTable.clientId, clientId), eq(brokerKycDocumentsTable.status, "pending"))
      );
    await db.insert(adminAuditLogsTable).values({
      adminUserId: admin.id,
      action: `kyc_${decision}`,
      targetType: "broker_client",
      targetId: String(clientId),
      newValue: notes ? JSON.stringify({ notes }) : null,
    });
    sendClientKycDecision(clients[0].email, clients[0].fullName, decision === "approved", notes ?? null);

    res.json({ success: true, kycStatus: decision });
  } catch (err) {
    req.log.error({ err }, "KYC decision error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/kyc/documents/:id/file", requireAdmin, async (req, res) => {
  try {
    const docId = parseInt(req.params.id as string);
    const docs = await db
      .select()
      .from(brokerKycDocumentsTable)
      .where(eq(brokerKycDocumentsTable.id, docId))
      .limit(1);
    if (!docs[0] || !kycFileExists(docs[0].storedPath)) {
      res.status(404).json({ error: "Not Found", message: "Document not found" });
      return;
    }
    res.setHeader("Content-Type", docs[0].mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${docs[0].originalName.replace(/"/g, "")}"`);
    openKycFileStream(docs[0].storedPath).pipe(res);
  } catch (err) {
    req.log.error({ err }, "Stream KYC document error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
