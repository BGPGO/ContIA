import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getOpenAIClient, isAIConfigured } from "@/lib/ai/config";
import { isSupabaseConfigured } from "@/lib/supabase/config";

// ── Types ────────────────────────────────────────────────────────────────────

interface DNASintetizado {
  tom_de_voz?: string;
  personalidade_marca?: string;
  proposta_valor?: string;
  publico_alvo?: string;
  paleta_cores?: string[];
  estilo_visual?: string;
  pilares_conteudo?: string[];
  temas_recomendados?: string[];
  formatos_recomendados?: string[];
  hashtags_recomendadas?: string[];
  frequencia_ideal?: string;
  diferenciais_vs_concorrentes?: string[];
  oportunidades?: string[];
  palavras_usar?: string[];
  palavras_evitar?: string[];
  exemplos_legenda?: string[];
}

interface MarcaDNA {
  id?: string;
  empresa_id: string;
  status: "processando" | "completo" | "erro";
  analise_instagram?: any | null;
  analise_site?: any | null;
  analises_concorrentes?: Record<string, any> | null;
  analises_referencias?: Record<string, any> | null;
  dna_sintetizado?: DNASintetizado | null;
  erro?: string | null;
  created_at?: string;
  updated_at?: string;
}

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

// ── Instagram analysis (internal helper) ─────────────────────────────────────

async function fetchInstagramData(username: string): Promise<any | null> {
  const cleanUsername = username.replace("@", "").trim();

  // Strategy 1: Public API endpoint
  try {
    const res = await fetch(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${cleanUsername}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "X-IG-App-ID": "936619743392459",
          Accept: "*/*",
        },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (res.ok) {
      const json = await res.json();
      const user = json?.data?.user;
      if (user) {
        const posts = (user.edge_owner_to_timeline_media?.edges || [])
          .slice(0, 12)
          .map((edge: any) => {
            const node = edge.node;
            return {
              caption:
                node.edge_media_to_caption?.edges?.[0]?.node?.text || "",
              likes:
                node.edge_liked_by?.count ||
                node.edge_media_preview_like?.count ||
                0,
              comments: node.edge_media_to_comment?.count || 0,
              isVideo: node.is_video || false,
            };
          });

        return {
          username: user.username,
          fullName: user.full_name || "",
          bio: user.biography || "",
          followers: user.edge_followed_by?.count || 0,
          following: user.edge_follow?.count || 0,
          postCount: user.edge_owner_to_timeline_media?.count || 0,
          posts,
        };
      }
    }
  } catch {
    // Fall through to strategy 2
  }

  // Strategy 2: HTML scrape for meta tags
  try {
    const res = await fetch(`https://www.instagram.com/${cleanUsername}/`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const html = await res.text();
      const description =
        html.match(
          /<meta[^>]*(?:name="description"|property="og:description")[^>]*content="([^"]*)"[^>]*>/i
        )?.[1] || "";
      const title =
        html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || "";

      if (description || title) {
        return {
          username: cleanUsername,
          fullName: title.replace(/ \(.*/, "").replace(/@.*/, "").trim(),
          bio: description,
          followers: 0,
          following: 0,
          postCount: 0,
          posts: [],
        };
      }
    }
  } catch {
    // Fall through
  }

  return null;
}

