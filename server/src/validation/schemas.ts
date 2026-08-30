import { z } from 'zod';

export const signupSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(100),
  displayName: z.string().min(2).max(60),
});

export const loginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(100),
});

export const forgotPasswordSchema = z.object({ email: z.string().email().max(200) });

export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(500),
  password: z.string().min(8).max(100),
});

export const profileSchema = z.object({
  displayName: z.string().min(2).max(60).optional(),
  bio: z.string().max(500).nullable().optional(),
  university: z.string().max(120).nullable().optional(),
  department: z.string().max(120).nullable().optional(),
  year: z.string().max(20).nullable().optional(),
  avatarColor: z.string().max(20).optional(),
  format: z.enum(['ONLINE', 'IN_PERSON', 'EITHER']).optional(),
  days: z.array(z.string().max(12)).max(7).optional(),
  dayParts: z.array(z.string().max(12)).max(3).optional(),
});

export const addUserSkillSchema = z.object({
  type: z.enum(['TEACH', 'WANT']),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']).default('BEGINNER'),
});

export const requestSchema = z.object({
  recipientId: z.string().uuid(),
  message: z.string().min(5).max(2000),
  skillOffered: z.string().max(80).optional(),
  skillWanted: z.string().max(80).optional(),
});

export const sessionSchema = z.object({
  title: z.string().min(1).max(120),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(480).default(60),
  mode: z.enum(['ONLINE', 'IN_PERSON', 'EITHER']).default('ONLINE'),
  meetingLink: z.string().url().max(500).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const sessionUpdateSchema = sessionSchema.partial().extend({
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED']).optional(),
});

export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export const reportSchema = z.object({
  targetId: z.string().uuid(),
  reason: z.string().min(3).max(120),
  details: z.string().max(1000).optional(),
});

export const skillSchema = z.object({
  name: z.string().min(1).max(60),
  category: z.string().min(1).max(60),
});
