import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getAnthropicClient, resolveModel } from "@/lib/ai/anthropic";
import type { CreativeIdea, CreativeIdeasResponse } from "@/types/creative-ideas";

export const runtime = "nodejs";
export const maxDuration = 60;

// ── UUID validation ──────────────────────────────────────────────────────────

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(val: string): boolean {
  return UUID_RE.test(val);
}

// ── Types ────────────────────────────────────────────────────────────────────

interface RequestBody {
  empresaId: string;
  daysWindow?: number;
}

interface ContentItemRow {
  caption: string | null;
  content_type: string | null;
  published_at: string | null;
  metrics: Record<string, unknown> | null;
  thumbnail_url: string | null;
}

interface EmpresaRow {
  nome: string | null;
  nicho: string | null;
  cor_primaria: string | null;
  cor_secundaria: string | null;
  descricao: string | null;
}

interface MarcaDnaRow {
  dna_sintetizado: Record<string, unknown> | null;
}

interface EnrichedPost {
  caption: string;
  content_type: string;
  engagement_total: number;
  published_at: string;
}

interface FormatStats {
  count: number;
  totalEngagement: number;
  avgEngagement: number;
}

// ── Engagement helper ────────────────────────────────────────────────────────

function calcEngagement(metrics: Record<string, unknown> | null): number {
  if (!metrics) return 0;
  const n = (key: string): number => {
    const v = metrics[key];
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const parsed = parseInt(v, 10);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };
  return n("likes") + n("comments") + n("saves") + n("shares");
}

// ── DNA loader ───────────────────────────────────────────────────────────────

async function loadEmpresaData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string
): Promise<{ empresa: EmpresaRow | null; dna: Record<string, unknown> | null }> {
  const [empresaResult, dnaResult] = await Promise.all([
    supabase
      .from("empresas")
      .select("nome, nicho, cor_primaria, cor_secundaria, descricao")
      .eq("id", empresaId)
      .single(),
    supabase
      .from("marca_dna")
      .select("dna_sintetizado")
      .eq("empresa_id", empresaId)
      .single(),
  ]);

  return {
    empresa: (empresaResult.data as EmpresaRow | null) ?? null,
    dna: ((dnaResult.data as MarcaDnaRow | null)?.dna_sintetizado) ?? null,
  };
}

// ── Posts loader ─────────────────────────────────────────────────────────────

async function loadTopPosts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string,
  daysWindow: number
): Promise<EnrichedPost[]> {
  const { data, error } = await supabase
    .from("content_items")
    .select("caption, content_type, published_at, metrics, thumbnail_url")
    .eq("empresa_id", empresaId)
    .gte(
      "published_at",
      new Date(Date.now() - daysWindow * 24 * 60 * 60 * 1000).toISOString()
    )
    .not("metrics", "is", null)
    .limit(100); // fetch more, sort in-memory (Supabase JSONB sort is complex)

  if (error || !data) return [];

  const rows = data as ContentItemRow[];

  // Compute engagement and sort descending, take top 10
  const enriched: EnrichedPost[] = rows
    .map((row) => ({
      caption: (row.caption ?? "").slice(0, 200),
      content_type: row.content_type ?? "post",
      engagement_total: calcEngagement(row.metrics),
      published_at: row.published_at ?? "",
    }))
    .sort((a, b) => b.engagement_total - a.engagement_total)
    .slice(0, 10);

  return enriched;
}

// ── Format performance aggregator ────────────────────────────────────────────

function aggregateByFormat(posts: EnrichedPost[]): Record<string, FormatStats> {
  const stats: Record<string, FormatStats> = {};

  for (const post of posts) {
    const fmt = post.content_type;
    if (!stats[fmt]) {
      stats[fmt] = { count: 0, totalEngagement: 0, avgEngagement: 0 };
    }
    stats[fmt].count += 1;
    stats[fmt].totalEngagement += post.engagement_total;
  }

  for (const fmt of Object.keys(stats)) {
    const s = stats[fmt];
    s.avgEngagement = s.count > 0 ? Math.round(s.totalEngagement / s.count) : 0;
  }

  return stats;
}