async function analyzeInstagram(
  username: string,
  openai: OpenAI
): Promise<any | null> {
  console.log(`[MarcaDNA] Analisando Instagram: @${username}`);

  const igData = await fetchInstagramData(username);

  const profileContext = igData
    ? `
Perfil: @${igData.username} (${igData.fullName})
Bio: ${igData.bio}
Seguidores: ${igData.followers.toLocaleString()}
Posts: ${igData.postCount}

Últimas legendas:
${igData.posts
  .slice(0, 10)
  .map(
    (p: any, i: number) =>
      `${i + 1}. ${p.caption.slice(0, 300)}${p.caption.length > 300 ? "..." : ""} [likes: ${p.likes} comments: ${p.comments}${p.isVideo ? " video" : ""}]`
  )
  .join("\n")}
`
    : `Perfil: @${username} (dados detalhados não disponíveis — analise com base no que você conhece sobre o nicho)`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "Você é um analista expert de Instagram e marketing digital. Analise o perfil e extraia insights estratégicos. Responda EXCLUSIVAMENTE em JSON válido, sem markdown, sem code blocks.",
      },
      {
        role: "user",
        content: `Analise este perfil de Instagram:

${profileContext}

Responda neste JSON EXATO:
{"resumo_visual":"descrição do estilo visual","tom_legendas":"tom das legendas","temas_recorrentes":["tema1","tema2","tema3"],"estilo_visual":"padrão visual dominante","formatos_mais_usados":["formato1","formato2"],"hashtags_frequentes":["#tag1","#tag2"],"frequencia_postagem":"estimativa","engajamento_medio":"estimativa percentual","pontos_fortes":["ponto1","ponto2"],"pontos_fracos":["ponto1","ponto2"]}`,
      },
    ],
    temperature: 0.4,
    max_tokens: 1500,
  });

  const raw = completion.choices[0]?.message?.content || "{}";
  return parseGPTJson(raw, { username, error: "Failed to parse IG analysis" });
}

// ── Site analysis (internal helper) ──────────────────────────────────────────

