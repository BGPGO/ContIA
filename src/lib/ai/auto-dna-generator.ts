import OpenAI from "openai";
import { getProfile, getMedia, getInsights } from "@/lib/instagram";
import type { IGProfile, IGMedia, IGInsight } from "@/lib/instagram";
import { parseGPTJson, type DNASintetizado, type MarcaDNAResult } from "./marca-dna";

// ── Types ────────────────────────────────────────────────────────────────────

interface InstagramRawData {
  profile: IGProfile;
  media: IGMedia[];
  insights: IGInsight[];
}

interface PostAnalysis {
  caption: string;
  type: string;
  likes: number;
  comments: number;
  engagement_rate: number;
  timestamp: string;
  days_ago: number;
}

interface AutoDNAInput {
  empresaId: string;
  empresaNome: string;
  empresaNicho: string;
  igData: InstagramRawData;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function calculateEngagementRate(
  likes: number,
  comments: number,
  followers: number
): number {
  if (followers === 0) return 0;
  return Number((((likes + comments) / followers) * 100).toFixed(2));
}

function daysSince(dateStr: string): number {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function analyzePostingFrequency(media: IGMedia[]): string {
  if (media.length < 2) return "Dados insuficientes";
  const sorted = [...media].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const firstDate = new Date(sorted[0].timestamp).getTime();
  const lastDate = new Date(sorted[sorted.length - 1].timestamp).getTime();
  const daySpan = Math.max(1, (lastDate - firstDate) / (1000 * 60 * 60 * 24));
  const postsPerWeek = Number(((media.length / daySpan) * 7).toFixed(1));
  return `~${postsPerWeek} posts/semana (${media.length} posts em ${Math.round(daySpan)} dias)`;
}

function getMediaTypeDistribution(
  media: IGMedia[]
): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const m of media) {
    const t = m.media_type || "UNKNOWN";
    dist[t] = (dist[t] || 0) + 1;
  }
  return dist;
}

function getTopPosts(
  posts: PostAnalysis[],
  count: number
): PostAnalysis[] {
  return [...posts]
    .sort((a, b) => b.engagement_rate - a.engagement_rate)
    .slice(0, count);
}

function getWorstPosts(
  posts: PostAnalysis[],
  count: number
): PostAnalysis[] {
  return [...posts]
    .filter((p) => p.caption.length > 10) // skip empty captions
    .sort((a, b) => a.engagement_rate - b.engagement_rate)
    .slice(0, count);
}

// ── Fetch Instagram Data ─────────────────────────────────────────────────────

export async function fetchInstagramDataFromAPI(
  empresaId: string,
  supabaseClient: any
): Promise<{ igData: InstagramRawData; connection: any }> {
  // Get the Instagram connection for this empresa
  const { data: connection, error: connError } = await supabaseClient
    .from("social_connections")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("provider", "instagram")
    .eq("is_active", true)
    .single();

  if (connError || !connection) {
    throw new Error(
      "Instagram nao conectado para esta empresa. Conecte primeiro em /conexoes."
    );
  }

  const token = connection.access_token;
  const igUserId = connection.provider_user_id;

  if (!token || !igUserId) {
    throw new Error("Token ou user ID do Instagram ausente na conexao.");
  }

  // Fetch all data in parallel
  const [profile, media, insights] = await Promise.all([
    getProfile(igUserId, token),
    getMedia(igUserId, token, 30),
    getInsights(igUserId, token, "day").catch(() => [] as IGInsight[]),
  ]);

  return {
    igData: { profile, media, insights },
    connection,
  };
}

// ── Build Rich Context ───────────────────────────────────────────────────────

