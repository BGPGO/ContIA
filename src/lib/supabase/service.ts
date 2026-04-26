import { createClient, SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let serviceClient: SupabaseClient<any, any, any> | null = null;

/**
 * Retorna um Supabase client com SERVICE_ROLE key (bypass RLS).
 * Usar APENAS em jobs/workers que rodam fora do contexto HTTP (sem cookies de usuário).
 * Para API routes, prefira getAdminSupabase() de admin.ts com auth check separado.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createServiceClient(): SupabaseClient<any, any, any> {
  if (serviceClient) return serviceClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY nao configurada. Defina no Coolify (ou .env.local para dev)."
    );
  }

  serviceClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return serviceClient;
}