async function analyzeSite(
  url: string,
  openai: OpenAI
): Promise<any | null> {
  console.log(`[MarcaDNA] Analisando site: ${url}`);

  let textContent = "";
  try {
    const siteResponse = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ContIA/1.0)" },
      signal: AbortSignal.timeout(10000),
    });

    if (!siteResponse.ok) {
      console.warn(`[MarcaDNA] Site retornou status ${siteResponse.status}: ${url}`);
      return null;
    }

    const html = await siteResponse.text();
    textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 5000);
  } catch (err) {
    console.warn(`[MarcaDNA] Erro ao buscar site ${url}:`, err);
    return null;
  }

  if (!textContent || textContent.length < 50) {
    console.warn(`[MarcaDNA] Conteúdo insuficiente do site: ${url}`);
    return null;
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "Você é um analista de marketing digital. Analise o conteúdo do site e extraia insights estratégicos. Responda EXCLUSIVAMENTE em JSON válido, sem markdown, sem code blocks.",
      },
      {
        role: "user",
        content: `Analise este site (${url}):

Conteúdo:
${textContent}

Responda neste JSON EXATO:
{"resumo":"resumo do que a empresa faz em 2-3 frases","tom_de_voz":"como a empresa se comunica","publico_alvo":"quem é o público-alvo","palavras_chave":["palavra1","palavra2","palavra3"],"proposta_valor":"principal proposta de valor","cores_predominantes":["#hex1","#hex2"],"diferenciais":["diferencial1","diferencial2"],"mensagens_chave":["mensagem1","mensagem2"]}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 1000,
  });

  const raw = completion.choices[0]?.message?.content || "{}";
  return parseGPTJson(raw, { url, error: "Failed to parse site analysis" });
}

// ── JSON parsing utility ─────────────────────────────────────────────────────

function parseGPTJson(raw: string, fallback: any): any {
  let jsonStr = raw.trim();

  // Remove markdown code blocks
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "")
      .trim();
  }

  // Extract JSON object
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }

  try {
    return JSON.parse(jsonStr);
  } catch {
    console.error("[MarcaDNA] Falha ao parsear JSON GPT:", raw.slice(0, 200));
    return fallback;
  }
}

// ── Synthesis — the brain ────────────────────────────────────────────────────

async function synthesizeDNA(
  empresaNome: string,
  empresaNicho: string,
  analiseInstagram: any | null,
  analiseSite: any | null,
  analisesConcorrentes: Record<string, any>,
  analisesReferencias: Record<string, any>,
  openai: OpenAI
): Promise<DNASintetizado> {
  console.log("[MarcaDNA] Sintetizando DNA da marca...");

  // Build context sections
  const sections: string[] = [];

  sections.push(`EMPRESA: ${empresaNome}\nNICHO: ${empresaNicho}`);

  if (analiseInstagram) {
    sections.push(
      `\n--- ANÁLISE DO INSTAGRAM DA EMPRESA ---\n${JSON.stringify(analiseInstagram, null, 2)}`
    );
  } else {
    sections.push(
      "\n--- INSTAGRAM DA EMPRESA ---\nNão disponível ou análise falhou."
    );
  }

  if (analiseSite) {
    sections.push(
      `\n--- ANÁLISE DO SITE DA EMPRESA ---\n${JSON.stringify(analiseSite, null, 2)}`
    );
  } else {
    sections.push(
      "\n--- SITE DA EMPRESA ---\nNão disponível ou análise falhou."
    );
  }

  const concorrenteEntries = Object.entries(analisesConcorrentes);
  if (concorrenteEntries.length > 0) {
    sections.push("\n--- ANÁLISE DOS CONCORRENTES ---");
    for (const [nome, analise] of concorrenteEntries) {
      if (analise) {
        sections.push(
          `\nConcorrente: ${nome}\n${JSON.stringify(analise, null, 2)}`
        );
      } else {
        sections.push(`\nConcorrente: ${nome}\nAnálise falhou.`);
      }
    }
  }

  const refEntries = Object.entries(analisesReferencias);
  if (refEntries.length > 0) {
    sections.push("\n--- ANÁLISE DAS REFERÊNCIAS ---");
    for (const [nome, analise] of refEntries) {
      if (analise) {
        sections.push(
          `\nReferência: ${nome}\n${JSON.stringify(analise, null, 2)}`
        );
      } else {
        sections.push(`\nReferência: ${nome}\nAnálise falhou.`);
      }
    }
  }

  const fullContext = sections.join("\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are an elite marketing strategist with 20 years of experience in brand positioning, content strategy, and digital marketing. You work for top agencies and are known for turning data into actionable brand strategies.

Given analysis of a brand's Instagram presence, website, competitors, and references, synthesize a comprehensive Brand DNA document.

Consider:
- What makes this brand unique vs competitors?
- What content strategies work in their niche?
- What gaps exist that they can exploit?
- What tone resonates with their audience?
- What visual identity should they maintain or evolve?
- What specific content pillars will drive growth?

IMPORTANT: Be specific and actionable. Don't give generic advice. Reference actual data from the analyses. Every recommendation should be tied to an insight from the data.

Respond EXCLUSIVELY in valid JSON (no markdown, no code blocks). All text values must be in Brazilian Portuguese (PT-BR).`,
      },
      {
        role: "user",
        content: `Analise todos os dados abaixo e sintetize o DNA completo da marca "${empresaNome}" no nicho "${empresaNicho}".

${fullContext}

Responda neste JSON EXATO (todos os campos são obrigatórios):
{
  "tom_de_voz": "descrição detalhada do tom de voz ideal (3-5 frases com exemplos)",
  "personalidade_marca": "descrição da personalidade da marca como se fosse uma pessoa (3-5 frases)",
  "proposta_valor": "proposta de valor única e diferenciada (2-3 frases)",
  "publico_alvo": "descrição detalhada do público-alvo ideal com dados demográficos e psicográficos",
  "paleta_cores": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
  "estilo_visual": "descrição detalhada do estilo visual recomendado (tipografia, layout, fotografia)",
  "pilares_conteudo": ["pilar1", "pilar2", "pilar3", "pilar4"],
  "temas_recomendados": ["tema1", "tema2", "tema3", "tema4", "tema5", "tema6", "tema7", "tema8", "tema9", "tema10"],
  "formatos_recomendados": ["formato1 com descrição", "formato2 com descrição", "formato3 com descrição"],
  "hashtags_recomendadas": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5", "#tag6", "#tag7", "#tag8", "#tag9", "#tag10"],
  "frequencia_ideal": "recomendação detalhada de frequência por formato e plataforma",
  "diferenciais_vs_concorrentes": ["diferencial1 com justificativa", "diferencial2", "diferencial3"],
  "oportunidades": ["oportunidade1 com ação sugerida", "oportunidade2", "oportunidade3"],
  "palavras_usar": ["palavra1", "palavra2", "palavra3", "palavra4", "palavra5"],
  "palavras_evitar": ["palavra1", "palavra2", "palavra3", "palavra4", "palavra5"],
  "exemplos_legenda": ["legenda de exemplo 1 completa com CTA e hashtags", "legenda 2", "legenda 3"]
}`,
      },
    ],
    temperature: 0.5,
    max_tokens: 4000,
  });

  const raw = completion.choices[0]?.message?.content || "{}";
  return parseGPTJson(raw, {
    tom_de_voz: "Profissional e acessível",
    personalidade_marca: "Expert confiável no nicho",
    proposta_valor: `Referência em ${empresaNicho}`,
  }) as DNASintetizado;
}

