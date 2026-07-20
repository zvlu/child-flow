import { COOKIE_NAME, NOT_ADMIN_ERR_MSG } from "@shared/const";
import { MODULE_IDS } from "@shared/modules";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router, staffProcedure, adminProcedure, superAdminProcedure, orgStaffProcedure, orgAdminProcedure, hsStaffProcedure, hsAdminProcedure, parentProcedure } from "./_core/trpc";
import { isPlatformOwner } from "./_core/env";
import { invalidateModuleCache, orgHasModule } from "./_core/modules";
import { checkChronicAbsenceAlerts } from "./absenceAlerts";
import { getCaseloadOverview, assignAdvocate, getMyCaseload, suggestAssignments, generateSupervisorSummary } from "./caseloads";
import { SUPPORTED_LANGUAGES } from "./translation";
import { rateLimit } from "./_core/rateLimit";
import { computeAuditReadiness } from "./auditReadiness";
import { getBillingPlans, createBillingPlan, setBillingPlanActive, generateDueInvoices, getArAging } from "./billingPlans";
import { auditAccess } from "./_core/audit";
import { hashPassword, verifyPassword } from "./_core/password";
import { persistMediaDataUrl } from "./storage";
import { notifyMomentPosted } from "./_core/push";
import { z } from "zod";
import {
  getUserByOpenId,
  updateUserProfile,
  updateUserSettings,
  setUserPassword,
  getOrganizationByAgencyId,
  getOrganizationById,
  updateOrganization,
  getOrganizationUsage,
  getAllOrganizations,
  createOrganization,
  setOrganizationActive,
  getUserOrganizations,
  getOrganizationChildren,
  getChildById,
  createChild,
  bulkCreateChildren,
  getOrganizationStaff,
  getAttendanceByDate,
  getFamilySiblings,
  getHealthRecords,
  createHealthRecord,
  getHealthFollowUpAlerts,
  getFamilyServices,
  createFamilyService,
  getCommunicationLogs,
  createCommunicationLog,
  getEducationRecords,
  getPirData,
} from "./db";
import * as mod from "./moduleDb";
import { importRoster } from "./dataImport";
import { createFamilyInvitation, listFamilyInvitations } from "./family";
import { computeDashboard } from "./dashboard";
import { CommunicationService } from "./services/communication";
import { getChronicAbsenceSummary } from "./chronicAbsence";
import { listFpas, getFpaDetail, upsertFpa } from "./fpaDb";
import { getHealthDeadlineSummary } from "./healthDeadlines";
import { computeClearanceForOrg, computeClearanceForChild } from "./participationClearance";
import { listChecklistItems, markChecklistItemReviewed } from "./complianceChecklist";
import { computePirSuggestions } from "./pirAutoPopulate";
import { listIncidents, createIncident, updateIncident } from "./suspensionLog";
import * as pc from "./policyCouncil";
import * as ds from "./disabilityServices";
import { getGrantSummary, setBudgetLine, addExpense, GRANT_CATEGORIES } from "./grantBudget";
import { listAssessments, createAssessment } from "./classroomQuality";
import * as fcm from "./familyCaseManagement";
import * as ap from "./attendancePlans";

