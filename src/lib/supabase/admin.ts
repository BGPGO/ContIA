import { createClient, SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let adminClient: SupabaseClient<any, any, any> | null = null;

/**
 * Retorna um Supabase client com service_role key (bypass RLS).
 * Usar APENAS em API routes, NUNCA no client-side.
 * Auth check deve ser feito com o client normal (createClient de server.ts).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAdminSupabase(): SupabaseClient<any, any, any> {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY nao configurada. Defina no .env.local"
    );
  }

  adminClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return adminClient;
}
