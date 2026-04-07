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

interface VisualAnalysisResult {
  cores_dominantes: string[];
  consistencia_visual: number;
  estilo_fotografico: string;
  uso_tipografia: string;
  mood: string;
  tipos_conteudo: string[];
  raw_description: string;
}

interface WebsiteAnalysisResult {
  title: string;
  description: string;
  og_tags: Record<string, string>;
  raw_text: string;
}

interface AutoDNAInput {
  empresaId: string;
  empresaNome: string;
  empresaNicho: string;
  igData: InstagramRawData;
  visualAnalysis?: VisualAnalysisResult | null;
  websiteAnalysis?: WebsiteAnalysisResult | null;
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

// ── Posting Time Analysis ───────────────────────────────────────────────────

function analyzePostingTimes(media: IGMedia[]): string {
  if (media.length < 3) return "Dados insuficientes para analise de horarios";

  const hourCounts: Record<number, { count: number; totalEng: number }> = {};
  const dayCounts: Record<number, { count: number; totalEng: number }> = {};

  for (const m of media) {
    const date = new Date(m.timestamp);
    const hour = date.getUTCHours();
    const day = date.getUTCDay();
    const eng = (m.like_count || 0) + (m.comments_count || 0);

    if (!hourCounts[hour]) hourCounts[hour] = { count: 0, totalEng: 0 };
    hourCounts[hour].count++;
    hourCounts[hour].totalEng += eng;

    if (!dayCounts[day]) dayCounts[day] = { count: 0, totalEng: 0 };
    dayCounts[day].count++;
    dayCounts[day].totalEng += eng;
  }

  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

  const topHours = Object.entries(hourCounts)
    .sort(([, a], [, b]) => (b.totalEng / b.count) - (a.totalEng / a.count))
    .slice(0, 3)
    .map(([h, d]) => `${h}h (${d.count} posts, eng medio ${Math.round(d.totalEng / d.count)})`)
    .join(", ");

  const topDays = Object.entries(dayCounts)
    .sort(([, a], [, b]) => (b.totalEng / b.count) - (a.totalEng / a.count))
    .slice(0, 3)
    .map(([d, data]) => `${dayNames[Number(d)]} (${data.count} posts, eng medio ${Math.round(data.totalEng / data.count)})`)
    .join(", ");

  return `Melhores horarios (UTC): ${topHours}\nMelhores dias: ${topDays}`;
}

// ── Visual Analysis with GPT-4o Vision ──────────────────────────────────────

/**
 * Sends top posts' images to GPT-4o Vision to extract real color palettes,
 * visual style, and mood from the actual feed images.
 * Only IMAGE posts are sent (not VIDEO). Limited to 6 images for cost control.
 */
async function analyzeVisualIdentity(
  media: IGMedia[],
  openai: OpenAI
): Promise<VisualAnalysisResult | null> {
  try {
    // Filter to IMAGE-only posts and sort by engagement (highest first)
    const imagePosts = media
      .filter((m) => m.media_type === "IMAGE" && m.media_url)
      .sort((a, b) => {
        const engA = (a.like_count || 0) + (a.comments_count || 0);
        const engB = (b.like_count || 0) + (b.comments_count || 0);
        return engB - engA;
      })
      .slice(0, 6);

    if (imagePosts.length === 0) {
      console.log("[AutoDNA Vision] Nenhuma imagem encontrada para analise visual");
      return null;
    }

    console.log(`[AutoDNA Vision] Analisando ${imagePosts.length} imagens do feed...`);

    // Build the content array with text prompt + image URLs
    const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      {
        type: "text",
        text: `Analise estas ${imagePosts.length} imagens do feed de Instagram desta marca. Para cada imagem, identifique:
1. Cores dominantes (hex codes)
2. Estilo visual (minimalista, colorido, escuro, claro, etc.)
3. Tipo de conteudo (foto produto, lifestyle, quote, infografico, etc.)
4. Qualidade e consistencia visual

Depois, sintetize uma analise geral:
- Paleta de cores que realmente aparece no feed (5 hex codes, ordenadas por frequencia)
- Nivel de consistencia visual (1-10)
- Estilo fotografico predominante
- Uso de texto/tipografia nas imagens
- Mood/atmosfera geral

Responda EXCLUSIVAMENTE em JSON valido, sem markdown, sem code blocks:
{
  "cores_dominantes": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
  "consistencia_visual": 7,
  "estilo_fotografico": "descricao do estilo predominante",
  "uso_tipografia": "descricao de como texto aparece nas imagens",
  "mood": "descricao da atmosfera geral",
  "tipos_conteudo": ["tipo1", "tipo2", "tipo3"]
}`,
      },
    ];

    // Add each image URL (using detail: "low" for cost efficiency)
    for (const post of imagePosts) {
      content.push({
        type: "image_url",
        image_url: {
          url: post.media_url,
          detail: "low",
        },
      });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "Voce e um especialista em design grafico e identidade visual. Analise as imagens com precisao tecnica, especialmente na identificacao de cores hexadecimais reais. Responda EXCLUSIVAMENTE em JSON valido.",
        },
        {
          role: "user",
          content,
        },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    const parsed = parseGPTJson(raw, null);

    if (!parsed || !parsed.cores_dominantes) {
      console.warn("[AutoDNA Vision] Resposta da Vision API nao continha dados validos");
      return null;
    }

    console.log(
      `[AutoDNA Vision] Cores encontradas: ${parsed.cores_dominantes.join(", ")}`
    );

    return {
      cores_dominantes: parsed.cores_dominantes || [],
      consistencia_visual: parsed.consistencia_visual || 5,
      estilo_fotografico: parsed.estilo_fotografico || "Nao identificado",
      uso_tipografia: parsed.uso_tipografia || "Nao identificado",
      mood: parsed.mood || "Nao identificado",
      tipos_conteudo: parsed.tipos_conteudo || [],
      raw_description: raw,
    };
  } catch (error: any) {
    console.error("[AutoDNA Vision] Erro na analise visual (fallback para texto):", error.message);
    return null;
  }
}