function buildAnalysisContext(input: AutoDNAInput): string {
  const { empresaNome, empresaNicho, igData } = input;
  const { profile, media, insights } = igData;

  // Analyze each post
  const postAnalyses: PostAnalysis[] = media.map((m) => ({
    caption: m.caption || "",
    type: m.media_type,
    likes: m.like_count || 0,
    comments: m.comments_count || 0,
    engagement_rate: calculateEngagementRate(
      m.like_count || 0,
      m.comments_count || 0,
      profile.followers_count
    ),
    timestamp: m.timestamp,
    days_ago: daysSince(m.timestamp),
  }));

  const avgEngagement =
    postAnalyses.length > 0
      ? (
          postAnalyses.reduce((s, p) => s + p.engagement_rate, 0) /
          postAnalyses.length
        ).toFixed(2)
      : "0";

  const topPosts = getTopPosts(postAnalyses, 5);
  const worstPosts = getWorstPosts(postAnalyses, 3);
  const typeDistribution = getMediaTypeDistribution(media);
  const postingFrequency = analyzePostingFrequency(media);

  // Insights summary
  const insightsSummary = insights
    .map((i) => {
      const latestValue = i.values?.[i.values.length - 1]?.value ?? "N/A";
      return `${i.title || i.name}: ${latestValue} (${i.period})`;
    })
    .join("\n");

  // All captions for tone analysis
  const allCaptions = postAnalyses
    .filter((p) => p.caption.length > 20)
    .map(
      (p, i) =>
        `[Post ${i + 1} | ${p.type} | Eng: ${p.engagement_rate}% | ${p.likes} likes, ${p.comments} comments | ${p.days_ago}d ago]\n${p.caption.slice(0, 500)}${p.caption.length > 500 ? "..." : ""}`
    )
    .join("\n\n");

  // Top posts detail
  const topPostsDetail = topPosts
    .map(
      (p, i) =>
        `TOP ${i + 1} (${p.engagement_rate}% eng | ${p.type}):\n"${p.caption.slice(0, 300)}"`
    )
    .join("\n\n");

  // Worst posts detail
  const worstPostsDetail = worstPosts
    .map(
      (p, i) =>
        `LOW ${i + 1} (${p.engagement_rate}% eng | ${p.type}):\n"${p.caption.slice(0, 200)}"`
    )
    .join("\n\n");

  return `
=== DADOS REAIS DO INSTAGRAM (via API) ===

EMPRESA: ${empresaNome}
NICHO: ${empresaNicho}

--- PERFIL ---
Username: @${profile.username}
Nome: ${profile.name || "N/A"}
Bio: ${profile.biography || "Sem bio"}
Website: ${profile.website || "N/A"}
Seguidores: ${profile.followers_count.toLocaleString("pt-BR")}
Seguindo: ${profile.follows_count.toLocaleString("pt-BR")}
Total de posts: ${profile.media_count}

--- METRICAS GERAIS ---
Engajamento medio: ${avgEngagement}%
Frequencia de postagem: ${postingFrequency}
Distribuicao de formatos: ${JSON.stringify(typeDistribution)}

--- INSIGHTS DA CONTA (ultimos dados) ---
${insightsSummary || "Insights nao disponiveis"}

--- TOP 5 POSTS (maior engajamento) ---
${topPostsDetail || "Sem dados suficientes"}

--- 3 POSTS COM MENOR ENGAJAMENTO ---
${worstPostsDetail || "Sem dados suficientes"}

--- TODAS AS LEGENDAS (${postAnalyses.length} posts) ---
${allCaptions || "Sem legendas disponiveis"}
`.trim();
}

// ── Generate DNA with OpenAI ─────────────────────────────────────────────────

