import { COOKIE_NAME, NOT_ADMIN_ERR_MSG } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router, staffProcedure, adminProcedure } from "./_core/trpc";
import { auditAccess } from "./_core/audit";
import { hashPassword, verifyPassword } from "./_core/password";
import { z } from "zod";
import {
  getUserByOpenId,
  updateUserProfile,
  updateUserSettings,
  setUserPassword,
  getOrganizationByAgencyId,
  getOrganizationById,
  updateOrganization,
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
  getEducationRecords,
  getPirData,
} from "./db";
import * as mod from "./moduleDb";
import { createFamilyInvitation, listFamilyInvitations } from "./family";
import { computeDashboard } from "./dashboard";
import { CommunicationService } from "./services/communication";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => {
      if (!opts.ctx.user) return null;
      // Never expose the password hash (or let new sensitive columns leak by
      // default) — return an explicit allowlist of fields.
      const { id, openId, name, email, role, lastSignedIn, settings, avatarUrl } = opts.ctx.user;
      // Surface whether a password is set (so the UI can adjust the change-password
      // flow) without ever returning the hash itself.
      const hasPassword = Boolean(opts.ctx.user.passwordHash);
      return { id, openId, name, email, role, lastSignedIn, settings, avatarUrl, hasPassword };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
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
    get: staffProcedure
      .input(z.number())
      .query(async ({ input: id }) => {
        return getOrganizationById(id);
      }),
    // Persist the editable program profile (admin only).
    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().trim().min(1).max(255).optional(),
          director: z.string().trim().max(160).nullable().optional(),
          directorEmail: z.string().trim().max(320).email().or(z.literal("")).nullable().optional(),
          phone: z.string().trim().max(32).nullable().optional(),
          address: z.string().trim().max(400).nullable().optional(),
          maxChildren: z.number().int().min(0).max(100000).optional(),
          classroomCount: z.number().int().min(0).max(10000).nullable().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        // Normalize empty director email to null so we don't store "".
        if (data.directorEmail === "") data.directorEmail = null;
        await updateOrganization(id, data);
        await auditAccess(ctx, { action: "update", resourceType: "organization", resourceId: id, detail: "program_settings" });
        return { success: true };
      }),
  }),

  children: router({
    list: staffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return getOrganizationChildren(organizationId);
      }),
    getById: staffProcedure
      .input(z.number())
      .query(async ({ input: childId, ctx }) => {
        await auditAccess(ctx, { action: "read", resourceType: "child", resourceId: childId });
        return getChildById(childId);
      }),
    create: staffProcedure
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
        const result = await createChild(input);
        await auditAccess(ctx, { action: "create", resourceType: "child", detail: `org:${input.organizationId}` });
        return result;
      }),
    // CSV bulk import: create many children at once from an uploaded sheet.
    bulkImport: staffProcedure
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
        const result = await bulkCreateChildren(
          input.rows.map((r) => ({ ...r, organizationId: input.organizationId }))
        );
        await auditAccess(ctx, { action: "create", resourceType: "child", detail: `bulk_import:${result.count}` });
        return result;
      }),
    siblings: staffProcedure
      .input(z.number())
      .query(async ({ input: familyId }) => {
        return getFamilySiblings(familyId);
      }),
    update: staffProcedure
      .input(
        z.object({
          id: z.number(),
          firstName: z.string().min(1).optional(),
          lastName: z.string().min(1).optional(),
          dateOfBirth: z.date().optional(),
          gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
          status: z.enum(["active", "inactive", "graduated", "withdrawn"]).optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await auditAccess(ctx, { action: "update", resourceType: "child", resourceId: id });
        return mod.updateChild(id, data);
      }),
    classroomMap: staffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return mod.getChildClassroomMap(organizationId);
      }),
    // Color-coded safety flags for every child in the org.
    flags: staffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return mod.getChildFlags(organizationId);
      }),
    addFlag: staffProcedure
      .input(
        z.object({
          childId: z.number(),
          type: z.enum(["allergy", "dietary", "disability", "special"]),
          label: z.string().min(1).max(100),
          detail: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await mod.addChildFlag(input);
        await auditAccess(ctx, { action: "create", resourceType: "child_flag", resourceId: input.childId, detail: `${input.type}:${input.label}` });
        return { success: true };
      }),
    removeFlag: staffProcedure
      .input(z.object({ flagId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await mod.removeChildFlag(input.flagId);
        await auditAccess(ctx, { action: "delete", resourceType: "child_flag", resourceId: input.flagId });
        return { success: true };
      }),
  }),

  families: router({
    list: staffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return mod.getOrganizationFamilies(organizationId);
      }),
    create: staffProcedure
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
    createInvitation: staffProcedure
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
    invitations: staffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return listFamilyInvitations(organizationId);
      }),
    contacts: staffProcedure
      .input(z.number())
      .query(async ({ input: familyId }) => {
        return mod.getFamilyContacts(familyId);
      }),
  }),

  // Enrollment applications / waitlist. Triage prospective children and, on
  // approval, enroll them (creates real family + child records).
  enrollment: router({
    list: staffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return mod.getEnrollmentApplications(organizationId);
      }),
    create: staffProcedure
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
    setStatus: staffProcedure
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
    enroll: staffProcedure
      .input(z.object({ id: z.number(), organizationId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const result = await mod.enrollApplication(input.id, input.organizationId);
        await auditAccess(ctx, { action: "create", resourceType: "child", resourceId: result.childId, detail: `enrolled_from_application:${input.id}` });
        return result;
      }),
  }),

  staff: router({
    list: staffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return getOrganizationStaff(organizationId);
      }),
    // Creating/modifying staff and their roles is an administrative action.
    create: adminProcedure
      .input(
        z.object({
          organizationId: z.number(),
          firstName: z.string().min(1),
          lastName: z.string().min(1),
          email: z.string().optional(),
          phone: z.string().optional(),
          position: z.string().optional(),
          role: z.enum(["admin", "teacher", "assistant", "coordinator"]).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const result = await mod.createStaff(input);
        await auditAccess(ctx, { action: "create", resourceType: "staff", detail: `org:${input.organizationId}` });
        return result;
      }),
    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          firstName: z.string().min(1).optional(),
          lastName: z.string().min(1).optional(),
          email: z.string().optional(),
          phone: z.string().optional(),
          position: z.string().optional(),
          role: z.enum(["admin", "teacher", "assistant", "coordinator"]).optional(),
          isActive: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await auditAccess(ctx, { action: "update", resourceType: "staff", resourceId: id });
        return mod.updateStaff(id, data);
      }),
  }),

  // Admin-defined staff role labels (e.g. "Family Advocate"). These are display
  // labels mapped to a fixed access tier — they never widen the RBAC enum.
  roles: router({
    list: staffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return mod.getCustomRoles(organizationId);
      }),
    create: adminProcedure
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
    delete: adminProcedure
      .input(z.object({ id: z.number(), organizationId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await mod.deleteCustomRole(input.id, input.organizationId);
        await auditAccess(ctx, { action: "delete", resourceType: "custom_role", resourceId: input.id });
        return { success: true };
      }),
  }),

  classrooms: router({
    list: staffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return mod.getOrganizationClassrooms(organizationId);
      }),
    roster: staffProcedure
      .input(z.number())
      .query(async ({ input: classroomId }) => {
        return mod.getClassroomRoster(classroomId);
      }),
    // Move a child between rooms (null classroomId = unassign).
    assignChild: staffProcedure
      .input(z.object({ childId: z.number(), classroomId: z.number().nullable() }))
      .mutation(async ({ input, ctx }) => {
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
    getByDate: staffProcedure
      .input(
        z.object({
          organizationId: z.number(),
          date: z.date(),
        })
      )
      .query(async ({ input }) => {
        return getAttendanceByDate(input.organizationId, input.date);
      }),
    getRange: staffProcedure
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
    save: staffProcedure
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
        return mod.saveAttendanceForDate(input.organizationId, input.date, input.records);
      }),
  }),

  dashboard: router({
    stats: staffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return mod.getDashboardStats(organizationId);
      }),
    // Aggregated actionable alerts for the notification bell (shared with iOS).
    alerts: staffProcedure.query(async () => {
      const data = await computeDashboard();
      return data?.alerts ?? [];
    }),
  }),

  calendar: router({
    list: staffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return mod.getCalendarEvents(organizationId);
      }),
    create: staffProcedure
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
    update: staffProcedure
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
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return mod.updateCalendarEvent(id, data);
      }),
    delete: staffProcedure
      .input(z.number())
      .mutation(async ({ input: id }) => {
        return mod.deleteCalendarEvent(id);
      }),
  }),

  notes: router({
    list: staffProcedure
      .input(z.object({ organizationId: z.number(), childId: z.number().optional() }))
      .query(async ({ input }) => {
        return mod.getStudentNotes(input.organizationId, input.childId);
      }),
    create: staffProcedure
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
    list: staffProcedure
      .input(z.object({ organizationId: z.number(), childId: z.number().optional() }))
      .query(async ({ input }) => {
        return mod.getDocuments(input.organizationId, input.childId);
      }),
    create: staffProcedure
      .input(
        z.object({
          organizationId: z.number(),
          childId: z.number(),
          documentType: z.enum(["birth_certificate", "immunization_record", "consent_form", "medical_record", "assessment", "other"]),
          fileName: z.string().min(1),
          fileUrl: z.string().min(1),
          fileSize: z.number().optional(),
          mimeType: z.string().optional(),
          expiryDate: z.date().optional(),
          uploadedBy: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        return mod.createDocument(input);
      }),
    delete: staffProcedure
      .input(z.number())
      .mutation(async ({ input: id }) => {
        return mod.deleteDocument(id);
      }),
  }),

  digitalDocuments: router({
    list: staffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return mod.getDigitalDocuments(organizationId);
      }),
    create: staffProcedure
      .input(
        z.object({
          organizationId: z.number(),
          familyId: z.number(),
          documentType: z.enum(["enrollment", "consent", "waiver", "health_form"]),
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
    sign: staffProcedure
      .input(z.object({ id: z.number(), signedBy: z.string().min(1) }))
      .mutation(async ({ input }) => {
        return mod.signDigitalDocument(input.id, input.signedBy);
      }),
  }),

  billing: router({
    invoices: staffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return mod.getInvoices(organizationId);
      }),
    // Financial mutations are administrative (segregation of duties).
    createInvoice: adminProcedure
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
    payments: staffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return mod.getPayments(organizationId);
      }),
    recordPayment: adminProcedure
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
  }),

  meals: router({
    plans: staffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return mod.getMealPlans(organizationId);
      }),
    items: staffProcedure
      .input(z.number())
      .query(async ({ input: mealPlanId }) => {
        return mod.getMealItems(mealPlanId);
      }),
    createPlan: staffProcedure
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
        return mod.createMealPlan({ ...plan, weekStartDate: new Date(plan.weekStartDate) }, items);
      }),
    updatePlanStatus: staffProcedure
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
        return mod.updateMealPlanStatus(input.id, input.status);
      }),
    cacfpReports: staffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return mod.getCacfpReports(organizationId);
      }),
  }),

  staffOps: router({
    timeClock: staffProcedure
      .input(z.object({ organizationId: z.number(), sinceDays: z.number().optional() }))
      .query(async ({ input }) => {
        return mod.getTimeClockEntries(input.organizationId, input.sinceDays);
      }),
    clockIn: staffProcedure
      .input(z.number())
      .mutation(async ({ input: staffId }) => {
        return mod.clockIn(staffId);
      }),
    clockOut: staffProcedure
      .input(z.number())
      .mutation(async ({ input: entryId }) => {
        return mod.clockOut(entryId);
      }),
    certifications: staffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return mod.getCertifications(organizationId);
      }),
    // Certification (HR training) records are administrative.
    createCertification: adminProcedure
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
    list: staffProcedure
      .input(z.object({ organizationId: z.number(), includeDismissed: z.boolean().optional() }))
      .query(async ({ input }) => {
        return mod.getAiInsights(input.organizationId, input.includeDismissed);
      }),
    dismiss: staffProcedure
      .input(z.number())
      .mutation(async ({ input: id }) => {
        return mod.dismissAiInsight(id);
      }),
  }),

  bulkActions: router({
    logs: staffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return mod.getBulkActionLogs(organizationId);
      }),
    // Mass mutation across an entire classroom roster — restricted to admins.
    bulkAttendance: adminProcedure
      .input(
        z.object({
          organizationId: z.number(),
          classroomId: z.number(),
          date: z.date(),
          status: z.enum(["present", "absent", "excused", "half_day"]),
          performedBy: z.number(),
          description: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const roster = await mod.getClassroomRoster(input.classroomId);
        await mod.saveAttendanceForDate(
          input.organizationId,
          input.date,
          roster.map(c => ({ childId: c.id, status: input.status })),
          input.performedBy
        );
        await mod.createBulkActionLog({
          organizationId: input.organizationId,
          classroomId: input.classroomId,
          actionType: "bulk_attendance",
          description: input.description ?? `Marked ${roster.length} children ${input.status}`,
          recordCount: roster.length,
          performedBy: input.performedBy,
        });
        return { affected: roster.length };
      }),
  }),

  parentPortal: router({
    activities: staffProcedure
      .input(z.object({ organizationId: z.number(), childId: z.number().optional() }))
      .query(async ({ input }) => {
        return mod.getActivityLogs(input.organizationId, input.childId);
      }),
    logActivity: staffProcedure
      .input(
        z.object({
          childId: z.number(),
          staffId: z.number(),
          activityType: z.enum(["meal", "nap", "diaper", "activity", "note", "photo"]),
          description: z.string().min(1),
        })
      )
      .mutation(async ({ input }) => {
        return mod.createActivityLog(input);
      }),
    notifications: staffProcedure
      .input(z.number())
      .query(async ({ input: familyId }) => {
        return mod.getParentNotifications(familyId);
      }),
    markRead: staffProcedure
      .input(z.number())
      .mutation(async ({ input: id }) => {
        return mod.markNotificationRead(id);
      }),
  }),

  reportBuilder: router({
    list: staffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return mod.getCustomReports(organizationId);
      }),
    create: staffProcedure
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
      .mutation(async ({ input: reportId }) => {
        return mod.runCustomReport(reportId);
      }),
  }),

  health: router({
    list: staffProcedure
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
    create: staffProcedure
      .input(z.any()) // Using any for brevity in this step, ideally use Zod schema matching InsertHealthRecord
      .mutation(async ({ input, ctx }) => {
        const result = await createHealthRecord(input);
        await auditAccess(ctx, {
          action: "create",
          resourceType: "health_record",
          resourceId: input?.childId ?? null,
        });
        return result;
      }),
    followUps: staffProcedure
      .input(z.object({ organizationId: z.number(), dueWithinDays: z.number().min(1).max(365).optional() }))
      .query(async ({ input }) => {
        return getHealthFollowUpAlerts(input.organizationId, input.dueWithinDays ?? 30);
      }),
  }),

  familyServices: router({
    list: staffProcedure
      .input(z.object({ organizationId: z.number(), familyId: z.number().optional() }))
      .query(async ({ input }) => {
        return getFamilyServices(input.organizationId, input.familyId);
      }),
    create: staffProcedure
      .input(z.any())
      .mutation(async ({ input }) => {
        return createFamilyService(input);
      }),
  }),

  messaging: router({
    send: staffProcedure
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
    broadcast: staffProcedure
      .input(z.object({
        organizationId: z.number(),
        content: z.string(),
        channels: z.array(z.enum(['sms', 'email']))
      }))
      .mutation(async ({ input }) => {
        // In production, fetch all families in organization and loop sendMessage
        console.log(`[Broadcast] Sending to organization ${input.organizationId} via ${input.channels.join(', ')}`);
        return { success: true, count: 150 }; // Mock count
      }),
    list: staffProcedure
      .input(z.object({ organizationId: z.number(), recipientId: z.number().optional() }))
      .query(async ({ input }) => {
        return await getCommunicationLogs(input.organizationId, input.recipientId);
      }),
  }),

  education: router({
    list: staffProcedure
      .input(z.object({ organizationId: z.number(), childId: z.number().optional() }))
      .query(async ({ input }) => {
        return await getEducationRecords(input.organizationId, input.childId);
      }),
    create: staffProcedure
      .input(
        z.object({
          organizationId: z.number(),
          childId: z.number(),
          type: z.enum(["assessment", "parent_conference", "home_visit", "individual_plan"]),
          title: z.string().min(1),
          description: z.string().optional(),
          assessmentDate: z.date(),
          score: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return mod.createEducationRecord(input);
      }),
  }),

  compliance: router({
    getPir: staffProcedure
      .input(z.object({ organizationId: z.number(), year: z.string() }))
      .query(async ({ input }) => {
        return await getPirData(input.organizationId, input.year);
      }),
    // PIR is federal reporting data — edits are administrative.
    setPirValue: adminProcedure
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
