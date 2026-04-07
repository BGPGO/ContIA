import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient, isAIConfigured } from "@/lib/ai/config";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  analyzeInstagram,
  analyzeSite,
  synthesizeDNA,
  safeAsync,
  getMockMarcaDNA,
  MarcaDNAResult,
} from "@/lib/ai/marca-dna";
import { runAutoDNA } from "@/lib/ai/auto-dna-generator";
import { dnaCache, cacheKey } from "@/lib/cache";

// ── POST /api/ai/analyze-dna ─────────────────────────────────────────────────
//
// Called by DNASetup.tsx after it persists empresa data in Supabase.
// Receives sources directly in the body (instagram_handle, website, etc.)
// so it can also handle concorrentes/referencias that aren't in the DB yet.
//
// NEW: When `source: "instagram_connected"` is passed, uses the auto-dna
// pipeline with REAL Instagram API data instead of scraping.

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();

    const {
      empresa_id,
      source,
      instagram_handle,
      website,
      concorrentes_ig,
      referencias_ig,
      referencias_sites,
    } = body as {
      empresa_id?: string;
      source?: string;
      instagram_handle?: string;
      website?: string;
      concorrentes_ig?: string[];
      referencias_ig?: string[];
      referencias_sites?: string[];
    };

    // ── Validate ──
    if (!empresa_id) {
      return NextResponse.json(
        { error: "Campo 'empresa_id' é obrigatório" },
        { status: 400 }
      );
    }

    // ── Instagram Connected Mode ──
    // When source is "instagram_connected", use real API data pipeline
    if (source === "instagram_connected") {
      console.log(
        `[analyze-dna] Modo instagram_connected para empresa: ${empresa_id}`
      );

      if (!isAIConfigured()) {
        return NextResponse.json(
          { error: "OpenAI nao configurada" },
          { status: 503 }
        );
      }

      if (!isSupabaseConfigured()) {
        return NextResponse.json(
          { error: "Supabase nao configurado" },
          { status: 503 }
        );
      }

      const openai = getOpenAIClient();
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();

      const result = await runAutoDNA(empresa_id, supabase, openai);

      if (result.status === "completo") {
        dnaCache.set(cacheKey("dna", empresa_id), result);
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[analyze-dna] Auto-DNA completo em ${elapsed}s`);

      return NextResponse.json(result, {
        status: result.status === "erro" ? 422 : 200,
      });
    }

    // ── Legacy scraping mode (backward compatible) ──

    // Cache check
    const ck = cacheKey("dna", empresa_id);
    const cached = dnaCache.get<MarcaDNAResult>(ck);
    if (cached) {
      console.log(`[analyze-dna] Cache hit para empresa: ${empresa_id}`);
      return NextResponse.json({ ...cached, _cached: true });
    }

    console.log(`[analyze-dna] Iniciando análise para empresa: ${empresa_id}`);

    // ── Check if AI is configured ──
    if (!isAIConfigured()) {
      console.log("[analyze-dna] AI não configurada — retornando mock");
      return NextResponse.json(getMockMarcaDNA(empresa_id));
    }

    const openai = getOpenAIClient();

    // ── Load empresa from Supabase (for nome/nicho context) ──
    let empresaNome = "Empresa";
    let empresaNicho = "Geral";

    if (isSupabaseConfigured()) {
      try {
        const { createClient } = await import("@/lib/supabase/server");
        const supabase = await createClient();

        const { data: empresaData, error: empresaError } = await supabase
          .from("empresas")
          .select("nome, nicho, descricao")
          .eq("id", empresa_id)
          .single();

        if (empresaError || !empresaData) {
          console.error("[analyze-dna] Empresa não encontrada:", empresaError);
          return NextResponse.json(
            { error: "Empresa não encontrada" },
            { status: 404 }
          );
        }

        empresaNome = empresaData.nome || empresaNome;
        empresaNicho = empresaData.nicho || empresaNicho;

        console.log(
          `[analyze-dna] Empresa: ${empresaNome} | Nicho: ${empresaNicho}`
        );
      } catch (err) {
        console.error("[analyze-dna] Erro ao acessar Supabase:", err);
        // Continue with defaults
      }
    }

    // ── Phase 1: Parallel analyses ──
    console.log("[analyze-dna] Fase 1: Análises em paralelo...");

    const analysisPromises: Promise<any>[] = [];
    const analysisLabels: string[] = [];

    // Own Instagram
    const igHandle = instagram_handle?.replace("@", "").trim();
    if (igHandle) {
      analysisPromises.push(
        safeAsync("instagram_empresa", () =>
          analyzeInstagram(igHandle, openai)
        )
      );
      analysisLabels.push("instagram_empresa");
    }

    // Own website
    if (website) {
      const siteUrl = website.startsWith("http")
        ? website
        : `https://${website}`;
      analysisPromises.push(
        safeAsync("site_empresa", () => analyzeSite(siteUrl, openai))
      );
      analysisLabels.push("site_empresa");
    }

    // Competitor Instagram analyses (from request body, not DB)
    const concorrenteHandles = (concorrentes_ig || [])
      .map((h) => h.replace("@", "").trim())
      .filter(Boolean);

    for (const handle of concorrenteHandles) {
      analysisPromises.push(
        safeAsync(`concorrente_@${handle}`, () =>
          analyzeInstagram(handle, openai)
        )
      );
      analysisLabels.push(`concorrente_@${handle}`);
    }

    // Reference Instagram analyses
    const refIgHandles = (referencias_ig || [])
      .map((h) => h.replace("@", "").trim())
      .filter(Boolean);

    for (const handle of refIgHandles) {
      analysisPromises.push(
        safeAsync(`referencia_ig_@${handle}`, () =>
          analyzeInstagram(handle, openai)
        )
      );
      analysisLabels.push(`referencia_ig_@${handle}`);
    }

    // Reference site analyses
    const refSites = (referencias_sites || []).filter(Boolean);

    for (const site of refSites) {
      const siteUrl = site.startsWith("http") ? site : `https://${site}`;
      analysisPromises.push(
        safeAsync(`referencia_site_${site}`, () =>
          analyzeSite(siteUrl, openai)
        )
      );
      analysisLabels.push(`referencia_site_${site}`);
    }

    // Execute all in parallel
    const results = await Promise.all(analysisPromises);

    // Map results back
    let resultIdx = 0;
    const analiseInstagram = igHandle ? results[resultIdx++] : null;
    const analiseSite = website ? results[resultIdx++] : null;

    const analisesConcorrentes: Record<string, any> = {};
    for (const handle of concorrenteHandles) {
      analisesConcorrentes[`@${handle}`] = results[resultIdx++] || null;
    }

    const analisesReferencias: Record<string, any> = {};
    for (const handle of refIgHandles) {
      analisesReferencias[`ig:@${handle}`] = results[resultIdx++] || null;
    }
    for (const site of refSites) {
      analisesReferencias[`site:${site}`] = results[resultIdx++] || null;
    }

    const analysisCount = results.filter((r) => r !== null).length;
    console.log(
      `[analyze-dna] Fase 1 completa: ${analysisCount}/${results.length} análises bem-sucedidas`
    );

    // ── Phase 2: Synthesis ──
    console.log("[analyze-dna] Fase 2: Sintetizando DNA...");

    const dnaSintetizado = await synthesizeDNA(
      empresaNome,
      empresaNicho,
      analiseInstagram,
      analiseSite,
      analisesConcorrentes,
      analisesReferencias,
      openai
    );

    // ── Build result ──
    const marcaDNA: MarcaDNAResult = {
      empresa_id,
      status: "completo",
      analise_instagram: analiseInstagram,
      analise_site: analiseSite,
      analises_concorrentes:
        Object.keys(analisesConcorrentes).length > 0
          ? analisesConcorrentes
          : null,
      analises_referencias:
        Object.keys(analisesReferencias).length > 0
          ? analisesReferencias
          : null,
      dna_sintetizado: dnaSintetizado,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // ── Phase 3: Save to database ──
    if (isSupabaseConfigured()) {
      try {
        const { createClient } = await import("@/lib/supabase/server");
        const supabase = await createClient();

        const { data: saved, error: saveError } = await supabase
          .from("marca_dna")
          .upsert(
            {
              empresa_id,
              status: marcaDNA.status,
              analise_instagram: marcaDNA.analise_instagram,
              analise_site: marcaDNA.analise_site,
              analises_concorrentes: marcaDNA.analises_concorrentes,
              analises_referencias: marcaDNA.analises_referencias,
              dna_sintetizado: marcaDNA.dna_sintetizado,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "empresa_id" }
          )
          .select()
          .single();

        if (saveError) {
          console.warn(
            "[analyze-dna] Erro ao salvar no banco (tabela marca_dna pode não existir):",
            saveError.message
          );
        } else if (saved) {
          marcaDNA.id = saved.id;
          console.log(`[analyze-dna] Salvo no banco: ${saved.id}`);
        }
      } catch (err) {
        console.warn("[analyze-dna] Erro ao salvar:", err);
      }
    }

    // Salvar no cache (24h)
    dnaCache.set(ck, marcaDNA);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[analyze-dna] Análise completa em ${elapsed}s`);

    return NextResponse.json(marcaDNA);
  } catch (error: any) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[analyze-dna] Erro fatal após ${elapsed}s:`, error);

    return NextResponse.json(
      {
        status: "erro",
        error: error.message || "Erro interno na análise de DNA da marca",
      },
      { status: 500 }
    );
  }
}
