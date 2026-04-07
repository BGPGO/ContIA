import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient, isAIConfigured } from "@/lib/ai/config";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { runAutoDNA } from "@/lib/ai/auto-dna-generator";
import { dnaCache, cacheKey } from "@/lib/cache";
import type { MarcaDNAResult } from "@/lib/ai/marca-dna";

// ── POST /api/ai/auto-dna ───────────────────────────────────────────────────
//
// Triggers automatic DNA generation from connected Instagram account.
// Requires: empresa_id in body, Instagram connected in social_connections.
// Uses REAL API data (not scraping) for a comprehensive brand analysis.

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { empresa_id, force } = body as {
      empresa_id?: string;
      force?: boolean;
    };

    if (!empresa_id) {
      return NextResponse.json(
        { error: "Campo 'empresa_id' e obrigatorio" },
        { status: 400 }
      );
    }

    // Cache check (skip if force=true)
    if (!force) {
      const ck = cacheKey("auto-dna", empresa_id);
      const cached = dnaCache.get<MarcaDNAResult>(ck);
      if (cached && cached.status === "completo") {
        console.log(`[auto-dna] Cache hit para empresa: ${empresa_id}`);
        return NextResponse.json({ ...cached, _cached: true });
      }
    }

    if (!isAIConfigured()) {
      return NextResponse.json(
        { error: "OpenAI nao configurada. Defina OPENAI_API_KEY." },
        { status: 503 }
      );
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "Supabase nao configurado." },
        { status: 503 }
      );
    }

    const openai = getOpenAIClient();
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    console.log(`[auto-dna] Iniciando geracao automatica para: ${empresa_id}`);

    const result = await runAutoDNA(empresa_id, supabase, openai);

    // Cache successful results
    if (result.status === "completo") {
      const ck = cacheKey("auto-dna", empresa_id);
      dnaCache.set(ck, result);

      // Also invalidate the old DNA cache
      dnaCache.invalidate(cacheKey("dna", empresa_id));
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[auto-dna] ${result.status === "completo" ? "Completo" : "Erro"} em ${elapsed}s`
    );

    if (result.status === "erro") {
      return NextResponse.json(result, { status: 422 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[auto-dna] Erro fatal apos ${elapsed}s:`, error);

    return NextResponse.json(
      {
        status: "erro",
        error: error.message || "Erro interno na geracao automatica de DNA",
      },
      { status: 500 }
    );
  }
}