export async function generateAutoDNA(
  input: AutoDNAInput,
  openai: OpenAI
): Promise<DNASintetizado> {
  const context = buildAnalysisContext(input);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `Voce e o maior especialista em branding digital e estrategia de conteudo do Brasil. Tem 20+ anos de experiencia com marcas de todos os portes e nichos.

Voce recebeu acesso REAL a dados do Instagram de uma marca via API — isso inclui todas as legendas reais, metricas de engajamento reais, dados de perfil reais e insights da conta. Estes NAO sao dados inventados — sao dados reais que o usuario autorizou.

Sua missao: analisar PROFUNDAMENTE todos esses dados e criar o DNA completo da marca. Cada insight deve ser baseado em evidencias dos dados reais.

DIRETRIZES DE ANALISE:

1. TOM DE VOZ — Leia TODAS as legendas e identifique:
   - Nivel de formalidade (formal, semi-formal, informal, coloquial)
   - Uso de emojis (quais, frequencia)
   - Estrutura das frases (curtas/longas, perguntas, imperativos)
   - Palavras e expressoes recorrentes
   - Se usa storytelling, dados, humor, urgencia
   - Diferenca de tom entre posts de alto e baixo engajamento

2. PERSONALIDADE DA MARCA — Baseado nas legendas e bio:
   - Se fosse uma pessoa, como seria?
   - Quais valores transparecem?
   - Qual a postura: lider, parceiro, mentor, amigo?

3. PILARES DE CONTEUDO — Agrupe as legendas por tema:
   - Identifique 3-5 pilares tematicos claros
   - Qual pilar gera mais engajamento?
   - Ha pilares que faltam mas seriam estrategicos?

4. ENGAJAMENTO — Analise os numeros reais:
   - Quais TIPOS de post performam melhor (IMAGE, VIDEO, CAROUSEL)?
   - Quais TEMAS geram mais engajamento?
   - Qual o padrao de engagement rate? Esta bom para o nicho?
   - O que os top posts tem em comum?
   - O que os piores posts tem em comum?

5. HASHTAGS — Extraia das legendas reais:
   - Quais hashtags usa atualmente?
   - Quais parecem funcionar (posts com mais engajamento)?
   - Sugira novas hashtags estrategicas

6. FREQUENCIA — Baseado nos timestamps reais:
   - Qual a frequencia atual?
   - Esta adequada?
   - Qual seria a ideal para o nicho?

7. CORES E VISUAL — Inferir da bio, captions e tipo de conteudo:
   - Sugerir paleta que combine com o posicionamento
   - Estilo visual coerente com o tom

8. OPORTUNIDADES — Baseado em gaps nos dados:
   - Formatos subutilizados
   - Temas inexplorados
   - Horarios/dias nao testados
   - Comparacao com benchmarks do nicho

REGRAS:
- TODOS os textos em Portugues Brasileiro (PT-BR)
- Seja ESPECIFICO — cite trechos das legendas reais como exemplos
- Cada recomendacao deve ter JUSTIFICATIVA baseada nos dados
- Os exemplos de legenda devem seguir o estilo identificado, nao ser genericos
- Responda EXCLUSIVAMENTE em JSON valido, sem markdown, sem code blocks`,
      },
      {
        role: "user",
        content: `Analise todos os dados reais abaixo e gere o DNA completo da marca "${input.empresaNome}" (nicho: ${input.empresaNicho}).

${context}

Responda neste JSON EXATO (TODOS os campos sao obrigatorios):
{
  "tom_de_voz": "descricao detalhada do tom de voz com exemplos reais das legendas (4-6 frases)",
  "personalidade_marca": "personalidade da marca como pessoa, baseada no que as legendas revelam (4-6 frases)",
  "proposta_valor": "proposta de valor unica extraida do conteudo real (2-3 frases)",
  "publico_alvo": "publico-alvo detalhado baseado no tipo de conteudo e engajamento (3-4 frases com dados demograficos e psicograficos)",
  "paleta_cores": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
  "estilo_visual": "estilo visual recomendado baseado no posicionamento e nicho (3-4 frases sobre tipografia, layout, fotografia)",
  "pilares_conteudo": ["pilar1 — descricao com base nos dados", "pilar2 — descricao", "pilar3 — descricao", "pilar4 — descricao"],
  "temas_recomendados": ["tema1", "tema2", "tema3", "tema4", "tema5", "tema6", "tema7", "tema8", "tema9", "tema10"],
  "formatos_recomendados": ["formato1 — justificativa com base no engajamento real", "formato2 — justificativa", "formato3 — justificativa"],
  "hashtags_recomendadas": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5", "#tag6", "#tag7", "#tag8", "#tag9", "#tag10"],
  "frequencia_ideal": "recomendacao de frequencia por formato baseada na analise dos timestamps reais e engajamento",
  "diferenciais_vs_concorrentes": ["diferencial1 com justificativa baseada nos dados", "diferencial2", "diferencial3"],
  "oportunidades": ["oportunidade1 — acao sugerida baseada em gap identificado", "oportunidade2", "oportunidade3", "oportunidade4"],
  "palavras_usar": ["palavra1", "palavra2", "palavra3", "palavra4", "palavra5", "palavra6", "palavra7"],
  "palavras_evitar": ["palavra1", "palavra2", "palavra3", "palavra4", "palavra5"],
  "exemplos_legenda": ["legenda exemplo 1 completa no estilo identificado com CTA e hashtags", "legenda 2 estilo diferente", "legenda 3 formato educacional"]
}`,
      },
    ],
    temperature: 0.5,
    max_tokens: 5000,
  });

  const raw = completion.choices[0]?.message?.content || "{}";
  return parseGPTJson(raw, {
    tom_de_voz: "Analise incompleta — tente novamente",
    personalidade_marca: "Analise incompleta",
    proposta_valor: `Referencia em ${input.empresaNicho}`,
  }) as DNASintetizado;
}

// ── Build Instagram Analysis Summary ─────────────────────────────────────────

