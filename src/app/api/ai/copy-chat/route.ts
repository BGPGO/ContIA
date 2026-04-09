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
  format: string;
  tone: ContentTone;
  platforms: string[];
  dna: Record<string, unknown> | null;
  styleProfile: Record<string, unknown> | null;
  realCaptions: string[];
}): string {
  const { empresaNome, format, tone, platforms, dna, styleProfile, realCaptions } = params;

  let prompt = `Voce e o copywriter e ghostwriter oficial da marca ${empresaNome}.

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
    prompt += `\nGere tambem slides com headline + body para cada slide.`;
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
  "slides": [{ "slideNumber": 1, "headline": "...", "body": "..." }, ...]` : ""}${format === "reels" ? `,
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
    const { data: empresa } = await supabase
      .from("empresas")
      .select("nome, descricao, nicho, website")
      .eq("id", empresa_id)
      .single();

    const empresaNome = empresa?.nome || "a marca";

    // Fetch Brand DNA
    let dna: Record<string, unknown> | null = null;
    try {
      const marcaDna = await getMarcaDNA(supabase, empresa_id);
      if (marcaDna) {
        dna = marcaDna as unknown as Record<string, unknown>;
      }
    } catch (err) {
      console.warn("[copy-chat] DNA not available:", (err as Error).message);
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

    // Fetch real Instagram captions (top 7 by likes)
    let realCaptions: string[] = [];
    try {
      const { data: realPosts } = await supabase
        .from("instagram_media_cache")
        .select("caption, like_count")
        .eq("empresa_id", empresa_id)
        .order("like_count", { ascending: false })
        .limit(10);

      if (realPosts?.length) {
        realCaptions = realPosts
          .filter((p: { caption: string | null }) => p.caption && p.caption.length > 30)
          .slice(0, 7)
          .map((p: { caption: string }) => p.caption);
        console.log("[copy-chat] Injected", realCaptions.length, "real captions");
      }
    } catch (err) {
      console.warn("[copy-chat] Could not fetch real captions:", (err as Error).message);
    }

    // ── 2. Build system prompt ──

    const systemPrompt = buildSystemPrompt({
      empresaNome,
      format,
      tone,
      platforms,
      dna,
      styleProfile,
      realCaptions,
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
      max_tokens: 2500,
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
