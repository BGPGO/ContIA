/**
 * DNA Trigger — Auto-generates brand DNA when Instagram is connected.
 *
 * Call `triggerAutoDNA(empresaId)` from the client side after a successful
 * Instagram connection. It fires the API call in the background and does
 * NOT block the UI. The DNA will be available on the next visit to the
 * DNA/configuracoes page.
 *
 * For server-side usage (e.g. inside the callback route), use
 * `triggerAutoDNAServer(empresaId, supabaseClient, openai)` which calls
 * the generator directly without HTTP.
 */

import type { MarcaDNAResult } from "./marca-dna";

// ── Client-side trigger (fires and forgets) ──────────────────────────────────

export async function triggerAutoDNA(
  empresaId: string,
  options?: { force?: boolean; onComplete?: (result: MarcaDNAResult) => void; onError?: (error: string) => void }
): Promise<void> {
  const { force = false, onComplete, onError } = options || {};

  try {
    console.log(`[DNA-Trigger] Disparando geracao automatica para: ${empresaId}`);

    const response = await fetch("/api/ai/auto-dna", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empresa_id: empresaId, force }),
    });

    const result = await response.json();

    if (!response.ok || result.status === "erro") {
      const errorMsg = result.error || "Erro desconhecido na geracao de DNA";
      console.error(`[DNA-Trigger] Erro: ${errorMsg}`);
      onError?.(errorMsg);
      return;
    }

    console.log(`[DNA-Trigger] DNA gerado com sucesso para: ${empresaId}`);
    onComplete?.(result as MarcaDNAResult);
  } catch (error: any) {
    console.error("[DNA-Trigger] Erro na requisicao:", error.message);
    onError?.(error.message);
  }
}

// ── Server-side trigger (direct, no HTTP) ────────────────────────────────────

export async function triggerAutoDNAServer(
  empresaId: string,
  supabaseClient: any,
  openai: any
): Promise<MarcaDNAResult> {
  const { runAutoDNA } = await import("./auto-dna-generator");
  return runAutoDNA(empresaId, supabaseClient, openai);
}

// ── Check if DNA exists for empresa ──────────────────────────────────────────

export async function checkDNAStatus(
  empresaId: string
): Promise<{ exists: boolean; status?: string }> {
  try {
    const response = await fetch(
      `/api/ai/auto-dna?empresa_id=${empresaId}`,
      { method: "GET" }
    );

    if (!response.ok) return { exists: false };

    const data = await response.json();
    return {
      exists: !!data?.dna_sintetizado,
      status: data?.status,
    };
  } catch {
    return { exists: false };
  }
}

// ── Should trigger DNA? ──────────────────────────────────────────────────────
// Checks if Instagram is connected but DNA doesn't exist yet.
// Useful for conditional triggering on page load.

export async function shouldTriggerDNA(
  empresaId: string,
  supabaseClient: any
): Promise<boolean> {
  try {
    // Check if Instagram is connected
    const { data: connection } = await supabaseClient
      .from("social_connections")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("provider", "instagram")
      .eq("is_active", true)
      .single();

    if (!connection) return false;

    // Check if DNA already exists
    const { data: dna } = await supabaseClient
      .from("marca_dna")
      .select("status")
      .eq("empresa_id", empresaId)
      .single();

    // Trigger if no DNA exists, or if it was generated with scraping (no source field)
    if (!dna) return true;
    if (dna.status === "erro") return true;

    return false;
  } catch {
    return false;
  }
}
