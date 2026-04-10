import { NextRequest } from "next/server";
import { getOpenAIClient, isAIConfigured } from "@/lib/ai/config";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { analyzePostPatterns } from "@/lib/ai/pattern-analyzer";
import { createClient } from "@/lib/supabase/server";
import { getMarcaDNA } from "@/lib/marca-dna";
import type { CopyChatRequest, CopyContent, CopyChatMessage } from "@/types/copy-studio";
import type { ContentTone } from "@/types/ai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

// ── Temperature by tone ─────────────────────────────────────────────────────

function getChatTemperature(tone: ContentTone): number {
  if (tone === "formal" || tone === "tecnico") return 0.4;
  if (tone === "divertido") return 0.8;
  return 0.65;
}

// ── Tone descriptions (PT-BR) ───────────────────────────────────────────────

const TONE_DESCRIPTIONS: Record<ContentTone, string> = {
  formal:
    "Profissional e respeitoso. Linguagem corporativa, dados e fatos concretos. Sem girias, sem emojis excessivos. Tom de autoridade e credibilidade.",
  casual:
    "Proximo e descontraido. Linguagem do dia a dia brasileiro, emojis moderados, perguntas diretas ao leitor. Como uma conversa com um amigo que manja do assunto.",
  tecnico:
    "Educacional e preciso. Termos tecnicos com explicacoes acessiveis. Dados, estatisticas, comparacoes. Tom de professor especialista.",
  divertido:
    "Leve e criativo. Humor inteligente, trocadilhos, referencias pop brasileiras. Emojis expressivos. Tom de marca que nao se leva a serio mas entrega valor.",
  inspirador:
    "Motivacional e empoderador. Storytelling pessoal, metaforas visuais, frases de impacto. Tom aspiracional de transformacao.",
};

// ── Platform constraints ────────────────────────────────────────────────────

const PLATFORM_CONSTRAINTS: Record<string, string> = {
  instagram: "Max 2200 chars, 5-10 hashtags, emojis sim, storytelling curto + CTA",
  facebook: "Max 63206 chars, 3-5 hashtags, conversacional, perguntas para gerar comentarios",
  linkedin: "Max 3000 chars, 3-5 hashtags profissionais, tom profissional, dados concretos",
  twitter: "Max 280 chars, 1-2 hashtags, direto ao ponto, impactante",
  tiktok: "Max 2200 chars, 3-5 hashtags, trend-driven, linguagem jovem",
  youtube: "Max 5000 chars, 3-5 hashtags SEO, descritivo, timestamps",
};

// ── Build conversational system prompt ──────────────────────────────────────

