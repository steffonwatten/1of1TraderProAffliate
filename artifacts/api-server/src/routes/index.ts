import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import publicRouter from "./public.js";
import webhooksRouter from "./webhooks.js";
import adminApplicationsRouter from "./adminApplications.js";
import adminAffiliatesRouter from "./adminAffiliates.js";
import adminOverviewRouter from "./adminOverview.js";
import adminPayoutsRouter from "./adminPayouts.js";
import adminCommissionsRouter from "./adminCommissions.js";
import adminMembershipsRouter from "./adminMemberships.js";
import adminMiscRouter from "./adminMisc.js";
import adminFinanceRouter from "./adminFinance.js";
import adminSupportTicketsRouter from "./adminSupportTickets.js";
import affiliateDashboardRouter from "./affiliateDashboard.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/", publicRouter);
router.use("/webhooks", webhooksRouter);
router.use("/admin/applications", adminApplicationsRouter);
router.use("/admin/affiliates", adminAffiliatesRouter);
router.use("/admin", adminOverviewRouter);
router.use("/admin/payouts", adminPayoutsRouter);
router.use("/admin/commissions", adminCommissionsRouter);
router.use("/admin/memberships", adminMembershipsRouter);
router.use("/admin", adminFinanceRouter);
router.use("/admin", adminMiscRouter);
router.use("/admin", adminSupportTicketsRouter);
router.use("/affiliate", affiliateDashboardRouter);

export default router;
