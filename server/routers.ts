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
  getAttendanceByDate,
} from "./db";

export const appRouter = router({
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
});

export type AppRouter = typeof appRouter;
