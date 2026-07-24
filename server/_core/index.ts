import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { registerAuthRoutes } from "./auth";
import { registerOAuthRoutes } from "./oauth";
import { registerDashboardRoutes } from "../dashboard";
import { registerFamilyRoutes } from "../family";
import { registerMessagingRoutes } from "../messaging";
import { registerRosterRoutes } from "../roster";
import { registerPirRoutes } from "../pir";
import { registerActivityRoutes } from "../activity";
import { registerProgramModuleRoutes } from "../programModules";
import { registerAbsenceRoutes } from "../absences";
import { registerAttendanceRoutes } from "../attendance";
import { registerFamilyCaseManagementRoutes } from "../familyCaseManagementRest";
import { registerSettingsRoutes } from "../settingsRest";
import { registerEnrollmentVerificationRoutes } from "../enrollmentVerificationsRest";
import { registerStaffDirectoryRoutes } from "../staffDirectory";
import { registerApprovalRoutes } from "../approvalsRest";
import { registerNotesRoutes } from "../notesRest";
import { registerErseaRoutes } from "../erseaRest";
import { registerHealthComplianceRoutes } from "../healthComplianceRest";
import { registerNutritionFormRoutes } from "../nutritionForms";
import { registerFamilyEngagementEventsRoutes } from "../familyEngagementEvents";
import { registerReportsRoutes } from "../reportsRest";
import { registerGrantBudgetRoutes } from "../grantBudgetRest";
import { registerPolicyCouncilRoutes } from "../policyCouncilRest";
import { registerClassroomQualityRoutes } from "../classroomQualityRest";
import { registerInKindRoutes } from "../inKindRest";
import { registerBulkActionsRoutes } from "../bulkActionsRest";
import { registerParticipationClearanceRoutes } from "../participationClearanceRest";
import { registerComplianceChecklistRoutes } from "../complianceChecklistRest";
import { registerStoryRoutes } from "../storyRest";
import { UPLOADS_ROOT } from "../fileStorage";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { securityHeaders, apiRateLimiter } from "./security";
import { assertSafeAuthConfig } from "./env";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Fail-closed: never boot with an open dev-auth bypass outside development.
  assertSafeAuthConfig();
  const app = express();
  const server = createServer(app);
  app.set("trust proxy", true); // so req.ip / x-forwarded-for are accurate behind a proxy
  // Baseline security headers on every response.
  app.use(securityHeaders);
  // Lightweight liveness probe for uptime monitoring / load balancers.
  // Mounted at /healthz (not /health) so it doesn't shadow the SPA's
  // /health (Health Records) route on a direct page load / refresh.
  app.get("/healthz", (_req, res) => res.json({ ok: true }));
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Coarse per-IP rate limit across the API (auth routes keep stricter limits).
  // Ops liveness/readiness probe (load balancers, uptime monitors). Not under
  // /api, so it's unauthenticated and not rate-limited. 200 = app up + DB
  // reachable; 503 = DB unreachable (so a monitor can page / drain traffic).
  app.get("/healthz", async (_req, res) => {
    let db = false;
    try {
      const d = await getDb();
      if (d) {
        await d.execute(sql`select 1`);
        db = true;
      }
    } catch {
      /* DB unreachable */
    }
    res.status(db ? 200 : 503).json({
      ok: db,
      db,
      uptimeSeconds: Math.round(process.uptime()),
      time: new Date().toISOString(),
    });
  });

  app.use("/api", apiRateLimiter);
  // Locally-stored document uploads (server/fileStorage.ts) — see that file
  // for why this is disk-based instead of S3/GCS.
  app.use("/uploads", express.static(UPLOADS_ROOT));
  // Email/password sign-in for mobile clients under /api/auth/login
  registerAuthRoutes(app);
  // Parent (family app) onboarding + scoped data under /api/family/*
  registerFamilyRoutes(app);
  // Staff dashboard stats + live alerts under /api/dashboard/stats
  registerDashboardRoutes(app);
  // Two-way staff <-> family messaging under /api/messaging/*
  registerMessagingRoutes(app);
  // Children + classroom rosters under /api/children, /api/classrooms
  registerRosterRoutes(app);
  // PIR (Program Information Report) for the iOS app under /api/pir/*
  registerPirRoutes(app);
  // Daily Reports / Moments for the iOS staff app under /api/activity
  registerActivityRoutes(app);
  // Lesson Planning, Portfolios, Subsidies (iOS) under /api/lesson-plans, /api/portfolio, /api/subsidies
  registerProgramModuleRoutes(app);
  // Parent-reported absences + advocate review under /api/family/absences, /api/absences
  registerAbsenceRoutes(app);
  // Teacher attendance + quick notes under /api/attendance, /api/children/:id/notes
  registerAttendanceRoutes(app);
  // Family case management (goals, referrals, home visits, FPA, FNA, CFCR,
  // case notes) + AIP/chronic-absence (iOS) — all Head Start module-gated
  registerFamilyCaseManagementRoutes(app);
  // Settings screen (program name/fiscal year, password change) under /api/settings
  registerSettingsRoutes(app);
  // ERSEA application-verification checklist (iOS) under /api/enrollment/verifications
  registerEnrollmentVerificationRoutes(app);
  // Staff Directory (iOS) under /api/staff
  registerStaffDirectoryRoutes(app);
  // Higher-up approval inbox (iOS) under /api/approvals
  registerApprovalRoutes(app);
  // Unified notes feed (iOS) under /api/notes/recent
  registerNotesRoutes(app);
  // ERSEA eligibility + suspension/expulsion logs (iOS) under /api/ersea/* — Head Start-gated
  registerErseaRoutes(app);
  // Health Compliance, Safety Drills, Mental Health Consults (iOS) under /api/health/*
  registerHealthComplianceRoutes(app);
  // CACFP nutrition forms (iOS) under /api/nutrition/*
  registerNutritionFormRoutes(app);
  // Family engagement events (iOS) under /api/events
  registerFamilyEngagementEventsRoutes(app);
  // Bare compliance snapshot + on-demand text reports (iOS) under /api/compliance, /api/reports/generate
  registerReportsRoutes(app);
  // Grant & Budget tracking (iOS) under /api/grants/* — Head Start-gated
  registerGrantBudgetRoutes(app);
  // Policy Council membership + meetings (iOS) under /api/policy-council/* — Head Start-gated
  registerPolicyCouncilRoutes(app);
  // Classroom Quality CLASS/ECERS observations (iOS) under /api/classroom-quality — Head Start-gated
  registerClassroomQualityRoutes(app);
  // In-Kind Contributions / 20% non-federal match tracking (iOS) under /api/in-kind — Head Start-gated
  registerInKindRoutes(app);
  // Bulk Action Center (iOS) under /api/bulk-actions/* — generic, not Head Start-gated
  registerBulkActionsRoutes(app);
  // "Cleared to attend" participation-blocking status under /api/children/clearance, /api/children/:id/clearance
  registerParticipationClearanceRoutes(app);
  // Program-monitoring checklist (iOS Compliance screen) under /api/compliance/checklist
  registerComplianceChecklistRoutes(app);
  // Program "Story" feed (iOS) under /api/story/*
  registerStoryRoutes(app);
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