// ── Build Claude prompt ───────────────────────────────────────────────────────

function buildIdeasPrompt(
  empresa: EmpresaRow | null,
  dna: Record<string, unknown> | null,
  posts: EnrichedPost[],
  formatStats: Record<string, FormatStats>,
  daysWindow: number
): string {
  // DNA fields — support multiple naming variants
  const tom =
    (dna?.["tom_de_voz"] as string | undefined) ??
    (dna?.["tom_voz"] as string | undefined) ??
    (dna?.["tom"] as string | undefined) ??
    null;

  const publicoAlvo =
    (dna?.["publico_alvo"] as string | undefined) ??
    (dna?.["publicoAlvo"] as string | undefined) ??
    null;

  const pilares = (dna?.["pilares_conteudo"] as string[] | undefined) ?? [];

  const cores: string[] = [];
  if (empresa?.cor_primaria) cores.push(empresa.cor_primaria);
  if (empresa?.cor_secundaria) cores.push(empresa.cor_secundaria);
  const rawColors =
    dna?.["paleta_cores"] ?? dna?.["cores"] ?? dna?.["brand_colors"];
  if (Array.isArray(rawColors)) {
    for (const c of rawColors as string[]) {
      if (c && !cores.includes(c)) cores.push(c);
    }
  }

  const nicho =
    (dna?.["nicho"] as string | undefined) ?? empresa?.nicho ?? null;

  const nome = empresa?.nome ?? "Empresa";

  // DNA block
  const dnaLines: string[] = [
    `Marca: ${nome}`,
    nicho ? `Nicho: ${nicho}` : null,
    tom ? `Tom de voz: ${tom}` : null,
    publicoAlvo ? `Público-alvo: ${publicoAlvo}` : null,
    cores.length > 0 ? `Cores da marca: ${cores.join(", ")}` : null,
    pilares.length > 0 ? `Pilares de conteúdo: ${pilares.join(", ")}` : null,
  ].filter(Boolean) as string[];

  // Performance block
  const formatLines = Object.entries(formatStats)
    .sort((a, b) => b[1].avgEngagement - a[1].avgEngagement)
    .map(
      ([fmt, s]) =>
        `  - ${fmt}: ${s.count} post(s), média de ${s.avgEngagement} engajamentos`
    )
    .join("\n");

  const hasHistory = posts.length > 0;

  const postLines = hasHistory
    ? posts
        .map(
          (p, i) =>
            `  ${i + 1}. [${p.content_type}] "${p.caption.replace(/\n/g, " ")}" — engajamento: ${p.engagement_total} (${p.published_at.slice(0, 10)})`
        )
        .join("\n")
    : "  (nenhum histórico disponível — empresa ainda não conectou Instagram)";

  return `Você é um estrategista de conteúdo para Instagram. Gera ideias afiadas e personalizadas, focadas em ÂNGULO e COPY — não em arte.

## DNA DA MARCA

${dnaLines.join("\n")}

## HISTÓRICO DE PERFORMANCE (últimos ${daysWindow} dias)

Top posts por engajamento:
${postLines}

${
  hasHistory
    ? `Performance por formato:
${formatLines || "  (sem dados de formato)"}`
    : ""
}

## TAREFA

Gere exatamente 5 ideias de posts. Apenas dois formatos são permitidos: **estático** ou **carrossel**. NÃO sugira reels nem vídeos.

## REGRAS PARA O CAMPO "prompt_completo"

Esse campo será **colado num input de chat onde o usuário vai poder editar antes de mandar pra outra IA criar a arte**. Por isso:

- Seja **enxuto** (idealmente 1 a 3 linhas, no máx 4).
- Foque na **ideia, no ângulo e no copy/headline** — NÃO descreva paleta, fonte, layout, posição de elementos, estilo visual, CTA específico, ou qualquer instrução prescritiva de design.
- Pode mencionar o formato (estático vs carrossel) e, no caso de carrossel, sugerir quantos slides e o que cada slide aborda em UMA frase curta.
- Comece direto na ideia. Sem preâmbulo. Sem "Crie um post...". Sem despedida.
- Tom da marca já está implícito — não precisa redizer.

Pense neste campo como um **briefing curto pro próprio criador editar e expandir**, não como um prompt fechado pra geração automática.

## EXEMPLOS DE BOM E RUIM

❌ Ruim (prescritivo, longo, focado em arte):
"Crie um post estático com fundo navy escuro #0a1845, fonte Poppins Bold em branco, headline 'A clareza vale mais que o ouro' centralizada, subtexto em cinza claro abaixo, logo no canto inferior direito, paleta complementar dourada para acentos..."

✅ Bom (curto, focado em ideia/copy):
"Estático com a frase 'A clareza vale mais que o ouro' como gancho central. Tema: por que entender pra onde vai seu dinheiro vale mais do que o retorno em si."

✅ Bom (carrossel):
"Carrossel de 5 slides desconstruindo o mito do 'investimento certo'. Slide 1: gancho provocador. Slides 2-4: três crenças comuns + por que estão erradas. Slide 5: convite à reflexão."

## FORMATO DE RESPOSTA

Responda SOMENTE com JSON válido, sem markdown, sem texto antes ou depois. Use exatamente esta estrutura:

{
  "ideias": [
    {
      "titulo": "título curto e descritivo da ideia (max 60 chars)",
      "formato": "estatico" | "carrossel",
      "gancho": "frase de 1 linha que resume o ângulo principal",
      "prompt_completo": "briefing curto da ideia/copy — 1 a 4 linhas, foco em ângulo e mensagem, NÃO em arte",
      "inspiracao": "qual post histórico inspirou esta ideia (cite caption ou data) ou 'baseado no DNA' se sem histórico"
    }
  ]
}`;
}

