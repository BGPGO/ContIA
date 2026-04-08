import { createClient } from "@/lib/supabase/server";
import { getOpenAIClient } from "@/lib/ai/config";
import { parseGPTJson } from "@/lib/ai/marca-dna";
import { getNoticiasForNicho } from "@/lib/rss";
import type { EnrichedSuggestion } from "@/types/suggestions";

// Cache suggestions for 30min
const suggestionsCache = new Map<string, { data: EnrichedSuggestion[]; expires: number }>();
const CACHE_TTL = 30 * 60 * 1000;

export async function generateSuggestions(empresaId: string): Promise<{
  suggestions: EnrichedSuggestion[];
  context: { news_count: number; recent_posts_analyzed: number; dna_available: boolean };
}> {
  // 1. Check cache
  const cached = suggestionsCache.get(empresaId);
  if (cached && cached.expires > Date.now()) {
    return { suggestions: cached.data, context: { news_count: 0, recent_posts_analyzed: 0, dna_available: false } };
  }

  const supabase = await createClient();

  // 2. Fetch brand DNA
  const { data: dnaRow } = await supabase
    .from("marca_dna")
    .select("dna_sintetizado")
    .eq("empresa_id", empresaId)
    .eq("status", "completo")
    .single();
  const dna = dnaRow?.dna_sintetizado || null;

  // 3. Fetch empresa info (for nicho)
  const { data: empresa } = await supabase
    .from("empresas")
    .select("nome, nicho, descricao")
    .eq("id", empresaId)
    .single();

  // 4. Fetch recent posts (from instagram_media_cache + posts table) for anti-repetition
  const [igPostsResult, localPostsResult] = await Promise.all([
    supabase
      .from("instagram_media_cache")
      .select("caption, media_type, timestamp")
      .eq("empresa_id", empresaId)
      .order("timestamp", { ascending: false })
      .limit(30),
    supabase
      .from("posts")
      .select("titulo, conteudo, tematica")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const recentIgPosts = igPostsResult.data || [];
  const recentLocalPosts = localPostsResult.data || [];

  // 5. Fetch news
  const nicho = empresa?.nicho || "geral";
  let news: any[] = [];
  try {
    news = await getNoticiasForNicho(nicho);
    news = news.slice(0, 10); // top 10 news
  } catch { /* news is optional */ }

  // 6. Build context for GPT
  const recentTopics = [
    ...recentIgPosts.map(p => p.caption?.slice(0, 100) || ""),
    ...recentLocalPosts.map(p => p.titulo || p.tematica || ""),
  ].filter(Boolean).slice(0, 20);

  const newsContext = news.map(n => `- ${n.titulo} (${n.fonte})`).join("\n");

  const dnaContext = dna ? `
DNA da Marca:
- Tom: ${dna.tom_de_voz || "não definido"}
- Pilares: ${(dna.pilares_conteudo || []).join(", ")}
- Temas recomendados: ${(dna.temas_recomendados || []).join(", ")}
- Público: ${dna.publico_alvo || "não definido"}
- Formatos recomendados: ${(dna.formatos_recomendados || []).join(", ")}
- Oportunidades: ${(dna.oportunidades || []).join(", ")}` : "DNA da marca não disponível.";

  // 7. Generate suggestions via GPT
  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Você é um estrategista de conteúdo digital sênior brasileiro com expertise em Instagram, LinkedIn e TikTok. Sua missão é gerar sugestões de posts ÚNICAS e RELEVANTES que:
1. Se encaixam nos pilares de conteúdo da marca
2. Aproveitam tendências e notícias recentes do mercado
3. NÃO repetem temas já postados recentemente
4. Variam entre formatos (post, carrossel, reels)
5. Têm hooks irresistíveis que fazem parar de rolar

Cada sugestão deve ter uma FONTE clara (por que está sendo sugerida).
Responda EXCLUSIVAMENTE em JSON válido, sem markdown.`,
      },
      {
        role: "user",
        content: `Gere 8 sugestões de posts para a marca "${empresa?.nome || "empresa"}" no nicho "${nicho}".

${dnaContext}

NOTÍCIAS RECENTES DO MERCADO:
${newsContext || "Nenhuma notícia disponível"}

POSTS RECENTES (NÃO repetir estes temas):
${recentTopics.map((t, i) => `${i + 1}. ${t}`).join("\n") || "Nenhum post recente"}

Gere exatamente 8 sugestões neste JSON:
{
  "suggestions": [
    {
      "topic": "título/tema do post sugerido",
      "format": "post|carrossel|reels",
      "reasoning": "por que esta sugestão é relevante agora (2-3 frases)",
      "hook": "gancho de abertura irresistível para o post",
      "source_type": "trending|news|gap|seasonal|engagement",
      "source_label": "nome curto da fonte (ex: Tendência no nicho, Notícia HubSpot, Gap identificado)",
      "source_detail": "detalhe da fonte (ex: título da notícia)",
      "source_url": "URL da notícia se aplicável, ou null",
      "confidence": 85,
      "category": "nome do pilar de conteúdo que se encaixa",
      "estimated_engagement": "alto|médio|baixo"
    }
  ]
}`,
      },
    ],
    temperature: 0.7,
    max_tokens: 3000,
  });

  const parsed = parseGPTJson(completion.choices[0]?.message?.content || "{}", { suggestions: [] });

  // 8. Map to EnrichedSuggestion type
  const suggestions: EnrichedSuggestion[] = (parsed.suggestions || []).map((s: any) => ({
    topic: s.topic || "",
    format: s.format || "post",
    reasoning: s.reasoning || "",
    hook: s.hook || "",
    source: {
      type: s.source_type || "gap",
      label: s.source_label || "Sugestão",
      detail: s.source_detail || undefined,
      url: s.source_url || undefined,
    },
    confidence: s.confidence || 50,
    category: s.category || "geral",
    estimated_engagement: s.estimated_engagement || "médio",
    related_news:
      s.source_type === "news" && s.source_detail
        ? {
            titulo: s.source_detail,
            fonte: s.source_label,
            url: s.source_url || "",
          }
        : undefined,
  }));

  // 9. Cache
  suggestionsCache.set(empresaId, { data: suggestions, expires: Date.now() + CACHE_TTL });

  return {
    suggestions,
    context: {
      news_count: news.length,
      recent_posts_analyzed: recentTopics.length,
      dna_available: !!dna,
    },
  };
}

export function invalidateSuggestionsCache(empresaId: string) {
  suggestionsCache.delete(empresaId);
}
