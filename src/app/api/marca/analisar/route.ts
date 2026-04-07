import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient, isAIConfigured } from "@/lib/ai/config";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { marcaAnalisarSchema, formatZodError } from "@/lib/validation";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  analyzeInstagram,
  analyzeSite,
  synthesizeDNA,
  safeAsync,
  getMockMarcaDNA,
  MarcaDNAResult,
} from "@/lib/ai/marca-dna";

// ── Types (local to this route) ──────────────────────────────────────────────

interface EmpresaData {
  id: string;
  nome: string;
  descricao: string;
  nicho: string;
  website: string | null;
  redes_sociais: {
    instagram?: { username: string; conectado: boolean };
    [key: string]: any;
  };
}

interface ConcorrenteData {
  id: string;
  nome: string;
  plataformas: Array<{ rede: string; username: string }>;
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // Rate limiting (analyze = 5 req/min)
  const clientIp = getClientIp(request);
  if (!checkRateLimit(clientIp, "analyze")) {
    return NextResponse.json(
      { error: "Limite de requisicoes excedido. Tente novamente em 1 minuto." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();

    // Input validation
    const parsed = marcaAnalisarSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 }
      );
    }

    const { empresaId } = parsed.data;

    console.log(`[MarcaDNA] Iniciando análise para empresa: ${empresaId}`);

    // ── Check if AI is configured ──
    if (!isAIConfigured()) {
      console.log("[MarcaDNA] AI não configurada — retornando mock");
      return NextResponse.json(getMockMarcaDNA(empresaId));
    }

    const openai = getOpenAIClient();

    // ── Load empresa data ──
    let empresa: EmpresaData | null = null;
    let concorrentes: ConcorrenteData[] = [];

    if (isSupabaseConfigured()) {
      try {
        const { createClient } = await import("@/lib/supabase/server");
        const supabase = await createClient();

        // Fetch empresa
        const { data: empresaData, error: empresaError } = await supabase
          .from("empresas")
          .select("*")
          .eq("id", empresaId)
          .single();

        if (empresaError || !empresaData) {
          console.error("[MarcaDNA] Empresa não encontrada:", empresaError);
          return NextResponse.json(
            { error: "Empresa não encontrada" },
            { status: 404 }
          );
        }

        empresa = empresaData as EmpresaData;

        // Fetch concorrentes with plataformas
        const { data: concorrentesData } = await supabase
          .from("concorrentes")
          .select("id, nome")
          .eq("empresa_id", empresaId);

        if (concorrentesData && concorrentesData.length > 0) {
          const concorrenteIds = concorrentesData.map((c: any) => c.id);
          const { data: plataformasData } = await supabase
            .from("concorrente_plataformas")
            .select("concorrente_id, rede, username")
            .in("concorrente_id", concorrenteIds);

          concorrentes = concorrentesData.map((c: any) => ({
            id: c.id,
            nome: c.nome,
            plataformas: (plataformasData || [])
              .filter((p: any) => p.concorrente_id === c.id)
              .map((p: any) => ({ rede: p.rede, username: p.username })),
          }));
        }

        console.log(
          `[MarcaDNA] Empresa: ${empresa.nome} | Concorrentes: ${concorrentes.length}`
        );
      } catch (err) {
        console.error("[MarcaDNA] Erro ao acessar Supabase:", err);
        // Continue with mock empresa if Supabase fails
      }
    }

    // If no empresa loaded, use mock
    if (!empresa) {
      console.log("[MarcaDNA] Supabase não disponível — usando dados mock");
      empresa = {
        id: empresaId,
        nome: "Empresa Demo",
        descricao: "Empresa de demonstração para teste da plataforma",
        nicho: "Marketing Digital",
        website: null,
        redes_sociais: {},
      };
    }

    // ── Phase 1: Parallel analyses ──
    console.log("[MarcaDNA] Fase 1: Análises em paralelo...");

    const igUsername = empresa.redes_sociais?.instagram?.username;
    const siteUrl = empresa.website;

    // Build all analysis promises
    const analysisPromises: Promise<any>[] = [];
    const analysisLabels: string[] = [];

    // Own Instagram
    if (igUsername) {
      analysisPromises.push(
        safeAsync("instagram_empresa", () =>
          analyzeInstagram(igUsername, openai)
        )
      );
      analysisLabels.push("instagram_empresa");
    }

    // Own website
    if (siteUrl) {
      analysisPromises.push(
        safeAsync("site_empresa", () => analyzeSite(siteUrl, openai))
      );
      analysisLabels.push("site_empresa");
    }

    // Competitor Instagram analyses
    const concorrenteIgMap: Array<{ nome: string; username: string }> = [];
    for (const conc of concorrentes) {
      const igPlat = conc.plataformas.find((p) => p.rede === "instagram");
      if (igPlat?.username) {
        concorrenteIgMap.push({ nome: conc.nome, username: igPlat.username });
        analysisPromises.push(
          safeAsync(`concorrente_${conc.nome}`, () =>
            analyzeInstagram(igPlat.username, openai)
          )
        );
        analysisLabels.push(`concorrente_${conc.nome}`);
      }
    }

    // Execute all in parallel
    const results = await Promise.all(analysisPromises);

    // Map results back
    let resultIdx = 0;
    const analiseInstagram = igUsername ? results[resultIdx++] : null;
    const analiseSite = siteUrl ? results[resultIdx++] : null;

    const analisesConcorrentes: Record<string, any> = {};
    for (const conc of concorrenteIgMap) {
      analisesConcorrentes[conc.nome] = results[resultIdx++] || null;
    }

    // For now, references are empty (can be extended later with empresa.referencias)
    const analisesReferencias: Record<string, any> = {};

    const analysisCount = results.filter((r) => r !== null).length;
    console.log(
      `[MarcaDNA] Fase 1 completa: ${analysisCount}/${results.length} análises bem-sucedidas`
    );

    // ── Phase 2: Synthesis ──
    console.log("[MarcaDNA] Fase 2: Sintetizando DNA...");

    const dnaSintetizado = await synthesizeDNA(
      empresa.nome,
      empresa.nicho,
      analiseInstagram,
      analiseSite,
      analisesConcorrentes,
      analisesReferencias,
      openai
    );

    // ── Build result ──
    const marcaDNA: MarcaDNAResult = {
      empresa_id: empresaId,
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

    // ── Phase 3: Save to database (if available) ──
    if (isSupabaseConfigured()) {
      try {
        const { createClient } = await import("@/lib/supabase/server");
        const supabase = await createClient();

        // Upsert into marca_dna table
        const { data: saved, error: saveError } = await supabase
          .from("marca_dna")
          .upsert(
            {
              empresa_id: empresaId,
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
            "[MarcaDNA] Erro ao salvar no banco (tabela marca_dna pode não existir):",
            saveError.message
          );
          // Don't fail — still return the result
        } else if (saved) {
          marcaDNA.id = saved.id;
          console.log(`[MarcaDNA] Salvo no banco: ${saved.id}`);
        }
      } catch (err) {
        console.warn("[MarcaDNA] Erro ao salvar:", err);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[MarcaDNA] Análise completa em ${elapsed}s`);

    return NextResponse.json(marcaDNA);
  } catch (error: any) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[MarcaDNA] Erro fatal após ${elapsed}s:`, error);

    return NextResponse.json(
      {
        status: "erro",
        error: error.message || "Erro interno na análise de marca",
      },
      { status: 500 }
    );
  }
}