function buildSystemPrompt(params: {
  empresaNome: string;
  empresaNicho: string;
  empresaDescricao: string;
  empresaWebsite: string;
  format: string;
  tone: ContentTone;
  platforms: string[];
  dna: Record<string, unknown> | null;
  styleProfile: Record<string, unknown> | null;
  realCaptions: string[];
  postsContext?: string;
}): string {
  const { empresaNome, empresaNicho, empresaDescricao, empresaWebsite, format, tone, platforms, dna, styleProfile, realCaptions, postsContext } = params;

  let prompt = `Voce e o copywriter e ghostwriter oficial da marca ${empresaNome}, uma empresa do nicho de ${empresaNicho}.
${empresaDescricao ? `A empresa: ${empresaDescricao}` : ''}

REGRA ABSOLUTA: Todo conteudo deve ser 100% relevante para ${empresaNicho}. NUNCA gere conteudo de outros nichos.

## Contexto da Marca
- **Nome**: ${empresaNome}
- **Nicho**: ${empresaNicho}
- **Descricao**: ${empresaDescricao || 'Nao disponivel'}
- **Website**: ${empresaWebsite || 'Nao disponivel'}

IMPORTANTE: Todo conteudo DEVE ser relevante para o nicho "${empresaNicho}".
NUNCA sugira conteudo de outros nichos. Se a empresa e financeira, TODOS os posts devem ser sobre financas, investimentos, gestao financeira, etc.

## Seu papel
Voce cria e refina conteudo para redes sociais em colaboracao com o usuario.
Cada resposta sua tem DUAS partes obrigatorias:
1. Uma mensagem conversacional curta (2-3 frases) explicando o que fez/sugeriu
2. A copy completa atualizada em JSON

## Tom de voz da conversa
${TONE_DESCRIPTIONS[tone]}`;

  // DNA injection
  if (dna) {
    prompt += `\n\n## DNA da Marca (INVIOLAVEL)`;
    if (dna.tom_de_voz) prompt += `\n- Tom de voz: "${dna.tom_de_voz}"`;
    if (dna.personalidade_marca) prompt += `\n- Personalidade: "${dna.personalidade_marca}"`;
    if (dna.proposta_valor) prompt += `\n- Proposta de valor: "${dna.proposta_valor}"`;
    if (dna.publico_alvo) prompt += `\n- Publico-alvo: "${dna.publico_alvo}"`;
    if (Array.isArray(dna.pilares_conteudo) && dna.pilares_conteudo.length) {
      prompt += `\n- Pilares de conteudo: ${(dna.pilares_conteudo as string[]).join(" | ")}`;
    }
    if (Array.isArray(dna.palavras_usar) && dna.palavras_usar.length) {
      prompt += `\n- USAR estas palavras: ${(dna.palavras_usar as string[]).join(", ")}`;
    }
    if (Array.isArray(dna.palavras_evitar) && dna.palavras_evitar.length) {
      prompt += `\n- PROIBIDO usar: ${(dna.palavras_evitar as string[]).join(", ")}`;
    }
    if (Array.isArray(dna.exemplos_legenda) && dna.exemplos_legenda.length) {
      prompt += `\n- Exemplos de legenda da marca:`;
      (dna.exemplos_legenda as string[]).forEach((e, i) => {
        prompt += `\n  ${i + 1}. "${e}"`;
      });
    }
  }

  // Style profile injection
  if (styleProfile) {
    const sp = styleProfile;
    prompt += `\n\n## Perfil de Estilo (dos posts reais)`;
    if (sp.tone_description) prompt += `\n- Tom real: ${sp.tone_description}`;
    if (sp.caption_structure) prompt += `\n- Estrutura das legendas: ${sp.caption_structure}`;
    if (sp.emoji_usage) prompt += `\n- Uso de emojis: ${sp.emoji_usage}`;
    if (Array.isArray(sp.emoji_examples) && sp.emoji_examples.length) {
      prompt += ` (preferidos: ${(sp.emoji_examples as string[]).join(" ")})`;
    }
    if (Array.isArray(sp.cta_patterns) && sp.cta_patterns.length) {
      prompt += `\n- CTAs tipicos: ${(sp.cta_patterns as string[]).join(", ")}`;
    }
    if (Array.isArray(sp.opening_patterns) && sp.opening_patterns.length) {
      prompt += `\n- Aberturas tipicas: ${(sp.opening_patterns as string[]).join(", ")}`;
    }
    if (Array.isArray(sp.vocabulary_signature) && sp.vocabulary_signature.length) {
      prompt += `\n- Vocabulario caracteristico: ${(sp.vocabulary_signature as string[]).join(", ")}`;
    }
    if (Array.isArray(sp.top_hashtags) && sp.top_hashtags.length) {
      prompt += `\n- Hashtags reais: ${(sp.top_hashtags as string[]).slice(0, 12).join(" ")}`;
    }
  }

  // Real captions injection
  if (realCaptions.length > 0) {
    prompt += `\n\n## Legendas reais para referencia de estilo`;
    realCaptions.forEach((cap, i) => {
      prompt += `\n\n--- Legenda ${i + 1} ---\n${cap.slice(0, 600)}`;
    });
  }

  // Posts context with metrics
  if (postsContext) {
    prompt += postsContext;
  }

  // Proactive capabilities
  prompt += `

## Suas capacidades
Voce tem acesso aos seguintes dados REAIS da marca:
- DNA da marca completo (tom, personalidade, pilares, palavras)
- Perfil de estilo dos posts reais (estrutura, emojis, CTAs)
- As legendas reais com melhor performance e metricas de engajamento
- Analise de padroes (formatos, frequencia, tipos de conteudo)

Quando o usuario pedir ideias, sugestoes ou inspiracao:
1. Analise os posts reais e identifique padroes de sucesso
2. Identifique gaps de conteudo (pilares nao cobertos recentemente)
3. Sugira 3-5 ideias concretas baseadas nos dados
4. Para cada ideia, explique POR QUE vai funcionar (baseado nos dados)

Quando o usuario pedir "algo parecido" com um post:
1. Identifique o estilo e estrutura do post referenciado
2. Crie variacoes mantendo o que funcionou

Seja proativo: se o usuario der um tema vago, enriqueca com dados dos posts reais.
Mencione dados concretos (curtidas, comentarios, formatos) para mostrar que voce CONHECE a marca.`;

  // Platform constraints
  if (platforms.length > 0) {
    prompt += `\n\n## Plataformas`;
    platforms.forEach((p) => {
      const c = PLATFORM_CONSTRAINTS[p.toLowerCase()];
      if (c) prompt += `\n- ${p}: ${c}`;
    });
  }

  // Format-specific rules
  prompt += `\n\n## Formato: ${format}`;
  if (format === "carrossel") {
    prompt += `
Gere um carrossel PROFISSIONAL com slides variados. Cada slide deve ter um TIPO DIFERENTE de layout.

## Estrutura obrigatoria para carrossel (richSlides)

IMPORTANTE: Gere o campo "richSlides" (NAO "slides") com esta estrutura:

"richSlides": [
  {
    "slideNumber": 1,
    "contentType": "cover",
    "tag": "CATEGORIA EM CAPS",
    "headline": "Titulo principal impactante",
    "headlineHighlights": ["palavra1", "palavra2"],
    "sections": [
      { "type": "paragraph", "content": [
        { "text": "Subtitulo ou contexto breve do carrossel" }
      ]}
    ]
  },
  {
    "slideNumber": 2,
    "contentType": "content",
    "headline": "Titulo do conceito",
    "headlineHighlights": ["palavra-chave"],
    "sections": [
      { "type": "paragraph", "content": [
        { "text": "Texto normal " },
        { "text": "texto em destaque", "highlight": true },
        { "text": " continuacao do texto." }
      ]},
      { "type": "callout", "callout": {
        "text": "Insight importante em destaque",
        "style": "insight"
      }}
    ]
  },
  {
    "slideNumber": 3,
    "contentType": "data",
    "headline": "Titulo sobre os dados",
    "sections": [
      { "type": "stat", "stat": {
        "value": "47%",
        "label": "de aumento nos impostos",
        "source": "Fonte: IBGE 2025"
      }},
      { "type": "paragraph", "content": [
        { "text": "Contexto sobre esse dado..." }
      ]}
    ]
  },
  {
    "slideNumber": 4,
    "contentType": "list",
    "headline": "Titulo da lista",
    "sections": [
      { "type": "list", "items": [
        { "title": "Item 1", "description": "Descricao" },
        { "title": "Item 2", "description": "Descricao" },
        { "title": "Item 3", "description": "Descricao" }
      ]}
    ]
  },
  {
    "slideNumber": N,
    "contentType": "cta",
    "headline": "Frase de impacto final",
    "headlineHighlights": ["palavra-forte"],
    "sections": [
      { "type": "paragraph", "content": [
        { "text": "Subtexto motivador" }
      ]},
      { "type": "cta-button", "buttonText": "ACAO AQUI", "buttonSubtext": "texto complementar" }
    ],
    "footnote": "@nomedamarca"
  }
]

REGRAS dos slides:
- Slide 1 SEMPRE "cover" — headline grande + subtitulo
- Slide final SEMPRE "cta" — frase impactante + botao
- Slides intermediarios variam entre: "content", "data", "quote", "list", "timeline"
- NUNCA repita o mesmo contentType em slides consecutivos
- headlineHighlights: 1-3 palavras do headline que devem ter cor de destaque
- Cada slide deve ter 2-4 sections (nunca apenas 1)
- Stats devem ter valor numerico forte e fonte
- Callouts devem ser insights memoraveis
- Paragraphs usam RichText com highlights inline para enfase

IMPORTANTE: Alem de richSlides, mantenha tambem os campos basicos (headline, caption, hashtags, cta) para compatibilidade.`;
  } else if (format === "reels") {
    prompt += `\nGere tambem um reelsScript com hook, corpo (pontos), cta, duracao e musica_sugerida.`;
  }

  // Core rules
  prompt += `

## Regras absolutas
- NUNCA quebre o DNA da marca
- O conteudo deve ser INDISTINGUIVEL dos posts reais da marca
- Soe humano, NAO como IA (evite "nos dias de hoje", "e importante ressaltar", "diante disso")
- Use o MESMO padrao de emojis, quebras de linha e CTAs dos posts reais
- Hashtags devem incluir as que a marca ja usa + estrategicas novas

## Formato da copy (JSON)
{
  "headline": "titulo/gancho do post (max 60 chars)",
  "caption": "legenda completa",
  "hashtags": ["#tag1", "#tag2", ...],
  "cta": "call-to-action"${format === "carrossel" ? `,
  "richSlides": [{ "slideNumber": 1, "contentType": "cover", "headline": "...", "headlineHighlights": ["..."], "sections": [...] }, ...]` : ""}${format === "reels" ? `,
  "reelsScript": { "hook": "...", "corpo": ["..."], "cta": "...", "duracao": "30-45s", "musica_sugerida": "..." }` : ""}
}

## Formato de resposta
Primeiro escreva sua mensagem conversacional (2-3 frases, em PT-BR).
Depois escreva o JSON da copy dentro de um bloco ${"```json```"}.
SEMPRE inclua ambas as partes em TODA resposta.`;

  return prompt;
}