// ── Website Analysis (Optional Enrichment) ──────────────────────────────────

/**
 * Fetches the empresa's website HTML and extracts meta tags, OG data,
 * and a text summary for enriching the DNA analysis.
 */
async function analyzeWebsite(
  websiteUrl: string
): Promise<WebsiteAnalysisResult | null> {
  try {
    // Normalize URL
    let url = websiteUrl.trim();
    if (!url.startsWith("http")) {
      url = `https://${url}`;
    }

    console.log(`[AutoDNA Website] Buscando dados do site: ${url}`);

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ContIA/1.0)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.warn(`[AutoDNA Website] Site retornou status ${res.status}`);
      return null;
    }

    const html = await res.text();

    // Extract title
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || "";

    // Extract meta description
    const description =
      html.match(
        /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i
      )?.[1] ||
      html.match(
        /<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i
      )?.[1] ||
      "";

    // Extract OG tags
    const ogTags: Record<string, string> = {};
    const ogMatches = html.matchAll(
      /<meta[^>]*property=["'](og:[^"']*)["'][^>]*content=["']([^"']*)["'][^>]*>/gi
    );
    for (const match of ogMatches) {
      ogTags[match[1]] = match[2];
    }

    // Extract visible text (stripped of scripts/styles)
    const rawText = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3000);

    if (!title && !description && rawText.length < 50) {
      console.warn("[AutoDNA Website] Conteudo insuficiente do site");
      return null;
    }

    console.log(`[AutoDNA Website] Dados extraidos — titulo: "${title.slice(0, 60)}"`);

    return { title, description, og_tags: ogTags, raw_text: rawText };
  } catch (error: any) {
    console.error("[AutoDNA Website] Erro ao buscar site (pulando):", error.message);
    return null;
  }
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
  const { empresaNome, empresaNicho, igData, visualAnalysis, websiteAnalysis } = input;
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
  const postingTimes = analyzePostingTimes(media);

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

  // Top posts detail with media_url for reference
  const topMediaByEngagement = [...media]
    .sort((a, b) => {
      const engA = (a.like_count || 0) + (a.comments_count || 0);
      const engB = (b.like_count || 0) + (b.comments_count || 0);
      return engB - engA;
    })
    .slice(0, 5);

  const topPostsDetail = topPosts
    .map((p, i) => {
      const matchingMedia = topMediaByEngagement[i];
      const url = matchingMedia?.permalink || "";
      return `TOP ${i + 1} (${p.engagement_rate}% eng | ${p.type})${url ? ` [${url}]` : ""}:\n"${p.caption.slice(0, 300)}"`;
    })
    .join("\n\n");

  // Worst posts detail
  const worstPostsDetail = worstPosts
    .map(
      (p, i) =>
        `LOW ${i + 1} (${p.engagement_rate}% eng | ${p.type}):\n"${p.caption.slice(0, 200)}"`
    )
    .join("\n\n");

  // Build visual analysis section
  let visualSection = "";
  if (visualAnalysis) {
    visualSection = `
--- ANALISE VISUAL DO FEED (baseada nas imagens reais via GPT-4o Vision) ---
Cores dominantes encontradas: ${visualAnalysis.cores_dominantes.join(", ")}
Consistencia visual: ${visualAnalysis.consistencia_visual}/10
Estilo fotografico: ${visualAnalysis.estilo_fotografico}
Uso de tipografia: ${visualAnalysis.uso_tipografia}
Mood/atmosfera: ${visualAnalysis.mood}
Tipos de conteudo visual: ${visualAnalysis.tipos_conteudo.join(", ")}
IMPORTANTE: A paleta de cores do DNA DEVE refletir estas cores reais encontradas nas imagens.
`;
  }

  // Build website analysis section
  let websiteSection = "";
  if (websiteAnalysis) {
    websiteSection = `
--- ANALISE DO SITE ---
Titulo: ${websiteAnalysis.title}
Descricao: ${websiteAnalysis.description}
OG Tags: ${JSON.stringify(websiteAnalysis.og_tags)}
Conteudo resumido: ${websiteAnalysis.raw_text.slice(0, 1500)}
`;
  }

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
Padroes de horario/dia:
${postingTimes}