// ── Mock data ────────────────────────────────────────────────────────────────

function getMockMarcaDNA(empresaId: string): MarcaDNA {
  return {
    empresa_id: empresaId,
    status: "completo",
    analise_instagram: {
      resumo_visual: "Feed organizado com paleta de cores consistente",
      tom_legendas: "Profissional com toques de informalidade",
      temas_recorrentes: ["dicas do nicho", "bastidores", "depoimentos"],
      estilo_visual: "Fotos profissionais com overlays de texto",
      formatos_mais_usados: ["carrossel", "reels", "imagem"],
      hashtags_frequentes: ["#marketing", "#negocios", "#empreendedorismo"],
      frequencia_postagem: "4-5x por semana",
      engajamento_medio: "3.2%",
      pontos_fortes: ["Consistência visual", "CTAs claros"],
      pontos_fracos: ["Pouca interação nos stories", "Falta de UGC"],
    },
    analise_site: {
      resumo: "Empresa focada em soluções inovadoras para o mercado digital",
      tom_de_voz: "Profissional, moderno e confiável",
      publico_alvo: "Empreendedores e PMEs",
      palavras_chave: ["inovação", "resultado", "crescimento", "estratégia"],
      proposta_valor: "Transformar negócios com tecnologia e estratégia",
      cores_predominantes: ["#6c5ce7", "#a29bfe", "#2d3436"],
      diferenciais: ["Atendimento personalizado", "Metodologia própria"],
      mensagens_chave: ["Resultados comprovados", "Parceiro de crescimento"],
    },
    analises_concorrentes: {
      concorrente_1: {
        resumo_visual: "Feed minimalista com foco em educação",
        tom_legendas: "Didático e direto",
        pontos_fortes: ["Conteúdo educacional forte"],
        pontos_fracos: ["Visual pouco diferenciado"],
      },
    },
    analises_referencias: {},
    dna_sintetizado: {
      tom_de_voz:
        "Profissional e acessível, com autoridade no assunto mas sem ser distante. Usa linguagem direta, evita jargões desnecessários, e inclui analogias do cotidiano para facilitar a compreensão. Exemplo: em vez de 'otimize seu funil de conversão', prefira 'transforme visitantes em clientes com passos simples'.",
      personalidade_marca:
        "Expert confiável que é como um mentor acessível. Compartilha conhecimento generosamente, celebra as conquistas dos clientes e mantém um otimismo realista. É a pessoa que você ligaria para pedir conselho de negócio — experiente, atualizada e genuinamente interessada no seu sucesso.",
      proposta_valor:
        "Combinamos estratégia comprovada com tecnologia de ponta para entregar resultados mensuráveis. Não vendemos promessas — entregamos crescimento documentado com acompanhamento personalizado.",
      publico_alvo:
        "Empreendedores e gestores de PMEs (25-45 anos), predominantemente urbanos, com formação superior, que buscam escalar seus negócios com estratégia digital. Valorizam resultados práticos sobre teoria, têm pouco tempo e precisam de soluções que funcionem rápido.",
      paleta_cores: ["#6c5ce7", "#a29bfe", "#00cec9", "#2d3436", "#ffffff"],
      estilo_visual:
        "Design moderno e limpo com uso estratégico de cores vibrantes sobre fundos escuros. Tipografia sans-serif bold para títulos, regular para corpo. Fotografia profissional com overlay semitransparente. Ícones lineares para consistência.",
      pilares_conteudo: [
        "Educação — dicas e tutoriais práticos do nicho",
        "Autoridade — cases, dados e insights exclusivos",
        "Conexão — bastidores, equipe e valores da marca",
        "Conversão — provas sociais, depoimentos e CTAs",
      ],
      temas_recomendados: [
        "Dicas rápidas do nicho (formato lista)",
        "Antes e depois de clientes",
        "Tendências do mercado para 2026",
        "Erros comuns que iniciantes cometem",
        "Passo a passo de processos",
        "Depoimentos em vídeo curto",
        "Bastidores do dia a dia",
        "Mitos vs verdades do nicho",
        "Ferramentas recomendadas",
        "Retrospectiva de resultados",
      ],
      formatos_recomendados: [
        "Carrossel educacional (5-7 slides) — gera saves e shares",
        "Reels curtos (15-30s) — máximo alcance e descoberta",
        "Post estático com frase de impacto — engajamento nos comentários",
      ],
      hashtags_recomendadas: [
        "#marketing",
        "#empreendedorismo",
        "#negociosdigitais",
        "#crescimento",
        "#estrategia",
        "#dicas",
        "#resultados",
        "#inovacao",
        "#PME",
        "#gestao",
      ],
      frequencia_ideal:
        "Instagram: 4-5 posts/semana (2 carrosseis, 2 reels, 1 estático). Stories: diário (3-5/dia). LinkedIn: 2-3 posts/semana. Manter consistência é mais importante que volume.",
      diferenciais_vs_concorrentes: [
        "Atendimento personalizado vs concorrentes com abordagem genérica",
        "Metodologia própria documentada vs concorrentes sem processo claro",
        "Combinação de estratégia + tecnologia vs concorrentes focados em só um pilar",
      ],
      oportunidades: [
        "Investir em Reels educacionais — concorrentes subutilizam o formato",
        "Criar série semanal com tema fixo para gerar expectativa",
        "Explorar LinkedIn com conteúdo B2B que nenhum concorrente está fazendo bem",
      ],
      palavras_usar: [
        "resultado",
        "crescimento",
        "estratégia",
        "prático",
        "comprovado",
      ],
      palavras_evitar: [
        "simples",
        "fácil",
        "rápido",
        "milagre",
        "garantido",
      ],
      exemplos_legenda: [
        "Você sabia que 80% dos empreendedores erram neste ponto? 👇\n\nQuando comecei, eu também caía nessa armadilha. Mas depois de trabalhar com +200 empresas, descobri que o segredo está em [insight específico].\n\nSalva este post e aplica hoje mesmo.\n\n#marketing #empreendedorismo #dicas",
        "Resultado real de um cliente nosso: em 90 dias, saiu de R$15k para R$48k/mês.\n\nO que mudou? 3 coisas:\n1. [Ação 1]\n2. [Ação 2]\n3. [Ação 3]\n\nQuer saber como? Link na bio.\n\n#resultados #crescimento #cases",
        "PARE de postar só por postar. 🚫\n\nCada conteúdo precisa ter um objetivo:\n→ Educar\n→ Engajar\n→ Converter\n\nSe não faz nenhum dos três, repense antes de publicar.\n\nConcorda? Comenta 🔥\n\n#estrategia #conteudo #marketingdigital",
      ],
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// ── Safely run an async task, returning null on failure ───────────────────────

async function safeAsync<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[MarcaDNA] Falha em ${label}:`, err);
    return null;
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { empresaId } = body;

    if (!empresaId) {
      return NextResponse.json(
        { error: "Campo 'empresaId' é obrigatório" },
        { status: 400 }
      );
    }

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
    const marcaDNA: MarcaDNA = {
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
