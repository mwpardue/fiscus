import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional()
});

const serverEnvSchema = z.object({
  BRANDFETCH_API_KEY: z.string().min(1).optional(),
  BRANDFETCH_CLIENT_ID: z.string().min(1).optional()
});

export function getPublicEnv() {
  return publicEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL
  });
}

export function getServerEnv() {
  return serverEnvSchema.parse({
    BRANDFETCH_API_KEY: process.env.BRANDFETCH_API_KEY,
    BRANDFETCH_CLIENT_ID: process.env.BRANDFETCH_CLIENT_ID
  });
}

export function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