--- INSIGHTS DA CONTA (ultimos dados) ---
${insightsSummary || "Insights nao disponiveis"}
${visualSection}${websiteSection}
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

  // Build dynamic instructions about visual analysis
  const hasVisualAnalysis = !!input.visualAnalysis;
  const visualInstruction = hasVisualAnalysis
    ? `IMPORTANTE SOBRE CORES: A secao "ANALISE VISUAL DO FEED" contem cores REAIS extraidas das imagens do feed via GPT-4o Vision. A paleta_cores do DNA DEVE refletir essas cores reais encontradas nas imagens. NAO invente cores — use as cores reais como base e ajuste apenas levemente se necessario para harmonia.`
    : `NOTA: A analise visual das imagens nao esta disponivel. Infira a paleta de cores a partir da bio, tipo de conteudo e posicionamento do nicho, mas sinalize que sao cores sugeridas (nao confirmadas visualmente).`;

  const visualStyleInstruction = hasVisualAnalysis
    ? `O campo "estilo_visual" deve referenciar os padroes visuais REAIS identificados na analise de imagens: estilo fotografico, uso de tipografia, mood/atmosfera, e tipos de conteudo visual encontrados.`
    : `O campo "estilo_visual" deve ser baseado no posicionamento do nicho e tom identificado nas legendas.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `Voce e o maior especialista em branding digital e estrategia de conteudo do Brasil. Tem 20+ anos de experiencia com marcas de todos os portes e nichos.

Voce recebeu acesso REAL a dados do Instagram de uma marca via API — isso inclui todas as legendas reais, metricas de engajamento reais, dados de perfil reais e insights da conta. Estes NAO sao dados inventados — sao dados reais que o usuario autorizou.

${hasVisualAnalysis ? "Voce tambem recebeu uma ANALISE VISUAL REAL das imagens do feed, feita por GPT-4o Vision. As cores e estilos visuais reportados sao baseados nas imagens reais do feed." : ""}

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
   - Quais HORARIOS e DIAS geram mais engajamento? (use os padroes de horario fornecidos)

5. HASHTAGS — Extraia das legendas reais:
   - Quais hashtags usa atualmente?
   - Quais parecem funcionar (posts com mais engajamento)?
   - Sugira novas hashtags estrategicas

6. FREQUENCIA — Baseado nos timestamps reais:
   - Qual a frequencia atual?
   - Esta adequada?
   - Qual seria a ideal para o nicho?
   - Inclua recomendacao de melhores horarios/dias baseado nos dados

