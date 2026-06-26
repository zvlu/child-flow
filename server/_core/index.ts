import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
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
  app.use("/api", apiRateLimiter);
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
