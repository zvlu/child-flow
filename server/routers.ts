import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, staffProcedure, adminProcedure } from "./_core/trpc";
import { auditAccess } from "./_core/audit";
import { z } from "zod";
import {
  getOrganizationByAgencyId,
  getUserOrganizations,
  getOrganizationChildren,
  getChildById,
  createChild,
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
import { CommunicationService } from "./services/communication";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => {
      if (!opts.ctx.user) return null;
      // Never expose the password hash (or let new sensitive columns leak by
      // default) — return an explicit allowlist of fields.
      const { id, openId, name, email, role, lastSignedIn } = opts.ctx.user;
      return { id, openId, name, email, role, lastSignedIn };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
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
    createInvoice: staffProcedure
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
      .mutation(async ({ input }) => {
        return mod.createInvoice({ ...input, dueDate: new Date(input.dueDate) });
      }),
    payments: staffProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return mod.getPayments(organizationId);
      }),
    recordPayment: staffProcedure
      .input(
        z.object({
          invoiceId: z.number(),
          organizationId: z.number(),
          amount: z.string(),
          paymentMethod: z.enum(["credit_card", "ach", "check", "cash"]),
        })
      )
      .mutation(async ({ input }) => {
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
      .mutation(async ({ input }) => {
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
    createCertification: staffProcedure
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
    setPirValue: staffProcedure
      .input(
        z.object({
          organizationId: z.number(),
          year: z.string(),
          section: z.string(),
          questionId: z.string(),
          value: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        return mod.upsertPirValue(input.organizationId, input.year, input.section, input.questionId, input.value);
      }),
  }),
});

export type AppRouter = typeof appRouter;