/** Block creation when it would push the org past its plan's child limit. */
async function assertChildCapacity(organizationId: number, adding: number) {
  const usage = await getOrganizationUsage(organizationId);
  if (usage?.maxChildren != null && usage.children + adding > usage.maxChildren) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Enrollment limit reached — your ${usage.subscriptionTier} plan allows ${usage.maxChildren} children (currently ${usage.children}). Raise the limit in Settings → Program or upgrade your plan.`,
    });
  }
}

/**
 * Record-level tenant check for routes keyed by a child id (not an org id, so
 * the org-scope middleware can't see them). Owner is exempt.
 */
async function assertChildInOrg(user: { openId: string; organizationId: number | null }, childId: number) {
  if (isPlatformOwner(user.openId)) return;
  const child = await getChildById(childId);
  if (!child || child.organizationId !== user.organizationId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to that record." });
  }
}

/** Record-level tenant check for non-child entities keyed by their own id. */
async function assertRecordInOrg(user: { openId: string; organizationId: number | null }, kind: mod.OrgRecordKind, id: number) {
  if (isPlatformOwner(user.openId)) return;
  const orgId = await mod.getRecordOrgId(kind, id);
  if (orgId == null || orgId !== user.organizationId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to that record." });
  }
}

/** Block creation when it would push the org past its plan's staff limit. */
async function assertStaffCapacity(organizationId: number, adding: number) {
  const usage = await getOrganizationUsage(organizationId);
  if (usage?.maxStaff != null && usage.staff + adding > usage.maxStaff) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Staff limit reached — your ${usage.subscriptionTier} plan allows ${usage.maxStaff} staff (currently ${usage.staff}). Raise the limit in Settings → Program or upgrade your plan.`,
    });
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => {
      if (!opts.ctx.user) return null;
      // Never expose the password hash (or let new sensitive columns leak by
      // default) — return an explicit allowlist of fields.
      const { id, openId, name, email, role, lastSignedIn, settings, avatarUrl, organizationId, familyId } = opts.ctx.user;
      // Surface whether a password is set (so the UI can adjust the change-password
      // flow) without ever returning the hash itself.
      const hasPassword = Boolean(opts.ctx.user.passwordHash);
      const isOwner = isPlatformOwner(opts.ctx.user.openId);
      return { id, openId, name, email, role, lastSignedIn, settings, avatarUrl, organizationId, familyId, hasPassword, isOwner };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      // Prevent the dev-auth bypass from immediately re-injecting a session after
      // an explicit sign-out. The opt-out cookie is cleared on the next real login.
      ctx.res.cookie("__sprout_no_bypass", "1", {
        httpOnly: true,
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000, // 24 h — reset on next sign-in
      });
      return {
        success: true,
      } as const;
    }),
    // Update the signed-in user's own editable profile (display name).
    updateProfile: protectedProcedure
      .input(z.object({ name: z.string().trim().min(1).max(120) }))
      .mutation(async ({ input, ctx }) => {
        await updateUserProfile(ctx.user.openId, { name: input.name });
        await auditAccess(ctx, { action: "update", resourceType: "user", resourceId: ctx.user.id, detail: "profile" });
        return { success: true, name: input.name };
      }),
    // Set or clear the signed-in user's profile picture. The client resizes/crops
    // to a small square and sends a base64 image data URL; null removes it.
    setAvatar: protectedProcedure
      .input(
        z.object({
          avatarUrl: z
            .string()
            .max(1_500_000, "Image is too large — pick a smaller picture.")
            .regex(/^data:image\/(png|jpeg|jpg|webp|gif);base64,/, "Unsupported image format.")
            .nullable(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await updateUserProfile(ctx.user.openId, { avatarUrl: input.avatarUrl });
        await auditAccess(ctx, { action: "update", resourceType: "user", resourceId: ctx.user.id, detail: input.avatarUrl ? "avatar" : "avatar:removed" });
        return { success: true };
      }),
    // Persist notification / 2FA preferences (merged into users.settings).
    updateSettings: protectedProcedure
      .input(
        z.object({
          twoFactorEnabled: z.boolean().optional(),
          notifications: z.record(z.string(), z.boolean()).optional(),
          // Chat translation: messages from families render in this language.
          preferredLanguage: z.enum(SUPPORTED_LANGUAGES).optional(),
          navigation: z
            .object({
              topNav: z.object({ order: z.array(z.string()).optional(), hidden: z.array(z.string()).optional() }).optional(),
              sideNav: z.object({ order: z.array(z.string()).optional(), hidden: z.array(z.string()).optional() }).optional(),
            })
            .optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const settings = await updateUserSettings(ctx.user.openId, input);
        await auditAccess(ctx, { action: "update", resourceType: "user", resourceId: ctx.user.id, detail: "settings" });
        return { success: true, settings };
      }),
    // Change the signed-in user's password. Verifies the current password when
    // one is already set; first-time set (OAuth-only accounts) skips that check.
    changePassword: protectedProcedure
      .input(
        z.object({
          currentPassword: z.string().optional(),
          newPassword: z.string().min(8).max(200),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Re-read the row so we verify against the persisted hash, not a stale one.
        const fresh = await getUserByOpenId(ctx.user.openId);
        const existingHash = fresh?.passwordHash ?? null;
        if (existingHash) {
          const ok = await verifyPassword(input.currentPassword ?? "", existingHash);
          if (!ok) {
            await auditAccess(ctx, { action: "update_failed", resourceType: "user", resourceId: ctx.user.id, detail: "password:bad_current" });
            throw new TRPCError({ code: "BAD_REQUEST", message: "Current password is incorrect." });
          }
        }
        await setUserPassword(ctx.user.openId, await hashPassword(input.newPassword));
        await auditAccess(ctx, { action: "update", resourceType: "user", resourceId: ctx.user.id, detail: "password" });
        return { success: true };
      }),
  }),

  organizations: router({
    list: staffProcedure.query(async ({ ctx }) => {
      return getUserOrganizations(ctx.user.id);
    }),
    getByAgencyId: publicProcedure
      .input(z.string())
      .query(async ({ input }) => {
        return getOrganizationByAgencyId(input);
      }),
    // Single organization by id — backs the editable Program settings panel.
    get: orgStaffProcedure
      .input(z.number())
      .query(async ({ input: id }) => {
        return getOrganizationById(id);
      }),
    // Live enrollment/staff counts vs plan limits — backs the Plan & Usage card.
    usage: orgStaffProcedure
      .input(z.number())
      .query(async ({ input: id }) => {
        return getOrganizationUsage(id);
      }),
    // ---- Platform-owner (super-admin) cross-org management ----
    listAll: superAdminProcedure.query(async () => {
      return getAllOrganizations();
    }),
    create: superAdminProcedure
      .input(
        z.object({
          name: z.string().trim().min(1).max(255),
          agencyId: z.string().trim().min(1).max(64),
          subscriptionTier: z.enum(["starter", "professional", "enterprise"]).optional(),
          maxChildren: z.number().int().min(0).max(100000).optional(),
          maxStaff: z.number().int().min(0).max(100000).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const existing = await getOrganizationByAgencyId(input.agencyId);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: `Agency ID "${input.agencyId}" is already in use.` });
        const result = await createOrganization({
          name: input.name,
          agencyId: input.agencyId,
          ownerId: ctx.user.id,
          subscriptionTier: input.subscriptionTier ?? "starter",
          maxChildren: input.maxChildren ?? 100,
          maxStaff: input.maxStaff ?? 20,
        });
        await auditAccess(ctx, { action: "create", resourceType: "organization", resourceId: result.id, detail: input.agencyId });
        return result;
      }),
    setActive: superAdminProcedure
      .input(z.object({ id: z.number(), isActive: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        await setOrganizationActive(input.id, input.isActive ? 1 : 0);
        await auditAccess(ctx, { action: "update", resourceType: "organization", resourceId: input.id, detail: input.isActive ? "activated" : "deactivated" });
        return { success: true };
      }),
    // Persist the editable program profile (admin only).
    update: orgAdminProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().trim().min(1).max(255).optional(),
          director: z.string().trim().max(160).nullable().optional(),
          directorEmail: z.string().trim().max(320).email().or(z.literal("")).nullable().optional(),
          phone: z.string().trim().max(32).nullable().optional(),
          address: z.string().trim().max(400).nullable().optional(),
          maxChildren: z.number().int().min(0).max(100000).optional(),
          maxStaff: z.number().int().min(0).max(100000).optional(),
          classroomCount: z.number().int().min(0).max(10000).nullable().optional(),
          subscriptionTier: z.enum(["starter", "professional", "enterprise"]).optional(),
          enabledModules: z.array(z.enum(MODULE_IDS)).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        // Org id is the `id` field here (not `organizationId`), so the scope
        // middleware can't auto-check it — enforce explicitly.
        if (!isPlatformOwner(ctx.user.openId) && ctx.user.organizationId !== id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to that organization." });
        }
        // Normalize empty director email to null so we don't store "".
        if (data.directorEmail === "") data.directorEmail = null;
        await updateOrganization(id, data);
        if (data.enabledModules) {
          // Module gates cache per-org module lists — bust so toggles apply immediately.
          invalidateModuleCache(id);
        }
        await auditAccess(ctx, {
          action: "update", resourceType: "organization", resourceId: id,
          detail: data.enabledModules ? `program_settings modules:${data.enabledModules.join(",") || "none"}` : "program_settings",
        });
        return { success: true };
      }),
  }),

  children: router({
    list: orgStaffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return getOrganizationChildren(organizationId);
      }),
    getById: staffProcedure
      .input(z.number())
      .query(async ({ input: childId, ctx }) => {
        const child = await getChildById(childId);
        if (!isPlatformOwner(ctx.user.openId) && (!child || child.organizationId !== ctx.user.organizationId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to that record." });
        }
        await auditAccess(ctx, { action: "read", resourceType: "child", resourceId: childId });
        return child;
      }),
    create: orgStaffProcedure
      .input(
        z.object({
          organizationId: z.number(),
          firstName: z.string().min(1),
          lastName: z.string().min(1),
          dateOfBirth: z.date().optional(),
          gender: z
            .enum(["male", "female", "other", "prefer_not_to_say"])
            .optional(),
          familyId: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await assertChildCapacity(input.organizationId, 1);
        const result = await createChild(input);
        await auditAccess(ctx, { action: "create", resourceType: "child", detail: `org:${input.organizationId}` });
        return result;
      }),
    // CSV bulk import: create many children at once from an uploaded sheet.
    bulkImport: orgStaffProcedure
      .input(
        z.object({
          organizationId: z.number(),
          rows: z
            .array(
              z.object({
                firstName: z.string().trim().min(1).max(100),
                lastName: z.string().trim().min(1).max(100),
                dateOfBirth: z.date().optional(),
                gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
                status: z.enum(["active", "inactive", "graduated", "withdrawn"]).optional(),
                notes: z.string().max(1000).optional(),
              })
            )
            .min(1)
            .max(1000),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await assertChildCapacity(input.organizationId, input.rows.length);
        const result = await bulkCreateChildren(
          input.rows.map((r) => ({ ...r, organizationId: input.organizationId }))
        );
        await auditAccess(ctx, { action: "create", resourceType: "child", detail: `bulk_import:${result.count}` });
        return result;
      }),
    siblings: staffProcedure
      .input(z.number())
      .query(async ({ input: familyId, ctx }) => {
        const siblings = await getFamilySiblings(familyId);
        // Children in a family share an org; block if they aren't this user's.
        if (!isPlatformOwner(ctx.user.openId) && siblings.some((c) => c.organizationId !== ctx.user.organizationId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to that record." });
        }
        return siblings;
      }),
    update: orgStaffProcedure
      .input(
        z.object({
          id: z.number(),
          firstName: z.string().min(1).optional(),
          lastName: z.string().min(1).optional(),
          dateOfBirth: z.date().optional(),
          gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
          status: z.enum(["active", "inactive", "graduated", "withdrawn"]).optional(),
          notes: z.string().optional(),
          // Sibling linking: move the child into a family (null = unlink).
          familyId: z.number().nullable().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await assertChildInOrg(ctx.user, id);
        if (data.familyId != null) {
          await assertRecordInOrg(ctx.user, "family", data.familyId);
        }
        await auditAccess(ctx, { action: "update", resourceType: "child", resourceId: id });
        return mod.updateChild(id, data);
      }),
    classroomMap: orgStaffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return mod.getChildClassroomMap(organizationId);
      }),
    // Color-coded safety flags for every child in the org.
    flags: orgStaffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return mod.getChildFlags(organizationId);
      }),
    addFlag: orgStaffProcedure
      .input(
        z.object({
          childId: z.number(),
          type: z.enum(["allergy", "dietary", "disability", "special"]),
          label: z.string().min(1).max(100),
          detail: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await assertChildInOrg(ctx.user, input.childId);
        await mod.addChildFlag(input);
        await auditAccess(ctx, { action: "create", resourceType: "child_flag", resourceId: input.childId, detail: `${input.type}:${input.label}` });
        return { success: true };
      }),
    removeFlag: orgStaffProcedure
      .input(z.object({ flagId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const childId = await mod.getChildIdForFlag(input.flagId);
        if (childId != null) await assertChildInOrg(ctx.user, childId);
        await mod.removeChildFlag(input.flagId);
        await auditAccess(ctx, { action: "delete", resourceType: "child_flag", resourceId: input.flagId });
        return { success: true };
      }),
  }),

  families: router({
    list: orgStaffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return mod.getOrganizationFamilies(organizationId);
      }),
    create: orgStaffProcedure
      .input(
        z.object({
          organizationId: z.number(),
          primaryContactName: z.string().min(1),
          primaryContactPhone: z.string().optional(),
          primaryContactEmail: z.string().optional(),
          secondaryContactName: z.string().optional(),
          address: z.string().optional(),
          city: z.string().optional(),
          state: z.string().max(2).optional(),
          zipCode: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return mod.createFamily(input);
      }),
    // Parent onboarding: generate a one-time code a parent uses in the family
    // app to create an account scoped to this family.
    createInvitation: orgStaffProcedure
      .input(
        z.object({
          organizationId: z.number(),
          familyId: z.number(),
          adultEmail: z.string().email().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const invitation = await createFamilyInvitation({
          ...input,
          createdBy: ctx.user.id,
        });
        await auditAccess(ctx, {
          action: "create",
          resourceType: "family_invitation",
          resourceId: input.familyId,
        });
        return invitation;
      }),
    invitations: orgStaffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return listFamilyInvitations(organizationId);
      }),
    contacts: staffProcedure
      .input(z.number())
      .query(async ({ input: familyId, ctx }) => {
        await assertRecordInOrg(ctx.user, "family", familyId);
        return mod.getFamilyContacts(familyId);
      }),
    // All family info is editable by ANY staff member in the family's own org
    // ("the corresponding staff") — admin is not required. The per-record
    // tenant check guarantees staff can only edit families in their own org.
    update: staffProcedure
      .input(
        z.object({
          id: z.number(),
          primaryContactName: z.string().min(1).optional(),
          primaryContactPhone: z.string().optional(),
          primaryContactEmail: z.string().optional(),
          secondaryContactName: z.string().optional(),
          secondaryContactPhone: z.string().optional(),
          address: z.string().optional(),
          city: z.string().optional(),
          state: z.string().max(2).optional(),
          zipCode: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await assertRecordInOrg(ctx.user, "family", input.id);
        const { id, ...fields } = input;
        await auditAccess(ctx, { action: "update", resourceType: "family", resourceId: id });
        return mod.updateFamily(id, fields);
      }),
  }),

  // One-upload roster migration: children + family contacts + health exam
  // dates from a single spreadsheet. See server/dataImport.ts.
  dataImport: router({
    roster: orgStaffProcedure
      .input(
        z.object({
          organizationId: z.number(),
          rows: z
            .array(
              z.object({
                firstName: z.string().trim().min(1).max(100),
                lastName: z.string().trim().min(1).max(100),
                dateOfBirth: z.date().optional(),
                gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
                status: z.enum(["active", "inactive", "graduated", "withdrawn"]).optional(),
                notes: z.string().max(1000).optional(),
                familyContactName: z.string().trim().max(100).optional(),
                familyContactPhone: z.string().trim().max(20).optional(),
                familyContactEmail: z.string().trim().max(320).optional(),
                secondaryContactName: z.string().trim().max(100).optional(),
                address: z.string().max(500).optional(),
                city: z.string().max(100).optional(),
                state: z.string().max(2).optional(),
                zipCode: z.string().max(10).optional(),
                health: z
                  .object({
                    physicalDate: z.date().optional(),
                    immunizationDate: z.date().optional(),
                    dentalDate: z.date().optional(),
                    visionDate: z.date().optional(),
                    hearingDate: z.date().optional(),
                  })
                  .optional(),
                healthProvider: z.string().max(255).optional(),
              })
            )
            .min(1)
            .max(1000),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await assertChildCapacity(input.organizationId, input.rows.length);
        const result = await importRoster(input.organizationId, input.rows);
        await auditAccess(ctx, {
          action: "create",
          resourceType: "child",
          detail: `roster_import:children=${result.childrenCreated},families=${result.familiesCreated},health=${result.healthRecordsCreated}`,
        });
        return result;
      }),
  }),

  // Family Advocate case-load management (supervisor control tower +
  // advocate "my families" queue). See server/caseloads.ts.
  caseloads: router({
    overview: hsAdminProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return getCaseloadOverview(organizationId);
      }),
    assign: hsAdminProcedure
      .input(
        z.object({
          organizationId: z.number(),
          familyIds: z.array(z.number()).min(1).max(500),
          advocateId: z.number().nullable(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const result = await assignAdvocate(input.organizationId, input.familyIds, input.advocateId);
        await auditAccess(ctx, {
          action: "update",
          resourceType: "family",
          detail: `caseload_assign:advocate=${input.advocateId ?? "none"}:families=${input.familyIds.length}`,
        });
        return result;
      }),
    mine: hsStaffProcedure
      .input(z.number())
      .query(async ({ input: organizationId, ctx }) => {
        const staffId = await mod.resolveStaffId(organizationId, ctx.user.id);
        if (staffId == null) return [];
        return getMyCaseload(organizationId, staffId);
      }),
    suggestions: hsAdminProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return suggestAssignments(organizationId);
      }),
    supervisorSummary: hsAdminProcedure
      .input(z.number())
      .mutation(async ({ input: organizationId, ctx }) => {
        const { ok, retryAfterSec } = rateLimit(`supervisor-summary:${ctx.user.id}`, 6, 60_000);
        if (!ok) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Try again in ${retryAfterSec}s.` });
        }
        const result = await generateSupervisorSummary(organizationId);
        if (!result) {
          throw new TRPCError({ code: "NOT_FOUND", message: "No advocates carry a case load yet — assign families first." });
        }
        await auditAccess(ctx, { action: "read", resourceType: "family", detail: "supervisor_summary" });
        return result;
      }),
  }),

  // Enrollment applications / waitlist. Triage prospective children and, on
  // approval, enroll them (creates real family + child records).
  enrollment: router({
    list: orgStaffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return mod.getEnrollmentApplications(organizationId);
      }),
    create: orgStaffProcedure
      .input(
        z.object({
          organizationId: z.number(),
          childFirstName: z.string().trim().min(1).max(100),
          childLastName: z.string().trim().min(1).max(100),
          dateOfBirth: z.date().optional(),
          gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
          parentName: z.string().trim().max(160).optional(),
          parentPhone: z.string().trim().max(32).optional(),
          parentEmail: z.string().trim().email().max(320).or(z.literal("")).optional(),
          address: z.string().trim().max(400).optional(),
          incomeLevel: z.enum(["below_100", "below_130", "below_185", "above_185"]).optional(),
          householdSize: z.number().int().min(1).max(30).optional(),
          priority: z.enum(["high", "medium", "low"]).optional(),
          notes: z.string().max(1000).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { parentEmail, ...rest } = input;
        const result = await mod.createEnrollmentApplication({
          ...rest,
          parentEmail: parentEmail ? parentEmail : null,
        });
        await auditAccess(ctx, { action: "create", resourceType: "enrollment_application", detail: `org:${input.organizationId}` });
        return result;
      }),
    setStatus: orgStaffProcedure
      .input(
        z.object({
          id: z.number(),
          organizationId: z.number(),
          status: z.enum(["pending", "reviewing", "approved", "denied"]).optional(),
          priority: z.enum(["high", "medium", "low"]).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, organizationId, ...data } = input;
        await mod.updateEnrollmentApplication(id, organizationId, data);
        await auditAccess(ctx, { action: "update", resourceType: "enrollment_application", resourceId: id, detail: JSON.stringify(data) });
        return { success: true };
      }),
    // Approve & enroll: materialize the application into family + child records.
    enroll: orgStaffProcedure
      .input(z.object({ id: z.number(), organizationId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await assertChildCapacity(input.organizationId, 1);
        const result = await mod.enrollApplication(input.id, input.organizationId);
        await auditAccess(ctx, { action: "create", resourceType: "child", resourceId: result.childId, detail: `enrolled_from_application:${input.id}` });
        return result;
      }),
  }),

  // In-kind (non-federal share) contributions toward the Head Start match.
  inKind: router({
    list: hsStaffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return mod.getInKindContributions(organizationId);
      }),
    create: hsStaffProcedure
      .input(
        z.object({
          organizationId: z.number(),
          type: z.enum(["volunteer", "goods", "services", "facility", "other"]),
          contributor: z.string().trim().min(1).max(200),
          description: z.string().trim().max(500).optional(),
          date: z.date(),
          hours: z.number().min(0).max(100000).optional(),
          value: z.number().min(0).max(100000000),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const result = await mod.createInKindContribution({
          organizationId: input.organizationId,
          type: input.type,
          contributor: input.contributor,
          description: input.description ?? null,
          date: input.date,
          hours: input.hours != null ? String(input.hours) : null,
          value: String(input.value),
          recordedBy: ctx.user.id,
        });
        await auditAccess(ctx, { action: "create", resourceType: "in_kind", detail: `${input.type}:${input.value}` });
        return result;
      }),
    delete: hsStaffProcedure
      .input(z.object({ id: z.number(), organizationId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await mod.deleteInKindContribution(input.id, input.organizationId);
        await auditAccess(ctx, { action: "delete", resourceType: "in_kind", resourceId: input.id });
        return { success: true };
      }),
  }),

  // Self-serve onboarding: anyone can request a program; the platform owner
  // reviews and approves (which provisions the organization).
  programRequests: router({
    create: publicProcedure
      .input(
        z.object({
          organizationName: z.string().trim().min(1).max(255),
          agencyId: z.string().trim().max(64).optional(),
          contactName: z.string().trim().min(1).max(160),
          contactEmail: z.string().trim().email().max(320),
          phone: z.string().trim().max(32).optional(),
          message: z.string().trim().max(1000).optional(),
        })
      )
      .mutation(async ({ input }) => {
        await mod.createProgramRequest({
          organizationName: input.organizationName,
          agencyId: input.agencyId || null,
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          phone: input.phone || null,
          message: input.message || null,
        });
        return { success: true };
      }),
    list: superAdminProcedure.query(async () => {
      return mod.getProgramRequests();
    }),
    approve: superAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const result = await mod.approveProgramRequest(input.id, ctx.user.id);
        await auditAccess(ctx, { action: "create", resourceType: "organization", resourceId: result.orgId, detail: `approved_request:${input.id}` });
        return result;
      }),
    decline: superAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await mod.declineProgramRequest(input.id);
        await auditAccess(ctx, { action: "update", resourceType: "program_request", resourceId: input.id, detail: "declined" });
        return { success: true };
      }),
  }),

  staff: router({
    list: orgStaffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return getOrganizationStaff(organizationId);
      }),
    // The signed-in user's own staff record (functional role + position) —
    // drives the role-aware experience (dashboard emphasis, default views).
    myRole: staffProcedure.query(async ({ ctx }) => {
      if (ctx.user.organizationId == null) return null;
      const staffId = await mod.resolveStaffId(ctx.user.organizationId, ctx.user.id);
      if (staffId == null) return null;
      const members = await getOrganizationStaff(ctx.user.organizationId);
      const me = members.find((m) => m.id === staffId);
      return me ? { staffId: me.id, role: me.role, position: me.position } : null;
    }),
    // Creating/modifying staff and their roles is an administrative action.
    // Admins manage everyone in the org; supervisory functional roles
    // (director, coordinators, family services manager) manage only the
    // employees who report to them. orgStaffProcedure lets both tiers in;
    // resolveStaffManagement enforces the actual boundary below.
    create: orgStaffProcedure
      .input(
        z.object({
          organizationId: z.number(),
          firstName: z.string().min(1),
          lastName: z.string().min(1),
          email: z.string().optional(),
          phone: z.string().optional(),
          position: z.string().optional(),
          supervisorId: z.number().optional(),
          role: z.enum([
            "admin", "director", "fiscal_officer",
            "education_coordinator", "coach",
            "health_coordinator", "nurse", "nutritionist", "mental_health_consultant",
            "disabilities_coordinator",
            "family_services_manager", "family_advocate", "home_visitor",
            "ersea_coordinator",
            "teacher", "assistant",
            "cook", "bus_driver",
            "coordinator",
          ]).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const mgmt = await mod.resolveStaffManagement({
          organizationId: input.organizationId,
          userId: ctx.user.id,
          accessTier: ctx.user.role,
        });
        if (!mgmt.allowed) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to add staff." });
        }
        await assertStaffCapacity(input.organizationId, 1);
        // A manager (non-admin) can only create people who report to them —
        // force the new hire's supervisor to the creating manager. Admins
        // may set any supervisor (or none).
        const supervisorId = mgmt.isAdmin ? input.supervisorId : (mgmt.actorStaffId ?? undefined);
        const result = await mod.createStaff({ ...input, supervisorId });
        await auditAccess(ctx, { action: "create", resourceType: "staff", detail: `org:${input.organizationId}` });
        return result;
      }),
    update: orgStaffProcedure
      .input(
        z.object({
          id: z.number(),
          organizationId: z.number(),
          firstName: z.string().min(1).optional(),
          lastName: z.string().min(1).optional(),
          email: z.string().optional(),
          phone: z.string().optional(),
          position: z.string().optional(),
          supervisorId: z.number().nullable().optional(),
          role: z.enum([
            "admin", "director", "fiscal_officer",
            "education_coordinator", "coach",
            "health_coordinator", "nurse", "nutritionist", "mental_health_consultant",
            "disabilities_coordinator",
            "family_services_manager", "family_advocate", "home_visitor",
            "ersea_coordinator",
            "teacher", "assistant",
            "cook", "bus_driver",
            "coordinator",
          ]).optional(),
          isActive: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, organizationId, ...data } = input;
        await assertRecordInOrg(ctx.user, "staff", id);
        const mgmt = await mod.resolveStaffManagement({
          organizationId,
          userId: ctx.user.id,
          accessTier: ctx.user.role,
          targetStaffId: id,
        });
        if (!mgmt.allowed) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You can only manage staff who report to you." });
        }
        // Only admins may reassign who an employee reports to; a manager
        // editing their report can't hand them to someone else.
        if (!mgmt.isAdmin && "supervisorId" in data) delete (data as Record<string, unknown>).supervisorId;
        await auditAccess(ctx, { action: "update", resourceType: "staff", resourceId: id });
        return mod.updateStaff(id, data);
      }),
  }),

  // Admin-defined staff role labels (e.g. "Family Advocate"). These are display
  // labels mapped to a fixed access tier — they never widen the RBAC enum.
  roles: router({
    list: orgStaffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return mod.getCustomRoles(organizationId);
      }),
    create: orgAdminProcedure
      .input(
        z.object({
          organizationId: z.number(),
          name: z.string().trim().min(1).max(100),
          description: z.string().max(500).optional(),
          accessLevel: z.enum(["staff", "admin"]).default("staff"),
          color: z.enum(["sage", "peach", "indigo", "amber", "red", "blue"]).default("sage"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const result = await mod.createCustomRole(input);
        await auditAccess(ctx, { action: "create", resourceType: "custom_role", resourceId: result.id, detail: `${input.name}:${input.accessLevel}` });
        return result;
      }),
    delete: orgAdminProcedure
      .input(z.object({ id: z.number(), organizationId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await mod.deleteCustomRole(input.id, input.organizationId);
        await auditAccess(ctx, { action: "delete", resourceType: "custom_role", resourceId: input.id });
        return { success: true };
      }),
  }),

  classrooms: router({
    list: orgStaffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return mod.getOrganizationClassrooms(organizationId);
      }),
    roster: staffProcedure
      .input(z.number())
      .query(async ({ input: classroomId, ctx }) => {
        await assertRecordInOrg(ctx.user, "classroom", classroomId);
        return mod.getClassroomRoster(classroomId);
      }),
    // Move a child between rooms (null classroomId = unassign).
    assignChild: orgStaffProcedure
      .input(z.object({ childId: z.number(), classroomId: z.number().nullable() }))
      .mutation(async ({ input, ctx }) => {
        await assertChildInOrg(ctx.user, input.childId);
        if (input.classroomId != null) await assertRecordInOrg(ctx.user, "classroom", input.classroomId);
        await mod.assignChildToClassroom(input.childId, input.classroomId);
        await auditAccess(ctx, {
          action: "update",
          resourceType: "child",
          resourceId: input.childId,
          detail: input.classroomId != null ? `assigned to classroom ${input.classroomId}` : "unassigned from classroom",
        });
        return { success: true };
      }),
  }),

  attendance: router({
    getByDate: orgStaffProcedure
      .input(
        z.object({
          organizationId: z.number(),
          date: z.date(),
        })
      )
      .query(async ({ input }) => {
        return getAttendanceByDate(input.organizationId, input.date);
      }),
    getRange: orgStaffProcedure
      .input(
        z.object({
          organizationId: z.number(),
          start: z.date(),
          end: z.date(),
        })
      )
      .query(async ({ input }) => {
        return mod.getAttendanceRange(input.organizationId, input.start, input.end);
      }),
    // Kiosk: one-tap check-in/out for a single child (upsert, today only).
    mark: orgStaffProcedure
      .input(
        z.object({
          organizationId: z.number(),
          childId: z.number(),
          action: z.enum(["check_in", "check_out", "absent"]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await assertChildInOrg(ctx.user, input.childId);
        return mod.markAttendance(input.organizationId, input.childId, input.action, ctx.user.id);
      }),
    save: orgStaffProcedure
      .input(
        z.object({
          organizationId: z.number(),
          date: z.date(),
          records: z.array(
            z.object({
              childId: z.number(),
              status: z.enum(["present", "absent", "excused", "half_day"]),
              checkInTime: z.date().nullable().optional(),
              checkOutTime: z.date().nullable().optional(),
              notes: z.string().nullable().optional(),
            })
          ),
        })
      )
      .mutation(async ({ input }) => {
        const result = await mod.saveAttendanceForDate(input.organizationId, input.date, input.records);
        // Fire-and-forget: flag children who just crossed the chronic-absence
        // threshold (insight + staff push). Head Start orgs only — the 85%
        // benchmark is a §1302.16 concept.
        void (async () => {
          try {
            if (await orgHasModule(input.organizationId, "head_start")) {
              await checkChronicAbsenceAlerts(input.organizationId);
            }
          } catch (e) {
            console.warn("[Attendance] chronic-absence check failed:", e);
          }
        })();
        return result;
      }),
  }),

  // Health compliance deadlines (Head Start §1302.42: 45-day screening / 90-day dental).
  healthDeadlines: router({
    summary: hsStaffProcedure
      .input(z.object({ organizationId: z.number() }))
      .query(async ({ input }) => {
        return getHealthDeadlineSummary(input.organizationId);
      }),
  }),

  // Chronic Absence Alert System (Head Start §1302.16 attendance analysis).
  chronicAbsence: router({
    summary: hsStaffProcedure
      .input(
        z.object({
          organizationId: z.number(),
          windowDays: z.number().int().min(7).max(120).optional(),
        })
      )
      .query(async ({ input }) => {
        return getChronicAbsenceSummary(input.organizationId, input.windowDays ?? 30);
      }),
  }),

  // CLASS / ECERS classroom quality observations.
  classroomQuality: router({
    list: hsStaffProcedure
      .input(z.object({ organizationId: z.number() }))
      .query(async ({ input }) => listAssessments(input.organizationId)),
    create: hsStaffProcedure
      .input(
        z.object({
          organizationId: z.number(),
          classroomId: z.number(),
          tool: z.enum(["class", "ecers"]),
          assessmentDate: z.date(),
          observer: z.string().max(200).nullable().optional(),
          scores: z.record(z.string(), z.number().min(1).max(7)),
          coachingNotes: z.string().max(10000).nullable().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await auditAccess(ctx, {
          action: "create",
          resourceType: "classroom_assessment",
          resourceId: String(input.classroomId),
          detail: input.tool,
        });
        return createAssessment(input);
      }),
  }),

  // Grant & budget compliance (burn rate, 20% non-federal share, carryover).
  grantBudget: router({
    summary: hsAdminProcedure
      .input(z.object({ organizationId: z.number(), fiscalYear: z.string().regex(/^\d{4}-\d{4}$/) }))
      .query(async ({ input }) => getGrantSummary(input.organizationId, input.fiscalYear)),
    setBudgetLine: hsAdminProcedure
      .input(
        z.object({
          organizationId: z.number(),
          fiscalYear: z.string().regex(/^\d{4}-\d{4}$/),
          category: z.enum(GRANT_CATEGORIES),
          budgetedCents: z.number().int().min(0).max(2_000_000_000),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await auditAccess(ctx, { action: "update", resourceType: "grant_budget", resourceId: `${input.fiscalYear}/${input.category}` });
        return setBudgetLine(input);
      }),
    addExpense: hsAdminProcedure
      .input(
        z.object({
          organizationId: z.number(),
          fiscalYear: z.string().regex(/^\d{4}-\d{4}$/),
          category: z.enum(GRANT_CATEGORIES),
          description: z.string().min(1).max(500),
          amountCents: z.number().int().min(1).max(2_000_000_000),
          expenseDate: z.date(),
          nonFederalShare: z.boolean(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await auditAccess(ctx, { action: "create", resourceType: "grant_expense", resourceId: `${input.fiscalYear}/${input.category}`, detail: input.description.slice(0, 80) });
        return addExpense(input);
      }),
  }),

  // IEP/IFSP coordination (Head Start §1302.60–63).
  disabilityServices: router({
    summary: hsStaffProcedure
      .input(z.object({ organizationId: z.number() }))
      .query(async ({ input }) => ds.getDisabilitySummary(input.organizationId)),
    upsert: hsStaffProcedure
      .input(
        z.object({
          id: z.number().nullable().optional(),
          organizationId: z.number(),
          childId: z.number(),
          planType: z.enum(["iep", "ifsp", "section_504"]),
          status: z.enum(["pending_evaluation", "active", "expired", "exited"]).optional(),
          primaryDisability: z.string().max(200).nullable().optional(),
          effectiveDate: z.date().nullable().optional(),
          expirationDate: z.date().nullable().optional(),
          leaAgency: z.string().max(200).nullable().optional(),
          leaContact: z.string().max(200).nullable().optional(),
          notes: z.string().max(5000).nullable().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await auditAccess(ctx, {
          action: input.id ? "update" : "create",
          resourceType: "disability_service",
          resourceId: String(input.childId),
          detail: input.planType,
        });
        return ds.upsertDisabilityRecord(input);
      }),
    markParentRights: hsStaffProcedure
      .input(z.object({ id: z.number(), organizationId: z.number(), language: z.string().min(1).max(32) }))
      .mutation(async ({ input, ctx }) => {
        await auditAccess(ctx, { action: "update", resourceType: "disability_service", resourceId: String(input.id), detail: "parent_rights" });
        return ds.markParentRights(input);
      }),
    setTransition: hsStaffProcedure
      .input(z.object({ id: z.number(), organizationId: z.number(), steps: z.array(z.string()).max(10) }))
      .mutation(async ({ input, ctx }) => {
        await auditAccess(ctx, { action: "update", resourceType: "disability_service", resourceId: String(input.id), detail: "transition" });
        return ds.setTransitionChecklist(input);
      }),
  }),

  // Policy Council (Head Start §1302.50–51).
  policyCouncil: router({
    members: hsStaffProcedure
      .input(z.object({ organizationId: z.number() }))
      .query(async ({ input }) => pc.listMembers(input.organizationId)),
    addMember: hsStaffProcedure
      .input(
        z.object({
          organizationId: z.number(),
          name: z.string().min(1).max(200),
          memberType: z.enum(["parent", "community_rep"]),
          councilRole: z.enum(["chair", "vice_chair", "secretary", "treasurer", "member"]).optional(),
          familyId: z.number().nullable().optional(),
          termStart: z.date().nullable().optional(),
          termEnd: z.date().nullable().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await auditAccess(ctx, { action: "create", resourceType: "policy_council_member", resourceId: input.name });
        return pc.addMember(input);
      }),
    updateMember: hsStaffProcedure
      .input(
        z.object({
          id: z.number(),
          organizationId: z.number(),
          councilRole: z.enum(["chair", "vice_chair", "secretary", "treasurer", "member"]).optional(),
          status: z.enum(["active", "ended"]).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await auditAccess(ctx, { action: "update", resourceType: "policy_council_member", resourceId: String(input.id) });
        return pc.updateMember(input);
      }),
    meetings: hsStaffProcedure
      .input(z.object({ organizationId: z.number() }))
      .query(async ({ input }) => pc.listMeetings(input.organizationId)),
    addMeeting: hsStaffProcedure
      .input(
        z.object({
          organizationId: z.number(),
          meetingDate: z.date(),
          title: z.string().min(1).max(255),
          minutes: z.string().max(20000).nullable().optional(),
          attendeeCount: z.number().int().min(0).max(500).optional(),
          quorumMet: z.boolean().optional(),
          actionItems: z.array(z.string().min(1).max(500)).max(30).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await auditAccess(ctx, { action: "create", resourceType: "policy_council_meeting", resourceId: input.title });
        return pc.addMeeting(input);
      }),
  }),

  // Suspension/expulsion documentation (Head Start §1302.17).
  suspensionLog: router({
    list: hsStaffProcedure
      .input(z.object({ organizationId: z.number() }))
      .query(async ({ input }) => listIncidents(input.organizationId)),
    create: hsStaffProcedure
      .input(
        z.object({
          organizationId: z.number(),
          childId: z.number(),
          incidentDate: z.date(),
          type: z.enum(["temporary_suspension", "expulsion_prevented", "transition_out"]),
          description: z.string().min(1).max(5000),
          stepsTaken: z.array(z.string()).max(10).optional(),
          outcome: z.string().max(5000).nullable().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await auditAccess(ctx, {
          action: "create",
          resourceType: "suspension_expulsion_log",
          resourceId: String(input.childId),
          detail: input.type,
        });
        return createIncident(input);
      }),
    update: hsStaffProcedure
      .input(
        z.object({
          id: z.number(),
          organizationId: z.number(),
          stepsTaken: z.array(z.string()).max(10).optional(),
          outcome: z.string().max(5000).nullable().optional(),
          status: z.enum(["open", "resolved"]).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await auditAccess(ctx, {
          action: "update",
          resourceType: "suspension_expulsion_log",
          resourceId: String(input.id),
        });
        return updateIncident(input);
      }),
  }),

  // Family Partnership Agreements (Head Start §1302.52).
  fpa: router({
    list: hsStaffProcedure
      .input(z.object({ organizationId: z.number() }))
      .query(async ({ input }) => {
        return listFpas(input.organizationId);
      }),
    detail: hsStaffProcedure
      .input(z.object({ organizationId: z.number(), familyId: z.number() }))
      .query(async ({ input }) => {
        return getFpaDetail(input.organizationId, input.familyId);
      }),
    upsert: hsStaffProcedure
      .input(
        z.object({
          organizationId: z.number(),
          familyId: z.number(),
          status: z.enum(["draft", "active", "review_due", "completed", "expired"]).optional(),
          strengths: z.array(z.string().min(1).max(255)).max(20).optional(),
          needsAssessment: z.string().max(5000).nullable().optional(),
          targetVisits: z.number().int().min(1).max(52).optional(),
          reviewDate: z.date().nullable().optional(),
          parentSigned: z.boolean().optional(),
          staffSigned: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return upsertFpa(input);
      }),
  }),

  dashboard: router({
    stats: orgStaffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return mod.getDashboardStats(organizationId);
      }),
    // Aggregated actionable alerts for the notification bell (shared with iOS).
    alerts: staffProcedure.query(async ({ ctx }) => {
      const data = await computeDashboard(ctx.user);
      return data?.alerts ?? [];
    }),
  }),

  calendar: router({
    list: orgStaffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return mod.getCalendarEvents(organizationId);
      }),
    create: orgStaffProcedure
      .input(
        z.object({
          organizationId: z.number(),
          title: z.string().min(1),
          description: z.string().optional(),
          eventType: z.enum(["holiday", "school_event", "parent_event", "staff_training", "deadline", "other"]).optional(),
          startDate: z.date(),
          endDate: z.date().optional(),
          location: z.string().optional(),
          allDay: z.number().optional(),
          color: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return mod.createCalendarEvent(input);
      }),
    update: orgStaffProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().min(1).optional(),
          description: z.string().optional(),
          eventType: z.enum(["holiday", "school_event", "parent_event", "staff_training", "deadline", "other"]).optional(),
          startDate: z.date().optional(),
          location: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await assertRecordInOrg(ctx.user, "calendarEvent", id);
        return mod.updateCalendarEvent(id, data);
      }),
    delete: staffProcedure
      .input(z.number())
      .mutation(async ({ input: id, ctx }) => {
        await assertRecordInOrg(ctx.user, "calendarEvent", id);
        return mod.deleteCalendarEvent(id);
      }),
  }),

  notes: router({
    list: orgStaffProcedure
      .input(z.object({ organizationId: z.number(), childId: z.number().optional() }))
      .query(async ({ input }) => {
        return mod.getStudentNotes(input.organizationId, input.childId);
      }),
    create: orgStaffProcedure
      .input(
        z.object({
          organizationId: z.number(),
          childId: z.number(),
          title: z.string().min(1),
          content: z.string().min(1),
          priority: z.enum(["low", "medium", "high", "critical"]).optional(),
          isPinned: z.number().optional(),
          category: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return mod.createStudentNote(input);
      }),
  }),

  documents: router({
    list: orgStaffProcedure
      .input(z.object({ organizationId: z.number(), childId: z.number().optional() }))
      .query(async ({ input }) => {
        return mod.getDocuments(input.organizationId, input.childId);
      }),
    create: orgStaffProcedure
      .input(
        z.object({
          organizationId: z.number(),
          childId: z.number(),
          documentType: z.enum(["birth_certificate", "immunization_record", "consent_form", "medical_record", "assessment", "other", "iep", "enrollment"]),
          fileName: z.string().min(1),
          fileUrl: z.string().min(1),
          fileSize: z.number().optional(),
          mimeType: z.string().optional(),
          expiryDate: z.date().optional(),
          // Resolved server-side from the signed-in user when omitted.
          uploadedBy: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await assertChildInOrg(ctx.user, input.childId);
        const uploadedBy = input.uploadedBy ?? (await mod.resolveStaffId(ctx.user.organizationId, ctx.user.id));
        if (uploadedBy == null) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No staff record to attribute the upload to." });
        }
        return mod.createDocument({
          ...input,
          organizationId: ctx.user.organizationId ?? input.organizationId,
          uploadedBy,
        });
      }),
    delete: staffProcedure
      .input(z.number())
      .mutation(async ({ input: id, ctx }) => {
        await assertRecordInOrg(ctx.user, "document", id);
        return mod.deleteDocument(id);
      }),
  }),

  digitalDocuments: router({
    list: orgStaffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return mod.getDigitalDocuments(organizationId);
      }),
    create: orgStaffProcedure
      .input(
        z.object({
          organizationId: z.number(),
          familyId: z.number(),
          documentType: z.enum(["enrollment", "consent", "waiver", "health_form", "iep"]),
          documentUrl: z.string().min(1),
          expiresAt: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return mod.createDigitalDocument({
          ...input,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        });
      }),
    sign: orgStaffProcedure
      .input(z.object({ id: z.number(), signedBy: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        await assertRecordInOrg(ctx.user, "digitalDocument", input.id);
        return mod.signDigitalDocument(input.id, input.signedBy);
      }),
  }),

  billing: router({
    invoices: orgStaffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return mod.getInvoices(organizationId);
      }),
    // Financial mutations are administrative (segregation of duties).
    createInvoice: orgAdminProcedure
      .input(
        z.object({
          organizationId: z.number(),
          familyId: z.number(),
          invoiceNumber: z.string().min(1),
          amount: z.string(),
          dueDate: z.string(),
          status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]).optional(),
          description: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await auditAccess(ctx, { action: "create", resourceType: "invoice", detail: `family:${input.familyId}` });
        return mod.createInvoice({ ...input, dueDate: new Date(input.dueDate) });
      }),
    payments: orgStaffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return mod.getPayments(organizationId);
      }),
    recordPayment: orgAdminProcedure
      .input(
        z.object({
          invoiceId: z.number(),
          organizationId: z.number(),
          amount: z.string(),
          paymentMethod: z.enum(["credit_card", "ach", "check", "cash"]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await auditAccess(ctx, { action: "create", resourceType: "payment", resourceId: input.invoiceId });
        return mod.recordPayment(input);
      }),
    // Recurring tuition plans → auto-generated invoices.
    plans: orgStaffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return getBillingPlans(organizationId);
      }),
    createPlan: orgAdminProcedure
      .input(
        z.object({
          organizationId: z.number(),
          familyId: z.number(),
          childId: z.number().nullable().optional(),
          name: z.string().min(1).max(200),
          amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter a dollar amount like 850 or 850.50"),
          frequency: z.enum(["weekly", "biweekly", "monthly"]),
          nextInvoiceDate: z.string(),
          notes: z.string().max(1000).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await auditAccess(ctx, { action: "create", resourceType: "billing_plan", detail: `family:${input.familyId}` });
        return createBillingPlan({ ...input, childId: input.childId ?? undefined, nextInvoiceDate: new Date(input.nextInvoiceDate) });
      }),
    setPlanActive: orgAdminProcedure
      .input(z.object({ id: z.number(), organizationId: z.number(), isActive: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        await auditAccess(ctx, { action: "update", resourceType: "billing_plan", resourceId: input.id, detail: input.isActive ? "activate" : "pause" });
        return setBillingPlanActive(input.id, input.organizationId, input.isActive);
      }),
    generateInvoices: orgAdminProcedure
      .input(z.number())
      .mutation(async ({ input: organizationId, ctx }) => {
        const result = await generateDueInvoices(organizationId);
        await auditAccess(ctx, { action: "create", resourceType: "invoice", detail: `auto_generate:${result.created}` });
        return result;
      }),
    aging: orgStaffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return getArAging(organizationId);
      }),
  }),

  meals: router({
    plans: orgStaffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return mod.getMealPlans(organizationId);
      }),
    items: staffProcedure
      .input(z.number())
      .query(async ({ input: mealPlanId, ctx }) => {
        await assertRecordInOrg(ctx.user, "mealPlan", mealPlanId);
        return mod.getMealItems(mealPlanId);
      }),
    createPlan: orgStaffProcedure
      .input(
        z.object({
          organizationId: z.number(),
          classroomId: z.number(),
          weekStartDate: z.string(),
          items: z.array(
            z.object({
              dayOfWeek: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday"]),
              mealType: z.enum(["breakfast", "snack", "lunch", "afternoon_snack"]),
              description: z.string().min(1),
              servings: z.number().optional(),
            })
          ),
        })
      )
      .mutation(async ({ input }) => {
        const { items, ...plan } = input;
        // Anchor to local midnight so a YYYY-MM-DD date isn't shifted a day by UTC parsing.
        return mod.createMealPlan({ ...plan, weekStartDate: new Date(plan.weekStartDate + "T00:00:00") }, items);
      }),
    updatePlanStatus: orgStaffProcedure
      .input(z.object({ id: z.number(), status: z.enum(["draft", "approved", "served"]) }))
      .mutation(async ({ input, ctx }) => {
        // CACFP plan APPROVAL is an administrative sign-off; staff may still
        // draft plans and mark them served day-to-day.
        if (input.status === "approved" && ctx.user.role !== "admin") {
          await auditAccess(ctx, {
            action: "update",
            resourceType: "rbac",
            resourceId: "meals.updatePlanStatus",
            detail: `role=${ctx.user.role} required=admin for approval`,
          });
          throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
        }
        await assertRecordInOrg(ctx.user, "mealPlan", input.id);
        return mod.updateMealPlanStatus(input.id, input.status);
      }),
    cacfpReports: orgStaffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return mod.getCacfpReports(organizationId);
      }),
  }),

  lessonPlanning: router({
    list: orgStaffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => mod.getLessonPlans(organizationId)),
    get: staffProcedure
      .input(z.number())
      .query(async ({ input: id, ctx }) => {
        await assertRecordInOrg(ctx.user, "lessonPlan", id);
        return mod.getLessonPlan(id);
      }),
    createPlan: orgStaffProcedure
      .input(z.object({
        organizationId: z.number(),
        classroomId: z.number(),
        weekStartDate: z.string(),
        title: z.string().optional(),
        theme: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await auditAccess(ctx, { action: "create", resourceType: "lesson_plan", detail: `org:${input.organizationId}` });
        return mod.createLessonPlan({
          organizationId: input.organizationId,
          classroomId: input.classroomId,
          // Anchor to local midnight so a YYYY-MM-DD date isn't shifted a day by UTC parsing.
          weekStartDate: new Date(input.weekStartDate + "T00:00:00"),
          title: input.title,
          theme: input.theme,
        });
      }),
    updatePlan: staffProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        theme: z.string().optional(),
        status: z.enum(["draft", "published"]).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await assertRecordInOrg(ctx.user, "lessonPlan", input.id);
        const { id, ...fields } = input;
        return mod.updateLessonPlan(id, fields);
      }),
    addActivity: staffProcedure
      .input(z.object({
        lessonPlanId: z.number(),
        dayOfWeek: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday"]),
        title: z.string().min(1),
        description: z.string().optional(),
        domain: z.enum(["social_emotional", "language_literacy", "cognition", "physical", "creative_arts", "approaches_to_learning"]).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await assertRecordInOrg(ctx.user, "lessonPlan", input.lessonPlanId);
        return mod.addLessonActivity(input);
      }),
    deleteActivity: staffProcedure
      .input(z.object({ id: z.number(), lessonPlanId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await assertRecordInOrg(ctx.user, "lessonPlan", input.lessonPlanId);
        return mod.deleteLessonActivity(input.id);
      }),
  }),

  portfolios: router({
    byChild: staffProcedure
      .input(z.number())
      .query(async ({ input: childId, ctx }) => {
        await assertChildInOrg(ctx.user, childId);
        return mod.getPortfolioEntries(childId);
      }),
    create: orgStaffProcedure
      .input(z.object({
        organizationId: z.number(),
        childId: z.number(),
        title: z.string().min(1),
        observation: z.string().optional(),
        domain: z.enum(["social_emotional", "language_literacy", "cognition", "physical", "creative_arts", "approaches_to_learning"]).optional(),
        observedAt: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await assertChildInOrg(ctx.user, input.childId);
        const createdBy = await mod.resolveStaffId(ctx.user.organizationId, ctx.user.id);
        await auditAccess(ctx, { action: "create", resourceType: "portfolio_entry", resourceId: input.childId });
        return mod.createPortfolioEntry({
          organizationId: input.organizationId,
          childId: input.childId,
          title: input.title,
          observation: input.observation,
          domain: input.domain,
          observedAt: input.observedAt ? new Date(input.observedAt + "T00:00:00") : undefined,
          createdBy: createdBy ?? undefined,
        });
      }),
    delete: staffProcedure
      .input(z.number())
      .mutation(async ({ input: id, ctx }) => {
        await assertRecordInOrg(ctx.user, "portfolioEntry", id);
        return mod.deletePortfolioEntry(id);
      }),
  }),

  subsidies: router({
    list: orgStaffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => mod.getSubsidies(organizationId)),
    create: orgStaffProcedure
      .input(z.object({
        organizationId: z.number(),
        familyId: z.number(),
        agencyName: z.string().min(1),
        caseNumber: z.string().optional(),
        authorizedAmount: z.string().optional(),
        copayAmount: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        status: z.enum(["active", "pending", "expired"]).optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await assertRecordInOrg(ctx.user, "family", input.familyId);
        await auditAccess(ctx, { action: "create", resourceType: "subsidy", resourceId: input.familyId });
        return mod.createSubsidy({
          organizationId: input.organizationId,
          familyId: input.familyId,
          agencyName: input.agencyName,
          caseNumber: input.caseNumber,
          authorizedAmount: input.authorizedAmount,
          copayAmount: input.copayAmount,
          startDate: input.startDate ? new Date(input.startDate + "T00:00:00") : undefined,
          endDate: input.endDate ? new Date(input.endDate + "T00:00:00") : undefined,
          status: input.status,
          notes: input.notes,
        });
      }),
    update: staffProcedure
      .input(z.object({
        id: z.number(),
        agencyName: z.string().min(1).optional(),
        caseNumber: z.string().optional(),
        authorizedAmount: z.string().optional(),
        copayAmount: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        status: z.enum(["active", "pending", "expired"]).optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await assertRecordInOrg(ctx.user, "subsidy", input.id);
        const { id, startDate, endDate, ...rest } = input;
        return mod.updateSubsidy(id, {
          ...rest,
          ...(startDate ? { startDate: new Date(startDate + "T00:00:00") } : {}),
          ...(endDate ? { endDate: new Date(endDate + "T00:00:00") } : {}),
        });
      }),
    delete: staffProcedure
      .input(z.number())
      .mutation(async ({ input: id, ctx }) => {
        await assertRecordInOrg(ctx.user, "subsidy", id);
        return mod.deleteSubsidy(id);
      }),
  }),

  staffOps: router({
    timeClock: orgStaffProcedure
      .input(z.object({ organizationId: z.number(), sinceDays: z.number().optional() }))
      .query(async ({ input }) => {
        return mod.getTimeClockEntries(input.organizationId, input.sinceDays);
      }),
    clockIn: staffProcedure
      .input(z.number())
      .mutation(async ({ input: staffId, ctx }) => {
        await assertRecordInOrg(ctx.user, "staff", staffId);
        return mod.clockIn(staffId);
      }),
    clockOut: staffProcedure
      .input(z.number())
      .mutation(async ({ input: entryId, ctx }) => {
        const orgId = await mod.getTimeClockEntryOrgId(entryId);
        if (!isPlatformOwner(ctx.user.openId) && (orgId == null || orgId !== ctx.user.organizationId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to that record." });
        }
        return mod.clockOut(entryId);
      }),
    certifications: orgStaffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return mod.getCertifications(organizationId);
      }),
    // Expired/expiring-soon counts — backs the Staff Ops summary card and the Action Queue.
    certificationExpirySummary: orgStaffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return mod.getCertificationExpirySummary(organizationId);
      }),
    // Certification (HR training) records are administrative.
    createCertification: orgAdminProcedure
      .input(
        z.object({
          staffId: z.number(),
          certificationType: z.string().min(1),
          issueDate: z.string(),
          expiryDate: z.string(),
          certificationNumber: z.string().optional(),
          status: z.enum(["active", "expiring_soon", "expired"]).optional(),
        })
      )
      .mutation(async ({ input }) => {
        return mod.createCertification({
          ...input,
          issueDate: new Date(input.issueDate),
          expiryDate: new Date(input.expiryDate),
        });
      }),
  }),

  aiInsights: router({
    list: orgStaffProcedure
      .input(z.object({ organizationId: z.number(), includeDismissed: z.boolean().optional() }))
      .query(async ({ input }) => {
        return mod.getAiInsights(input.organizationId, input.includeDismissed);
      }),
    dismiss: staffProcedure
      .input(z.number())
      .mutation(async ({ input: id, ctx }) => {
        await assertRecordInOrg(ctx.user, "aiInsight", id);
        return mod.dismissAiInsight(id);
      }),
  }),

  bulkActions: router({
    logs: orgStaffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return mod.getBulkActionLogs(organizationId);
      }),
    // Mass mutation across an entire classroom roster — restricted to admins.
    bulkAttendance: orgAdminProcedure
      .input(
        z.object({
          organizationId: z.number(),
          classroomId: z.number(),
          date: z.date(),
          status: z.enum(["present", "absent", "excused", "half_day"]),
          // Resolved server-side from the signed-in user when omitted.
          performedBy: z.number().optional(),
          description: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await assertRecordInOrg(ctx.user, "classroom", input.classroomId);
        const performedBy = input.performedBy ?? (await mod.resolveStaffId(ctx.user.organizationId, ctx.user.id));
        if (performedBy == null) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No staff record to attribute this action to." });
        }
        const orgId = ctx.user.organizationId ?? input.organizationId;
        const roster = await mod.getClassroomRoster(input.classroomId);
        await mod.saveAttendanceForDate(
          orgId,
          input.date,
          roster.map(c => ({ childId: c.id, status: input.status })),
          performedBy
        );
        await mod.createBulkActionLog({
          organizationId: orgId,
          classroomId: input.classroomId,
          actionType: "bulk_attendance",
          description: input.description ?? `Marked ${roster.length} children ${input.status}`,
          recordCount: roster.length,
          status: "completed",
          performedBy,
        });
        return { affected: roster.length };
      }),
  }),

  parentPortal: router({
    activities: orgStaffProcedure
      .input(z.object({ organizationId: z.number(), childId: z.number().optional() }))
      .query(async ({ input }) => {
        return mod.getActivityLogs(input.organizationId, input.childId);
      }),
    logActivity: orgStaffProcedure
      .input(
        z.object({
          childId: z.number(),
          // staffId is resolved server-side from the signed-in user; clients
          // don't supply it. Kept optional for callers that already know it.
          staffId: z.number().optional(),
          activityType: z.enum(["meal", "nap", "diaper", "activity", "note", "photo"]),
          description: z.string().min(1),
          // Optional image/video as a base64 data URL. Persisted to the storage
          // proxy when configured (small URL stored); images fall back to the
          // data URL in dev. ~30MB cap covers short clips.
          mediaUrl: z.string().regex(/^data:(image|video)\//, "Unsupported media format.").max(30_000_000).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await assertChildInOrg(ctx.user, input.childId);
        const staffId = input.staffId ?? (await mod.resolveStaffId(ctx.user.organizationId, ctx.user.id));
        if (staffId == null) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No staff record available to attribute this entry to." });
        }
        let mediaUrl: string | undefined;
        let mediaType: "image" | "video" | undefined;
        if (input.mediaUrl) {
          try {
            const media = await persistMediaDataUrl(input.mediaUrl);
            mediaUrl = media.url; mediaType = media.mediaType;
          } catch (e) {
            throw new TRPCError({ code: "BAD_REQUEST", message: e instanceof Error ? e.message : "Couldn't save media." });
          }
        }
        const created = await mod.createActivityLog({ childId: input.childId, staffId, activityType: input.activityType, description: input.description, mediaUrl, mediaType });
        void notifyMomentPosted(input.childId, input.description); // fire-and-forget push to the family
        return created;
      }),
    // Pull back a mis-logged moment (families see the feed in real time).
    deleteActivity: orgStaffProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const result = await mod.deleteActivityLog(input.id, ctx.user.organizationId!);
        if (!result.deleted) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Moment not found." });
        }
        await auditAccess(ctx, { action: "delete", resourceType: "activity_log", resourceId: input.id });
        return result;
      }),
    notifications: staffProcedure
      .input(z.number())
      .query(async ({ input: familyId, ctx }) => {
        await assertRecordInOrg(ctx.user, "family", familyId);
        return mod.getParentNotifications(familyId);
      }),
    // Parent-facing feed: the signed-in family's own children's moments +
    // notifications. parentProcedure guarantees ctx.user.familyId is set.
    myActivities: parentProcedure.query(async ({ ctx }) => {
      return mod.getFamilyActivityLogs(ctx.user.familyId);
    }),
    myNotifications: parentProcedure.query(async ({ ctx }) => {
      return mod.getParentNotifications(ctx.user.familyId);
    }),
    markRead: staffProcedure
      .input(z.number())
      .mutation(async ({ input: id, ctx }) => {
        const familyId = await mod.getNotificationFamilyId(id);
        if (familyId == null) throw new TRPCError({ code: "NOT_FOUND", message: "Notification not found" });
        await assertRecordInOrg(ctx.user, "family", familyId);
        return mod.markNotificationRead(id);
      }),
  }),

  reportBuilder: router({
    list: orgStaffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return mod.getCustomReports(organizationId);
      }),
    create: orgStaffProcedure
      .input(
        z.object({
          organizationId: z.number(),
          reportName: z.string().min(1),
          reportType: z.enum(["enrollment", "attendance", "health", "compliance", "financial", "custom"]),
          filters: z.record(z.string(), z.unknown()).optional(),
          columns: z.array(z.string()).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return mod.createCustomReport({ ...input, createdByUserId: ctx.user.id });
      }),
    run: staffProcedure
      .input(z.number())
      .mutation(async ({ input: reportId, ctx }) => {
        await assertRecordInOrg(ctx.user, "report", reportId);
        return mod.runCustomReport(reportId);
      }),
    delete: staffProcedure
      .input(z.number())
      .mutation(async ({ input: reportId, ctx }) => {
        await assertRecordInOrg(ctx.user, "report", reportId);
        return mod.deleteCustomReport(reportId);
      }),
    update: staffProcedure
      .input(
        z.object({
          id: z.number(),
          reportName: z.string().min(1).optional(),
          reportType: z.enum(["enrollment", "attendance", "health", "compliance", "financial", "custom"]).optional(),
          filters: z.record(z.string(), z.unknown()).optional(),
          columns: z.array(z.string()).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await assertRecordInOrg(ctx.user, "report", id);
        return mod.updateCustomReport(id, data);
      }),
  }),

  health: router({
    list: orgStaffProcedure
      .input(z.object({ organizationId: z.number(), childId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        await auditAccess(ctx, {
          action: "read",
          resourceType: "health_record",
          resourceId: input.childId ?? null,
          detail: `org:${input.organizationId}`,
        });
        return getHealthRecords(input.organizationId, input.childId);
      }),
    create: orgStaffProcedure
      .input(z.any())
      .mutation(async ({ input, ctx }) => {
        // PHI write: the child must belong to the caller's org, and the org is
        // taken from the session — never trusted from the client payload.
        const childId = Number(input?.childId);
        if (!childId || Number.isNaN(childId)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "childId is required" });
        }
        await assertChildInOrg(ctx.user, childId);
        const result = await createHealthRecord({
          ...input,
          childId,
          organizationId: ctx.user.organizationId ?? input.organizationId,
        });
        await auditAccess(ctx, {
          action: "create",
          resourceType: "health_record",
          resourceId: childId,
        });
        return result;
      }),
    followUps: orgStaffProcedure
      .input(z.object({ organizationId: z.number(), dueWithinDays: z.number().min(1).max(365).optional() }))
      .query(async ({ input }) => {
        return getHealthFollowUpAlerts(input.organizationId, input.dueWithinDays ?? 30);
      }),
    // "Cleared to attend" participation-blocking status (see
    // server/participationClearance.ts) — omit childId for the org-wide
    // map used by Kiosk/roster grids, pass it for a single child's detail.
    clearance: orgStaffProcedure
      .input(z.object({ organizationId: z.number(), childId: z.number().optional() }))
      .query(async ({ input }) => {
        if (input.childId != null) {
          return computeClearanceForChild(input.childId, input.organizationId);
        }
        const map = await computeClearanceForOrg(input.organizationId);
        return Array.from(map.values());
      }),
  }),

  // Generic program-monitoring checklist (see server/complianceChecklist.ts)
  // — previously the web Compliance page's "Program Monitoring Checklist"
  // tab was local-state-only ("Mark Reviewed" did nothing server-side).
  complianceChecklist: router({
    list: orgStaffProcedure
      .input(z.object({ organizationId: z.number() }))
      .query(async ({ input }) => listChecklistItems(input.organizationId)),
    markReviewed: orgStaffProcedure
      .input(z.object({ organizationId: z.number(), itemKey: z.string(), note: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const staffId = await mod.resolveStaffId(input.organizationId, ctx.user.id);
        return markChecklistItemReviewed(input.organizationId, input.itemKey, staffId, input.note ?? null);
      }),
  }),

  familyServices: router({
    list: hsStaffProcedure
      .input(z.object({ organizationId: z.number(), familyId: z.number().optional() }))
      .query(async ({ input }) => {
        return getFamilyServices(input.organizationId, input.familyId);
      }),
    create: hsStaffProcedure
      .input(z.any())
      .mutation(async ({ input, ctx }) => {
        // The family must belong to the caller's org.
        const familyId = Number(input?.familyId);
        if (!familyId || Number.isNaN(familyId)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "familyId is required" });
        }
        await assertRecordInOrg(ctx.user, "family", familyId);
        // Attribute the contact to the staff member who's actually logged in —
        // never trust a client-supplied recordedBy — so workload reports add up.
        const recordedBy = await mod.resolveStaffId(ctx.user.organizationId, ctx.user.id);
        return createFamilyService({
          ...input,
          familyId,
          organizationId: ctx.user.organizationId ?? input.organizationId,
          recordedBy: recordedBy ?? input.recordedBy ?? null,
        });
      }),
    // Per-staff workload over a date range — supervisor view (everyone) plus a
    // single advocate's contact log when `staffId` is supplied.
    staffActivity: hsStaffProcedure
      .input(z.object({
        organizationId: z.number(),
        start: z.date(),
        end: z.date(),
        staffId: z.number().nullable().optional(),
      }))
      .query(async ({ input }) => {
        return mod.getStaffActivityReport(input.organizationId, {
          start: input.start,
          end: input.end,
          staffId: input.staffId ?? null,
        });
      }),
    // Contacts — a filtered view of the same log the create/staffActivity
    // procedures above use, joined with the recording staff member's name.
    contacts: hsStaffProcedure
      .input(z.object({ familyId: z.number() }))
      .query(async ({ input, ctx }) => {
        await assertRecordInOrg(ctx.user, "family", input.familyId);
        return fcm.getFamilyContacts(input.familyId);
      }),
  }),

  // SMART goals a family is working toward, tracked during home visits /
  // case management. Head Start module feature; the family app reads the
  // same table read-only via server/family.ts (general, not gated).
  familyGoals: router({
    list: hsStaffProcedure
      .input(z.object({ familyId: z.number() }))
      .query(async ({ input, ctx }) => {
        await assertRecordInOrg(ctx.user, "family", input.familyId);
        return fcm.getFamilyGoals(input.familyId);
      }),
    create: hsStaffProcedure
      .input(z.object({
        familyId: z.number(),
        title: z.string().min(1).max(255),
        description: z.string().max(2000).optional(),
        category: z.string().max(50).optional(),
        targetDate: z.date().nullable().optional(),
        steps: z.array(z.string().min(1).max(255)).max(20).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await assertRecordInOrg(ctx.user, "family", input.familyId);
        const orgId = ctx.user.organizationId!;
        const steps = (input.steps ?? []).map((title) => ({ id: randomUUID(), title, isCompleted: false, dueDate: null, notes: null }));
        const result = await fcm.createFamilyGoal({ organizationId: orgId, familyId: input.familyId, title: input.title, description: input.description, category: input.category, targetDate: input.targetDate, steps });
        await auditAccess(ctx, { action: "create", resourceType: "family_goal", resourceId: result.id, detail: `family:${input.familyId}` });
        return result;
      }),
    updateStep: hsStaffProcedure
      .input(z.object({ goalId: z.number(), stepId: z.string(), completed: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        await assertRecordInOrg(ctx.user, "familyGoal", input.goalId);
        return fcm.updateGoalStep(input.goalId, input.stepId, input.completed);
      }),
  }),

  // Resource/community-service referrals — §1302.14 community partnerships.
  familyReferrals: router({
    list: hsStaffProcedure
      .input(z.object({ familyId: z.number() }))
      .query(async ({ input, ctx }) => {
        await assertRecordInOrg(ctx.user, "family", input.familyId);
        return fcm.getFamilyReferrals(input.familyId);
      }),
    create: hsStaffProcedure
      .input(z.object({
        familyId: z.number(),
        agencyName: z.string().min(1).max(255),
        serviceType: z.enum([
          "housing", "food_assistance", "mental_health", "substance_use", "domestic_violence",
          "legal_aid", "employment", "adult_education", "childcare", "medical_care",
          "dental_care", "vision_care", "transportation", "utility_assistance",
          "financial_counseling", "other",
        ]),
        referralDate: z.date(),
        followUpDate: z.date().nullable().optional(),
        notes: z.string().max(2000).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await assertRecordInOrg(ctx.user, "family", input.familyId);
        const orgId = ctx.user.organizationId!;
        const referredBy = await mod.resolveStaffId(orgId, ctx.user.id);
        const result = await fcm.createFamilyReferral({
          organizationId: orgId, familyId: input.familyId, agencyName: input.agencyName,
          serviceType: input.serviceType, referralDate: input.referralDate,
          followUpDate: input.followUpDate ?? undefined, notes: input.notes ?? undefined,
          referredBy: referredBy ?? undefined,
        });
        await auditAccess(ctx, { action: "create", resourceType: "family_referral", resourceId: result.id, detail: `family:${input.familyId}` });
        return result;
      }),
    update: hsStaffProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["pending", "contacted", "enrolled", "declined", "unavailable", "completed"]).optional(),
        followUpDate: z.date().nullable().optional(),
        notes: z.string().max(2000).optional(),
        outcomeNotes: z.string().max(2000).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await assertRecordInOrg(ctx.user, "familyReferral", input.id);
        const { id, ...patch } = input;
        await fcm.updateFamilyReferral(id, ctx.user.organizationId!, patch);
        await auditAccess(ctx, { action: "update", resourceType: "family_referral", resourceId: id, detail: patch.status ?? "update" });
        return { success: true };
      }),
  }),

  // Structured home-visiting curriculum log (§1302.36).
  familyHomeVisits: router({
    list: hsStaffProcedure
      .input(z.object({ familyId: z.number() }))
      .query(async ({ input, ctx }) => {
        await assertRecordInOrg(ctx.user, "family", input.familyId);
        return fcm.getFamilyHomeVisits(input.familyId);
      }),
    create: hsStaffProcedure
      .input(z.object({
        familyId: z.number(),
        visitDate: z.date(),
        visitType: z.enum(["home_visit", "office_visit", "phone_call", "group_social", "community_event"]),
        durationMinutes: z.number().int().min(0).max(1440).optional(),
        topicsCovered: z.array(z.string()).max(20).optional(),
        notes: z.string().max(5000).optional(),
        goalsMentioned: z.array(z.string()).max(20).optional(),
        locationVerified: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await assertRecordInOrg(ctx.user, "family", input.familyId);
        const orgId = ctx.user.organizationId!;
        const conductedBy = await mod.resolveStaffId(orgId, ctx.user.id);
        const result = await fcm.createFamilyHomeVisit({
          organizationId: orgId, familyId: input.familyId, visitDate: input.visitDate, visitType: input.visitType,
          durationMinutes: input.durationMinutes ?? 0, topicsCovered: input.topicsCovered ?? [],
          notes: input.notes ?? undefined, goalsMentioned: input.goalsMentioned ?? [],
          locationVerified: input.locationVerified ? 1 : 0, conductedBy: conductedBy ?? undefined,
        });
        await auditAccess(ctx, { action: "create", resourceType: "family_home_visit", resourceId: result.id, detail: `family:${input.familyId}` });
        return result;
      }),
  }),

  // Family Needs Assessment (FNA) — one current assessment per family.
  fna: router({
    get: hsStaffProcedure
      .input(z.object({ familyId: z.number() }))
      .query(async ({ input, ctx }) => {
        await assertRecordInOrg(ctx.user, "family", input.familyId);
        return fcm.getFamilyNeedsAssessment(input.familyId);
      }),
    save: hsStaffProcedure
      .input(z.object({
        familyId: z.number(),
        ratings: z.array(z.object({
          id: z.string(),
          domain: z.enum(["familySafety", "familyHealth", "familyLearning", "familyEngagement", "familyWellbeing", "communityConnections"]),
          level: z.number().int().min(1).max(4),
          notes: z.string().max(1000),
        })).max(12),
        notes: z.string().max(5000).optional(),
        isComplete: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await assertRecordInOrg(ctx.user, "family", input.familyId);
        const orgId = ctx.user.organizationId!;
        const conductedBy = await mod.resolveStaffId(orgId, ctx.user.id);
        const result = await fcm.saveFamilyNeedsAssessment({
          organizationId: orgId, familyId: input.familyId, conductedBy,
          ratings: input.ratings, notes: input.notes ?? "", isComplete: input.isComplete ?? false,
        });
        await auditAccess(ctx, { action: "update", resourceType: "family_needs_assessment", resourceId: result.id, detail: `family:${input.familyId}` });
        return result;
      }),
  }),

  // CFCR — Child & Family Case Review meetings.
  cfcr: router({
    list: hsStaffProcedure
      .input(z.object({ childId: z.number() }))
      .query(async ({ input, ctx }) => {
        const orgId = ctx.user.organizationId!;
        if (!(await fcm.childBelongsToOrg(input.childId, orgId)) && !isPlatformOwner(ctx.user.openId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to that child." });
        }
        return fcm.getCfcrRecords(input.childId);
      }),
    create: hsStaffProcedure
      .input(z.object({
        childId: z.number(),
        meetingDate: z.date(),
        participants: z.array(z.object({ id: z.string(), name: z.string(), role: z.string(), attended: z.boolean() })).max(20).optional(),
        attendanceNotes: z.string().max(2000).optional(),
        healthNotes: z.string().max(2000).optional(),
        behaviorNotes: z.string().max(2000).optional(),
        developmentalNotes: z.string().max(2000).optional(),
        familyGoalNotes: z.string().max(2000).optional(),
        actionItems: z.array(z.object({ id: z.string(), description: z.string(), assignedTo: z.string(), dueDate: z.string().nullable(), isCompleted: z.boolean() })).max(20).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const orgId = ctx.user.organizationId!;
        if (!(await fcm.childBelongsToOrg(input.childId, orgId)) && !isPlatformOwner(ctx.user.openId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to that child." });
        }
        const conductedBy = await mod.resolveStaffId(orgId, ctx.user.id);
        const result = await fcm.createCfcrRecord({
          organizationId: orgId, childId: input.childId, meetingDate: input.meetingDate,
          participants: input.participants ?? [], attendanceNotes: input.attendanceNotes ?? undefined,
          healthNotes: input.healthNotes ?? undefined, behaviorNotes: input.behaviorNotes ?? undefined,
          developmentalNotes: input.developmentalNotes ?? undefined, familyGoalNotes: input.familyGoalNotes ?? undefined,
          actionItems: input.actionItems ?? [], conductedBy: conductedBy ?? undefined,
        });
        await auditAccess(ctx, { action: "create", resourceType: "cfcr_record", resourceId: result.id, detail: `child:${input.childId}` });
        return result;
      }),
  }),

  // Narrative case-management notes, distinct from the general contact log.
  familyCaseNotes: router({
    list: hsStaffProcedure
      .input(z.object({ familyId: z.number() }))
      .query(async ({ input, ctx }) => {
        await assertRecordInOrg(ctx.user, "family", input.familyId);
        return fcm.getFamilyCaseNotes(input.familyId);
      }),
    create: hsStaffProcedure
      .input(z.object({
        familyId: z.number(),
        type: z.enum(["home_visit", "phone_call", "office_visit", "incident", "general"]),
        confidentiality: z.enum(["standard", "sensitive"]).optional(),
        body: z.string().min(1).max(5000),
        followUpRequired: z.boolean().optional(),
        followUpDue: z.date().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await assertRecordInOrg(ctx.user, "family", input.familyId);
        const orgId = ctx.user.organizationId!;
        const authorId = await mod.resolveStaffId(orgId, ctx.user.id);
        const result = await fcm.createFamilyCaseNote({
          organizationId: orgId, familyId: input.familyId, type: input.type,
          confidentiality: input.confidentiality ?? "standard", body: input.body,
          followUpRequired: input.followUpRequired ? 1 : 0, followUpDue: input.followUpDue ?? undefined,
          authorId: authorId ?? undefined,
        });
        await auditAccess(ctx, { action: "create", resourceType: "family_case_note", resourceId: result.id, detail: `family:${input.familyId}` });
        return result;
      }),
    setFollowUpCompleted: hsStaffProcedure
      .input(z.object({ id: z.number(), completed: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        await assertRecordInOrg(ctx.user, "familyCaseNote", input.id);
        const row = await fcm.setCaseNoteFollowUpCompleted(input.id, ctx.user.organizationId!, input.completed);
        await auditAccess(ctx, { action: "update", resourceType: "family_case_note", resourceId: input.id, detail: "followup" });
        return row;
      }),
    // LLM digest of the family's case history with goal links (staff prep tool).
    summarize: hsStaffProcedure
      .input(z.object({ familyId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // LLM calls cost real money — cap per user so a stuck client can't burn the budget.
        const { ok, retryAfterSec } = rateLimit(`case-summary:${ctx.user.id}`, 10, 60_000);
        if (!ok) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Too many summaries at once — try again in ${retryAfterSec}s.` });
        }
        await assertRecordInOrg(ctx.user, "family", input.familyId);
        const result = await fcm.summarizeFamilyCaseNotes(input.familyId);
        if (!result) {
          throw new TRPCError({ code: "NOT_FOUND", message: "No case notes to summarize for this family yet." });
        }
        await auditAccess(ctx, { action: "read", resourceType: "family_case_note", detail: `ai_summary:family:${input.familyId}` });
        return result;
      }),
  }),

  // Attendance Improvement Plans (AIP) — §1302.16.
  attendancePlans: router({
    list: hsStaffProcedure
      .input(z.object({ organizationId: z.number() }))
      .query(async ({ input }) => {
        return ap.getAttendancePlans(input.organizationId);
      }),
    create: hsStaffProcedure
      .input(z.object({
        childId: z.number(),
        reviewDate: z.date().nullable().optional(),
        barriers: z.array(z.string().max(255)).max(20).optional(),
        strategies: z.array(z.string().max(255)).max(20).optional(),
        notes: z.string().max(2000).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const orgId = ctx.user.organizationId!;
        if (!(await fcm.childBelongsToOrg(input.childId, orgId)) && !isPlatformOwner(ctx.user.openId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to that child." });
        }
        const familyAdvocate = await mod.resolveStaffId(orgId, ctx.user.id);
        const strategies = (input.strategies ?? []).map((description) => ({ id: randomUUID(), description, isImplemented: false, targetDate: null }));
        const result = await ap.createAttendancePlan({
          organizationId: orgId, childId: input.childId, familyAdvocate: familyAdvocate ?? undefined,
          reviewDate: input.reviewDate ?? undefined, barriers: input.barriers ?? [], strategies,
          notes: input.notes ?? undefined,
        });
        await auditAccess(ctx, { action: "create", resourceType: "attendance_plan", resourceId: result.id, detail: `child:${input.childId}` });
        return result;
      }),
    update: hsStaffProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["active", "resolved", "closed"]).optional(),
        reviewDate: z.date().nullable().optional(),
        notes: z.string().max(2000).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await assertRecordInOrg(ctx.user, "attendancePlan", input.id);
        const { id, ...patch } = input;
        await ap.updateAttendancePlan(id, ctx.user.organizationId!, patch);
        await auditAccess(ctx, { action: "update", resourceType: "attendance_plan", resourceId: id, detail: patch.status ?? "update" });
        return { success: true };
      }),
  }),

  messaging: router({
    send: orgStaffProcedure
      .input(z.object({
        organizationId: z.number(),
        recipientId: z.number(),
        to: z.string(),
        subject: z.string().optional(),
        content: z.string(),
        type: z.enum(['sms', 'email'])
      }))
      .mutation(async ({ input }) => {
        return await CommunicationService.sendMessage(input);
      }),
    broadcast: orgStaffProcedure
      .input(z.object({
        organizationId: z.number(),
        content: z.string().min(1),
        channels: z.array(z.enum(['sms', 'email']))
      }))
      .mutation(async ({ input, ctx }) => {
        // Record a broadcast entry for every family in the caller's org and
        // return the REAL recipient count. No provider is wired, so each row is
        // logged as "pending" (queued) rather than reported as delivered.
        const orgId = ctx.user.organizationId ?? input.organizationId;
        const fams = await mod.getOrganizationFamilies(orgId);
        const delivered = CommunicationService.hasProvider();
        for (const f of fams) {
          await createCommunicationLog({
            organizationId: orgId,
            recipientId: f.id,
            type: "broadcast",
            content: input.content,
            status: delivered ? "sent" : "pending",
          });
        }
        return { success: true, count: fams.length, delivered };
      }),
    list: orgStaffProcedure
      .input(z.object({ organizationId: z.number(), recipientId: z.number().optional() }))
      .query(async ({ input }) => {
        return await getCommunicationLogs(input.organizationId, input.recipientId);
      }),
  }),

  education: router({
    list: orgStaffProcedure
      .input(z.object({ organizationId: z.number(), childId: z.number().optional() }))
      .query(async ({ input }) => {
        return await getEducationRecords(input.organizationId, input.childId);
      }),
    create: orgStaffProcedure
      .input(
        z.object({
          organizationId: z.number(),
          childId: z.number(),
          type: z.enum(["assessment", "parent_conference", "home_visit", "individual_plan"]),
          title: z.string().min(1),
          description: z.string().optional(),
          assessmentDate: z.date(),
          score: z.string().optional(),
          domain: z.string().max(80).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const result = await mod.createEducationRecord(input);
        await auditAccess(ctx, { action: "create", resourceType: "education_record", resourceId: input.childId, detail: input.type });
        return result;
      }),
  }),

  compliance: router({
    // Live "if the reviewer walked in today" score across the Performance
    // Standards. Read-only aggregation of data staff already maintain.
    auditReadiness: hsAdminProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return computeAuditReadiness(organizationId);
      }),
    getPir: hsStaffProcedure
      .input(z.object({ organizationId: z.number(), year: z.string() }))
      .query(async ({ input }) => {
        return await getPirData(input.organizationId, input.year);
      }),
    // PIR question catalog (federal reference data, seeded from the form). Not
    // org-specific, so no tenant scope — any internal staff may read it.
    questions: hsStaffProcedure.query(async () => {
      return mod.getPirQuestions();
    }),
    // Full report for a program year: envelope + catalog + saved values.
    getReport: hsStaffProcedure
      .input(z.object({ organizationId: z.number(), year: z.string() }))
      .query(async ({ input }) => {
        return mod.getPirReport(input.organizationId, input.year);
      }),
    // All reports for the org, with completion counts — drives the history list.
    listReports: hsStaffProcedure
      .input(z.object({ organizationId: z.number() }))
      .query(async ({ input }) => {
        return mod.listPirReports(input.organizationId);
      }),
    submitReport: hsAdminProcedure
      .input(z.object({ organizationId: z.number(), year: z.string() }))
      .mutation(async ({ input, ctx }) => {
        await auditAccess(ctx, { action: "update", resourceType: "pir_report", resourceId: input.year, detail: "submit" });
        return mod.submitPirReport(input.organizationId, input.year);
      }),
    reopenReport: hsAdminProcedure
      .input(z.object({ organizationId: z.number(), year: z.string() }))
      .mutation(async ({ input, ctx }) => {
        await auditAccess(ctx, { action: "update", resourceType: "pir_report", resourceId: input.year, detail: "reopen" });
        return mod.reopenPirReport(input.organizationId, input.year);
      }),
    // Smart Fill: compute PIR values from live program data. Read-only; the
    // admin reviews and applies suggestions explicitly.
    autoPopulate: hsStaffProcedure
      .input(z.object({ organizationId: z.number(), year: z.string() }))
      .query(async ({ input }) => {
        return computePirSuggestions(input.organizationId, input.year);
      }),
    applyAutoPopulate: hsAdminProcedure
      .input(
        z.object({
          organizationId: z.number(),
          year: z.string(),
          items: z
            .array(
              z.object({
                section: z.string(),
                questionId: z.string(),
                value: z.string(),
              })
            )
            .min(1)
            .max(200),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await auditAccess(ctx, {
          action: "update",
          resourceType: "pir_data",
          resourceId: `${input.year}/smart-fill`,
          detail: `${input.items.length} fields`,
        });
        for (const item of input.items) {
          await mod.upsertPirValue(
            input.organizationId,
            input.year,
            item.section,
            item.questionId,
            item.value
          );
        }
        return { applied: input.items.length };
      }),
    // PIR is federal reporting data — edits are administrative.
    setPirValue: hsAdminProcedure
      .input(
        z.object({
          organizationId: z.number(),
          year: z.string(),
          section: z.string(),
          questionId: z.string(),
          value: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await auditAccess(ctx, {
          action: "update",
          resourceType: "pir_data",
          resourceId: `${input.year}/${input.section}/${input.questionId}`,
        });
        return mod.upsertPirValue(input.organizationId, input.year, input.section, input.questionId, input.value);
      }),
  }),
});

export type AppRouter = typeof appRouter;