function buildInstagramAnalysisSummary(
  igData: InstagramRawData
): Record<string, any> {
  const { profile, media, insights } = igData;

  const postAnalyses = media.map((m) => ({
    type: m.media_type,
    likes: m.like_count || 0,
    comments: m.comments_count || 0,
    engagement_rate: calculateEngagementRate(
      m.like_count || 0,
      m.comments_count || 0,
      profile.followers_count
    ),
    caption_length: (m.caption || "").length,
    timestamp: m.timestamp,
  }));

  const avgEngagement =
    postAnalyses.length > 0
      ? Number(
          (
            postAnalyses.reduce((s, p) => s + p.engagement_rate, 0) /
            postAnalyses.length
          ).toFixed(2)
        )
      : 0;

  return {
    source: "instagram_api",
    fetched_at: new Date().toISOString(),
    profile: {
      username: profile.username,
      name: profile.name,
      biography: profile.biography,
      followers_count: profile.followers_count,
      follows_count: profile.follows_count,
      media_count: profile.media_count,
    },
    metrics: {
      posts_analyzed: media.length,
      avg_engagement_rate: avgEngagement,
      type_distribution: getMediaTypeDistribution(media),
      posting_frequency: analyzePostingFrequency(media),
    },
    insights: insights.map((i) => ({
      name: i.name,
      period: i.period,
      latest_value: i.values?.[i.values.length - 1]?.value ?? null,
    })),
    top_posts: postAnalyses
      .sort((a, b) => b.engagement_rate - a.engagement_rate)
      .slice(0, 5),
  };
}

// ── Main: Full Auto DNA Pipeline ─────────────────────────────────────────────

export async function runAutoDNA(
  empresaId: string,
  supabaseClient: any,
  openai: OpenAI
): Promise<MarcaDNAResult> {
  console.log(`[AutoDNA] Iniciando para empresa: ${empresaId}`);

  // 1. Set status to processing
  await supabaseClient
    .from("marca_dna")
    .upsert(
      {
        empresa_id: empresaId,
        status: "processando",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "empresa_id" }
    );

  try {
    // 2. Load empresa data
    const { data: empresa, error: empError } = await supabaseClient
      .from("empresas")
      .select("nome, nicho, descricao")
      .eq("id", empresaId)
      .single();

    if (empError || !empresa) {
      throw new Error(`Empresa nao encontrada: ${empresaId}`);
    }

    // 3. Fetch real Instagram data
    console.log("[AutoDNA] Buscando dados reais do Instagram via API...");
    const { igData } = await fetchInstagramDataFromAPI(
      empresaId,
      supabaseClient
    );

    console.log(
      `[AutoDNA] Dados obtidos: ${igData.media.length} posts, ${igData.profile.followers_count} seguidores`
    );

    // 4. Generate DNA with AI
    console.log("[AutoDNA] Gerando DNA com IA (GPT-4o)...");
    const dna = await generateAutoDNA(
      {
        empresaId,
        empresaNome: empresa.nome || "Empresa",
        empresaNicho: empresa.nicho || "Geral",
        igData,
      },
      openai
    );

    // 5. Build the instagram analysis summary for storage
    const analiseInstagram = buildInstagramAnalysisSummary(igData);

    // 6. Save to database
    const marcaDNA: MarcaDNAResult = {
      empresa_id: empresaId,
      status: "completo",
      analise_instagram: analiseInstagram,
      analise_site: null,
      analises_concorrentes: null,
      analises_referencias: null,
      dna_sintetizado: dna,
      updated_at: new Date().toISOString(),
    };

    const { data: saved, error: saveError } = await supabaseClient
      .from("marca_dna")
      .upsert(
        {
          empresa_id: empresaId,
          status: "completo",
          analise_instagram: analiseInstagram,
          dna_sintetizado: dna,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "empresa_id" }
      )
      .select()
      .single();

    if (saveError) {
      console.error("[AutoDNA] Erro ao salvar no banco:", saveError.message);
    } else if (saved) {
      marcaDNA.id = saved.id;
      console.log(`[AutoDNA] DNA salvo com sucesso: ${saved.id}`);
    }

    return marcaDNA;
  } catch (error: any) {
    console.error("[AutoDNA] Erro:", error.message);

    // Update status to error
    await supabaseClient
      .from("marca_dna")
      .upsert(
        {
          empresa_id: empresaId,
          status: "erro",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "empresa_id" }
      );

    return {
      empresa_id: empresaId,
      status: "erro",
      erro: error.message,
    };
  }
}