// ── SSE encoder helper ──────────────────────────────────────────────────────

function sseEncode(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ── Parse final AI response to extract text + JSON ──────────────────────────

function parseAIResponse(raw: string): { text: string; copy: CopyContent | null } {
  // Split on ```json block
  const jsonBlockMatch = raw.match(/```json\s*([\s\S]*?)```/);
  let text = raw;
  let copy: CopyContent | null = null;

  if (jsonBlockMatch) {
    text = raw.slice(0, raw.indexOf("```json")).trim();
    try {
      copy = JSON.parse(jsonBlockMatch[1].trim());
    } catch {
      // If JSON parse fails, try cleaning
      const cleaned = jsonBlockMatch[1].trim().replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
      try {
        copy = JSON.parse(cleaned);
      } catch {
        // Give up on JSON, return text only
      }
    }
  } else {
    // Try to find raw JSON object in the response
    const jsonMatch = raw.match(/\{[\s\S]*"headline"[\s\S]*"caption"[\s\S]*\}/);
    if (jsonMatch) {
      text = raw.slice(0, raw.indexOf(jsonMatch[0])).trim();
      try {
        copy = JSON.parse(jsonMatch[0]);
      } catch {
        // No valid JSON found
      }
    }
  }

  return { text, copy };
}

// ── Main route handler ──────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!isAIConfigured()) {
    return new Response(
      JSON.stringify({ error: "OpenAI API nao configurada." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  // Rate limiting
  const clientIp = getClientIp(request);
  if (!checkRateLimit(clientIp, "generate")) {
    return new Response(
      JSON.stringify({ error: "Limite de requisicoes excedido. Tente novamente em 1 minuto." }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const body: CopyChatRequest = await request.json();

    // Validate required fields
    if (!body.message || !body.empresa_id) {
      return new Response(
        JSON.stringify({ error: "Campos 'message' e 'empresa_id' sao obrigatorios." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const {
      message,
      format = "post",
      tone = "casual",
      platforms = [],
      topic = "",
      current_copy,
      history = [],
      empresa_id,
    } = body;

    // ── 1. Load context (same enrichment as generate/route.ts) ──

    const supabase = await createClient();

    // Fetch empresa data
    console.log(`[copy-chat] empresa_id=${empresa_id}`);

    const { data: empresa, error: empresaError } = await supabase
      .from("empresas")
      .select("nome, descricao, nicho, website")
      .eq("id", empresa_id)
      .single();

    if (empresaError || !empresa) {
      console.error(`[copy-chat] FAILED to load empresa: ${empresaError?.message || "not found"}`);
      return new Response(
        JSON.stringify({ error: "Empresa nao encontrada" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[copy-chat] Loaded empresa: ${empresa.nome} (nicho=${empresa.nicho})`);

    const empresaNome = empresa.nome || "a marca";
    const empresaNicho = empresa.nicho || "geral";
    const empresaDescricao = empresa.descricao || "";
    const empresaWebsite = empresa.website || "";

    // Fetch Brand DNA (resilient — works even if marca_dna table is empty)
    let dna: Record<string, unknown> | null = null;
    try {
      const { data: marcaDnaRow, error: dnaError } = await supabase
        .from("marca_dna")
        .select("dna_sintetizado")
        .eq("empresa_id", empresa_id)
        .single();

      if (dnaError) {
        console.warn(`[copy-chat] DNA fetch error: ${dnaError.message}`);
      } else if (marcaDnaRow?.dna_sintetizado) {
        dna = marcaDnaRow.dna_sintetizado as Record<string, unknown>;
        console.log(`[copy-chat] DNA loaded successfully from dna_sintetizado`);
      } else {
        console.log(`[copy-chat] No DNA configured for this empresa — using empresa context only`);
      }

      // Fallback: try full getMarcaDNA if dna_sintetizado was empty
      if (!dna) {
        try {
          const marcaDna = await getMarcaDNA(supabase, empresa_id);
          if (marcaDna) {
            dna = marcaDna as unknown as Record<string, unknown>;
            console.log(`[copy-chat] DNA loaded via getMarcaDNA fallback`);
          }
        } catch (fallbackErr) {
          console.warn(`[copy-chat] getMarcaDNA fallback error: ${(fallbackErr as Error).message}`);
        }
      }
    } catch (err) {
      console.warn(`[copy-chat] DNA exception: ${(err as Error).message}`);
    }

    // Fetch StyleProfile via pattern-analyzer
    let styleProfile: Record<string, unknown> | null = null;
    try {
      const sp = await analyzePostPatterns(empresa_id);
      styleProfile = sp as unknown as Record<string, unknown>;
      console.log("[copy-chat] Style profile loaded:", sp.analyzed_posts_count, "posts");
    } catch (err) {
      console.warn("[copy-chat] Style profile not available:", (err as Error).message);
    }

    // Fetch real Instagram posts with engagement data (expanded)
    let realCaptions: string[] = [];
    let postsContext = "";
    try {
      const { data: recentPosts, error: postsError } = await supabase
        .from("instagram_media_cache")
        .select("caption, like_count, comments_count, media_type, timestamp")
        .eq("empresa_id", empresa_id)
        .order("timestamp", { ascending: false })
        .limit(20);

      if (postsError) {
        console.warn(`[copy-chat] Instagram posts fetch error: ${postsError.message}`);
      } else {
        console.log(`[copy-chat] Instagram posts fetched: ${recentPosts?.length || 0} posts`);
      }

      if (recentPosts?.length) {
        // Extract captions for style reference (top by likes)
        const withCaptions = recentPosts.filter(
          (p: { caption: string | null }) => p.caption && p.caption.length > 30
        );
        const topByLikes = [...withCaptions]
          .sort((a: { like_count: number }, b: { like_count: number }) => b.like_count - a.like_count)
          .slice(0, 7);
        realCaptions = topByLikes.map((p: { caption: string }) => p.caption);

        // Build rich context block
        const avgLikes = recentPosts.reduce((s: number, p: { like_count: number }) => s + (p.like_count || 0), 0) / recentPosts.length;
        const avgComments = recentPosts.reduce((s: number, p: { comments_count: number }) => s + (p.comments_count || 0), 0) / recentPosts.length;

        // Count formats
        const formatCounts: Record<string, number> = {};
        recentPosts.forEach((p: { media_type: string | null }) => {
          const t = p.media_type || "unknown";
          formatCounts[t] = (formatCounts[t] || 0) + 1;
        });
        const formatStr = Object.entries(formatCounts)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ");

        postsContext = `\n\n## Dados dos ultimos ${recentPosts.length} posts`;
        postsContext += `\n- Media de curtidas: ${Math.round(avgLikes)}`;
        postsContext += `\n- Media de comentarios: ${Math.round(avgComments)}`;
        postsContext += `\n- Formatos: ${formatStr}`;

        postsContext += `\n\n### Top 5 posts por engajamento:`;
        const top5 = [...withCaptions]
          .sort((a: { like_count: number; comments_count: number }, b: { like_count: number; comments_count: number }) =>
            (b.like_count + b.comments_count * 3) - (a.like_count + a.comments_count * 3)
          )
          .slice(0, 5);
        top5.forEach((p: { like_count: number; comments_count: number; caption: string }, i: number) => {
          postsContext += `\n${i + 1}. [${p.like_count} curtidas, ${p.comments_count} comentarios] ${p.caption?.slice(0, 200)}`;
        });

        postsContext += `\n\n### Posts mais recentes:`;
        withCaptions.slice(0, 5).forEach((p: { timestamp: string; caption: string; media_type: string | null }, i: number) => {
          const date = p.timestamp ? new Date(p.timestamp).toLocaleDateString("pt-BR") : "?";
          postsContext += `\n${i + 1}. [${date} | ${p.media_type || "post"}] ${p.caption?.slice(0, 150)}`;
        });

        console.log("[copy-chat] Injected", realCaptions.length, "real captions +", recentPosts.length, "posts context");
      }
    } catch (err) {
      console.warn("[copy-chat] Could not fetch real captions:", (err as Error).message);
    }

    // ── 2. Build system prompt ──

    console.log(`[copy-chat] Building prompt: empresa=${empresaNome}, nicho=${empresaNicho}, dna=${dna ? 'yes' : 'no'}, style=${styleProfile ? 'yes' : 'no'}, captions=${realCaptions.length}`);

    const systemPrompt = buildSystemPrompt({
      empresaNome,
      empresaNicho,
      empresaDescricao,
      empresaWebsite,
      format,
      tone,
      platforms,
      dna,
      styleProfile,
      realCaptions,
      postsContext,
    });

    // ── 3. Build messages array ──

    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
    ];

    // Add history (last 10 messages to avoid context overflow)
    const recentHistory = history.slice(-10);
    for (const msg of recentHistory) {
      if (msg.role === "user" || msg.role === "assistant") {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // If current copy exists, include as context
    if (current_copy) {
      messages.push({
        role: "user",
        content: `[CONTEXTO] A copy atual e:\n\`\`\`json\n${JSON.stringify(current_copy, null, 2)}\n\`\`\``,
      });
    }

    // Add topic context on first message (no history)
    if (history.length === 0 && topic) {
      messages.push({
        role: "user",
        content: `Crie uma copy sobre o tema: "${topic}"\n\n${message}`,
      });
    } else {
      messages.push({ role: "user", content: message });
    }

    // ── 4. Call OpenAI with streaming ──

    const openai = getOpenAIClient();
    const temperature = getChatTemperature(tone);

    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature,
      max_tokens: 4000,
      stream: true,
    });

    // ── 5. Build SSE response stream ──

    const encoder = new TextEncoder();
    let fullContent = "";

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              // Stream text chunks
              controller.enqueue(
                encoder.encode(sseEncode("text", { content: delta }))
              );
            }
          }

          // Parse completed response to extract copy JSON
          const { text, copy } = parseAIResponse(fullContent);

          // Send the extracted copy as a separate event
          if (copy) {
            controller.enqueue(
              encoder.encode(sseEncode("copy", { copy }))
            );
          }

          // Send done event with session metadata
          controller.enqueue(
            encoder.encode(
              sseEncode("done", {
                session_id: body.session_id || null,
                message_text: text,
                has_copy: !!copy,
              })
            )
          );

          controller.close();
        } catch (err) {
          console.error("[copy-chat] Stream error:", err);
          controller.enqueue(
            encoder.encode(
              sseEncode("error", { error: (err as Error).message || "Stream failed" })
            )
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: unknown) {
    console.error("[copy-chat] Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Falha no copy-chat" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
