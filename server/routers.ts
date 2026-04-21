import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import {
  getOrganizationByAgencyId,
  getUserOrganizations,
  getOrganizationChildren,
  getChildById,
  createChild,
  getOrganizationStaff,
  getAttendanceimport { 
  getHealthRecords,
  createHealthRecord,
  getFamilyServices,
  createFamilyService,
  getCommunicationLogs,
} from "./db";
import { CommunicationService } from "./services/communication";export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  organizations: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getUserOrganizations(ctx.user.id);
    }),
    getByAgencyId: publicProcedure
      .input(z.string())
      .query(async ({ input }) => {
        return getOrganizationByAgencyId(input);
      }),
  }),

  children: router({
    list: protectedProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return getOrganizationChildren(organizationId);
      }),
    getById: protectedProcedure
      .input(z.number())
      .query(async ({ input: childId }) => {
        return getChildById(childId);
      }),
    create: protectedProcedure
      .input(
        z.object({
          organizationId: z.number(),
          firstName: z.string().min(1),
          lastName: z.string().min(1),
          dateOfBirth: z.date().optional(),
          gender: z
            .enum(["male", "female", "other", "prefer_not_to_say"])
            .optional(),
        })
      )
      .mutation(async ({ input }) => {
        return createChild(input);
      }),
  }),

  staff: router({
    list: protectedProcedure
      .input(z.number())
      .query(async ({ input: organizationId }) => {
        return getOrganizationStaff(organizationId);
      }),
  }),

  attendance: router({
    getByDate: protectedProcedure
      .input(
        z.object({
          organizationId: z.number(),
          date: z.date(),
        })
      )
      .query(async ({ input }) => {
        return getAttendanceByDate(input.organizationId, input.date);
      }),
  }),

  health: router({
    list: protectedProcedure
      .input(z.object({ organizationId: z.number(), childId: z.number().optional() }))
      .query(async ({ input }) => {
        return getHealthRecords(input.organizationId, input.childId);
      }),
    create: protectedProcedure
      .input(z.any()) // Using any for brevity in this step, ideally use Zod schema matching InsertHealthRecord
      .mutation(async ({ input }) => {
        return createHealthRecord(input);
      }),
  }),

  familyServices: router({
    list: protectedProcedure
      .input(z.object({ organizationId: z.number(), familyId: z.number().optional() }))
      .query(async ({ input }) => {
        return getFamilyServices(input.organizationId, input.familyId);
      }),
    create: protectedProcedure
      .input(z.any())
      .mutation(async ({ input }) => {
        return createFamilyService(input);
      }),
  }),

  messaging: router({
    send: protectedProcedure
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
    broadcast: protectedProcedure
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
    list: protectedProcedure
      .input(z.object({ organizationId: z.number(), recipientId: z.number().optional() }))
      .query(async ({ input }) => {
        return await getCommunicationLogs(input.organizationId, input.recipientId);
      }),
  }),
});

export type AppRouter = typeof appRouter;
