import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient, isAIConfigured } from "@/lib/ai/config";

// ═══════════════════════════════════════════════════════════════════════
// POST /api/video/chat-simple
// Stateless video chat — no DB needed. Works in local-only mode.
// ═══════════════════════════════════════════════════════════════════════

interface ChatSimpleBody {
  message: string;
  transcription?: string;
  videoSummary?: string;
  subtitleConfig?: Record<string, unknown>;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

const SYSTEM_PROMPT = `Voce e o "ContIA Video", um assistente de edicao de video inteligente.
Voce ajuda o usuario a editar, cortar e otimizar videos para redes sociais.
SEMPRE responda em PT-BR. Seja direto, pratico e proativo.

Voce pode executar acoes retornando no campo "action". Acoes possiveis:
- ADD_CUT: { type: "ADD_CUT", payload: { start: number, end: number, label?: string } }
- SUGGEST_CUTS: { type: "SUGGEST_CUTS", payload: { suggestions: [{ start, end, label, reason }] } }
- ADD_SUBTITLES: { type: "ADD_SUBTITLES", payload: { enabled: true } }
- REMOVE_SUBTITLES: { type: "REMOVE_SUBTITLES", payload: { enabled: false } }
- UPDATE_SUBTITLE_STYLE: { type: "UPDATE_SUBTITLE_STYLE", payload: { fontSize?: "sm"|"md"|"lg"|"xl", color?: string, bgColor?: string, fontWeight?: "normal"|"bold"|"extrabold", position?: "bottom"|"center"|"top", animation?: "none"|"fade"|"pop", fontFamily?: "sans"|"mono"|"serif" } }
  Use esta acao quando o usuario pedir para mudar cor, tamanho, posicao ou estilo da legenda.
  Exemplos de mapeamento:
  - "muda a cor da legenda pra amarelo" -> color: "#FBBF24"
  - "legenda maior" -> fontSize: "xl"
  - "legenda no topo" -> position: "top"
  - "estilo viral" -> fontSize: "xl", fontWeight: "extrabold", color: "#FFFFFF", animation: "pop"
  - "legenda neon" -> color: "#00FF88", bgColor: "transparent", fontWeight: "bold"
  - "fonte monospacada" -> fontFamily: "mono"
- ADD_LOGO: { type: "ADD_LOGO", payload: { position: string } }
- REMOVE_LOGO: { type: "REMOVE_LOGO" }
- EXPORT: { type: "EXPORT" }
- NONE: quando e so conversa, sem acao

Cores comuns: vermelho=#EF4444, amarelo=#FBBF24, verde=#22C55E, azul=#3B82F6, branco=#FFFFFF, preto=#000000, rosa=#EC4899, roxo=#A855F7, laranja=#F97316, ciano=#06B6D4

IMPORTANTE: Sua resposta DEVE ser um JSON valido puro (sem markdown, sem backticks):
{
  "message": "sua resposta em PT-BR",
  "action": { "type": "...", "payload": { ... } } ou null,
  "suggestions": ["sugestao rapida 1", "sugestao rapida 2"]
}`;

export async function POST(req: NextRequest) {
  if (!isAIConfigured()) {
    return NextResponse.json(
      { error: "OpenAI API key not configured" },
      { status: 500 }
    );
  }

  try {
    const body: ChatSimpleBody = await req.json();
    const { message, transcription, videoSummary, subtitleConfig, history } = body;

    if (!message?.trim()) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const openai = getOpenAIClient();

    // Build context
    const contextParts: string[] = [SYSTEM_PROMPT];

    if (videoSummary) {
      contextParts.push(`\n══════ VIDEO ══════\n${videoSummary}`);
    }

    if (transcription) {
      contextParts.push(`\n══════ TRANSCRICAO ══════\n${transcription}`);
    }

    if (subtitleConfig) {
      contextParts.push(
        `\n══════ ESTILO ATUAL DA LEGENDA ══════\n${JSON.stringify(subtitleConfig)}`
      );
    }

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: contextParts.join("\n") },
    ];

    // Add conversation history (last 20)
    if (history?.length) {
      for (const msg of history.slice(-20)) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: "user", content: message.trim() });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.6,
      max_tokens: 1500,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content || "";

    try {
      const parsed = JSON.parse(raw);
      return NextResponse.json({
        message: parsed.message || "Desculpe, nao consegui processar. Pode repetir?",
        action: parsed.action?.type && parsed.action.type !== "NONE" ? parsed.action : null,
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      });
    } catch {
      return NextResponse.json({
        message: raw || "Desculpe, ocorreu um erro. Tente novamente.",
        action: null,
        suggestions: ["Sugere cortes virais", "Adiciona legendas", "Muda estilo da legenda"],
      });
    }
  } catch (err) {
    console.error("[chat-simple] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