// ── JSON extraction with retry ────────────────────────────────────────────────

function extractJson(text: string): { ideias: CreativeIdea[] } | null {
  // Try to find a JSON object in the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "ideias" in parsed &&
      Array.isArray((parsed as { ideias: unknown }).ideias)
    ) {
      return parsed as { ideias: CreativeIdea[] };
    }
    return null;
  } catch {
    return null;
  }
}

// ── Main route handler ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── 1. Parse body ──
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      { error: "Body inválido." },
      { status: 400 }
    );
  }

  const { empresaId, daysWindow: rawDays } = body;

  if (!empresaId || typeof empresaId !== "string") {
    return NextResponse.json(
      { error: "Campo 'empresaId' é obrigatório." },
      { status: 400 }
    );
  }

  if (!isValidUuid(empresaId)) {
    return NextResponse.json(
      { error: "Campo 'empresaId' deve ser um UUID válido." },
      { status: 400 }
    );
  }

  const daysWindow =
    typeof rawDays === "number" && rawDays > 0 && rawDays <= 365
      ? rawDays
      : 90;

  // ── 2. Auth + RBAC ──
  const supabase = await createClient();
  const authz = await requireRole(supabase, empresaId, "post.create");
  if (!authz.ok) return authz.response;

  // ── 3. Rate limit ──
  const ip = getClientIp(req);
  const allowed = checkRateLimit(ip, "generate");
  if (!allowed) {
    return NextResponse.json(
      { error: "Limite de requisições atingido. Tente novamente em alguns segundos." },
      { status: 429 }
    );
  }

  // ── 4. Resolve model from query param ──
  const modelParam = req.nextUrl.searchParams.get("model");
  const resolvedModel = resolveModel(modelParam);

  // ── 5. Load empresa DNA + posts in parallel ──
  let empresa: EmpresaRow | null = null;
  let dna: Record<string, unknown> | null = null;
  let posts: EnrichedPost[] = [];

  try {
    const [empresaData, postsData] = await Promise.all([
      loadEmpresaData(supabase, empresaId),
      loadTopPosts(supabase, empresaId, daysWindow),
    ]);

    empresa = empresaData.empresa;
    dna = empresaData.dna;
    posts = postsData;
  } catch (err) {
    console.error("[creatives/ideas] Data load error:", (err as Error).message);
    return NextResponse.json(
      { error: "Falha ao carregar dados da empresa. Tente novamente." },
      { status: 500 }
    );
  }

  if (!empresa) {
    return NextResponse.json(
      { error: "Empresa não encontrada." },
      { status: 404 }
    );
  }

  // ── 6. Aggregate format performance ──
  const formatStats = aggregateByFormat(posts);
  const formatosAnalisados = Object.keys(formatStats);

  // ── 7. Build prompt and call Claude ──
  const prompt = buildIdeasPrompt(empresa, dna, posts, formatStats, daysWindow);
  const anthropic = getAnthropicClient();

  let rawText = "";
  let parsed: { ideias: CreativeIdea[] } | null = null;

  // Attempt 1
  try {
    const response = await anthropic.messages.create({
      model: resolvedModel,
      max_tokens: 4096,
      system:
        "Você é um estrategista de conteúdo para Instagram. Responda APENAS com JSON válido, sem markdown, sem texto antes ou depois do JSON.",
      messages: [{ role: "user", content: prompt }],
    });

    rawText =
      response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("") ?? "";

    parsed = extractJson(rawText);
  } catch (err) {
    console.error("[creatives/ideas] Claude attempt 1 error:", (err as Error).message);
  }

  // Retry once if parsing failed
  if (!parsed) {
    try {
      const retryResponse = await anthropic.messages.create({
        model: resolvedModel,
        max_tokens: 4096,
        system:
          "Você é um estrategista de conteúdo para Instagram. Você DEVE responder SOMENTE com JSON válido. Sem texto explicativo, sem marcação markdown, sem código. Apenas o objeto JSON puro.",
        messages: [
          { role: "user", content: prompt },
          {
            role: "assistant",
            content: rawText || '{"ideias":',
          },
          {
            role: "user",
            content:
              'Sua resposta anterior não era JSON válido. Responda agora SOMENTE com o objeto JSON completo, começando com { e terminando com }.',
          },
        ],
      });

      const retryText =
        retryResponse.content
          .filter((b) => b.type === "text")
          .map((b) => (b as { type: "text"; text: string }).text)
          .join("") ?? "";

      parsed = extractJson(retryText);
    } catch (retryErr) {
      console.error(
        "[creatives/ideas] Claude retry error:",
        (retryErr as Error).message
      );
    }
  }

  if (!parsed || !parsed.ideias || parsed.ideias.length === 0) {
    return NextResponse.json(
      { error: "Não foi possível gerar ideias no momento. Tente novamente." },
      { status: 500 }
    );
  }

  // ── 7.5 Sanitize: força apenas estatico/carrossel (Claude pode desobedecer) ──
  const sanitized: CreativeIdea[] = parsed.ideias.map((idea) => {
    const fmt = idea.formato as string;
    const allowed = fmt === "carrossel" ? "carrossel" : "estatico";
    return { ...idea, formato: allowed as CreativeIdea["formato"] };
  });

  // ── 8. Build response ──
  const responseBody: CreativeIdeasResponse = {
    ideias: sanitized,
    baseadoEm: {
      totalPosts: posts.length,
      formatosAnalisados:
        formatosAnalisados.length > 0 ? formatosAnalisados : ["baseado no DNA"],
      janelaDias: daysWindow,
      modeloUsado: resolvedModel,
    },
  };

  return NextResponse.json(responseBody);
}
