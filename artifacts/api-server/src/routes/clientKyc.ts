import { Router, type IRouter } from "express";
import multer from "multer";
import { db, brokerClientsTable, brokerKycDocumentsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireClient, getReqClient } from "../lib/clientAuth";
import { saveKycFile } from "../lib/fileStorage";

const router: IRouter = Router();

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const DOC_TYPES = new Set(["id_front", "id_back", "proof_of_address"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
});

function toDocResponse(doc: typeof brokerKycDocumentsTable.$inferSelect) {
  return {
    id: doc.id,
    docType: doc.docType,
    originalName: doc.originalName,
    status: doc.status,
    reviewNotes: doc.reviewNotes,
    createdAt: doc.createdAt,
  };
}

router.get("/kyc", requireClient, async (req, res) => {
  try {
    const client = getReqClient(req);
    const documents = await db
      .select()
      .from(brokerKycDocumentsTable)
      .where(eq(brokerKycDocumentsTable.clientId, client.id))
      .orderBy(desc(brokerKycDocumentsTable.createdAt));
    res.json({
      kycStatus: client.kycStatus,
      kycNotes: client.kycNotes,
      documents: documents.map(toDocResponse),
    });
  } catch (err) {
    req.log.error({ err }, "Get client KYC error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/kyc/documents", requireClient, upload.single("file"), async (req, res) => {
  try {
    const client = getReqClient(req);
    const { docType } = req.body;
    const file = req.file;
    if (!file || !docType || !DOC_TYPES.has(docType)) {
      res.status(400).json({ error: "Bad Request", message: "A file and a valid docType are required" });
      return;
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      res.status(400).json({ error: "Bad Request", message: "Only JPEG, PNG, WebP or PDF files are accepted" });
      return;
    }

    const storedPath = saveKycFile(file.buffer, file.originalname);
    const inserted = await db
      .insert(brokerKycDocumentsTable)
      .values({
        clientId: client.id,
        docType: docType as "id_front" | "id_back" | "proof_of_address",
        originalName: file.originalname,
        storedPath,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      })
      .returning();

    // Any upload puts the client's overall KYC into review (unless already
    // approved — re-uploads after approval don't reset access).
    if (client.kycStatus === "none" || client.kycStatus === "rejected") {
      await db
        .update(brokerClientsTable)
        .set({ kycStatus: "pending" })
        .where(eq(brokerClientsTable.id, client.id));
    }

    res.status(201).json({ success: true, document: toDocResponse(inserted[0]) });
  } catch (err) {
    req.log.error({ err }, "Upload KYC document error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