7. CORES E VISUAL:
   ${visualInstruction}
   ${visualStyleInstruction}

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
- A paleta de cores DEVE refletir as cores reais encontradas nas imagens do feed. NAO invente cores.
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
  "estilo_visual": "estilo visual identificado e recomendado${hasVisualAnalysis ? " baseado na analise real das imagens" : ""} (3-4 frases sobre tipografia, layout, fotografia, mood)",
  "pilares_conteudo": ["pilar1 — descricao com base nos dados", "pilar2 — descricao", "pilar3 — descricao", "pilar4 — descricao"],
  "temas_recomendados": ["tema1", "tema2", "tema3", "tema4", "tema5", "tema6", "tema7", "tema8", "tema9", "tema10"],
  "formatos_recomendados": ["formato1 — justificativa com base no engajamento real", "formato2 — justificativa", "formato3 — justificativa"],
  "hashtags_recomendadas": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5", "#tag6", "#tag7", "#tag8", "#tag9", "#tag10"],
  "frequencia_ideal": "recomendacao de frequencia por formato baseada na analise dos timestamps reais, engajamento e melhores horarios/dias",
  "diferenciais_vs_concorrentes": ["diferencial1 com justificativa baseada nos dados", "diferencial2", "diferencial3"],
  "oportunidades": ["oportunidade1 — acao sugerida baseada em gap identificado", "oportunidade2", "oportunidade3", "oportunidade4"],
  "palavras_usar": ["palavra1", "palavra2", "palavra3", "palavra4", "palavra5", "palavra6", "palavra7"],
  "palavras_evitar": ["palavra1", "palavra2", "palavra3", "palavra4", "palavra5"],
  "exemplos_legenda": ["legenda exemplo 1 completa no estilo identificado com CTA e hashtags", "legenda 2 estilo diferente", "legenda 3 formato educacional"]
}`,
      },
    ],
    temperature: 0.5,
    max_tokens: 6000,
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
      .select("nome, nicho, descricao, website")
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

    // 4. Run visual analysis and website analysis in parallel
    console.log("[AutoDNA] Executando analise visual e de site em paralelo...");

    const websiteUrl = empresa.website || igData.profile.website || null;

    const [visualAnalysis, websiteAnalysis] = await Promise.all([
      analyzeVisualIdentity(igData.media, openai),
      websiteUrl ? analyzeWebsite(websiteUrl) : Promise.resolve(null),
    ]);

    if (visualAnalysis) {
      console.log(
        `[AutoDNA] Analise visual concluida — ${visualAnalysis.cores_dominantes.length} cores, consistencia ${visualAnalysis.consistencia_visual}/10`
      );
    } else {
      console.log("[AutoDNA] Analise visual nao disponivel — usando apenas texto");
    }

    if (websiteAnalysis) {
      console.log(`[AutoDNA] Analise do site concluida — "${websiteAnalysis.title}"`);
    }

    // 5. Generate DNA with AI (enriched with visual + website data)
    console.log("[AutoDNA] Gerando DNA com IA (GPT-4o)...");
    const dna = await generateAutoDNA(
      {
        empresaId,
        empresaNome: empresa.nome || "Empresa",
        empresaNicho: empresa.nicho || "Geral",
        igData,
        visualAnalysis,
        websiteAnalysis,
      },
      openai
    );

    // 6. Build the instagram analysis summary for storage
    const analiseInstagram = buildInstagramAnalysisSummary(igData);

    // Add visual_analysis to the stored data for debugging/audit
    if (visualAnalysis) {
      analiseInstagram.visual_analysis = {
        cores_dominantes: visualAnalysis.cores_dominantes,
        consistencia_visual: visualAnalysis.consistencia_visual,
        estilo_fotografico: visualAnalysis.estilo_fotografico,
        uso_tipografia: visualAnalysis.uso_tipografia,
        mood: visualAnalysis.mood,
        tipos_conteudo: visualAnalysis.tipos_conteudo,
      };
    }

    // Build site analysis summary for storage
    const analiseSite = websiteAnalysis
      ? {
          source: "website_fetch",
          fetched_at: new Date().toISOString(),
          title: websiteAnalysis.title,
          description: websiteAnalysis.description,
          og_tags: websiteAnalysis.og_tags,
        }
      : null;

    // 7. Save to database
    const marcaDNA: MarcaDNAResult = {
      empresa_id: empresaId,
      status: "completo",
      analise_instagram: analiseInstagram,
      analise_site: analiseSite,
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
          analise_site: analiseSite,
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
