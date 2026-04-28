import { getOpenAIClient } from "@/lib/ai/config";
import { DNASintetizado } from "@/types/index";

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export interface VideoProject {
  id: string;
  empresa_id: string;
  title: string;
  video_url: string;
  duration_seconds: number;
  analysis?: VideoAnalysis;
  transcription?: VideoTranscription;
  edits: VideoEdits;
  chat_messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

export interface VideoAnalysis {
  summary: string;
  key_moments: KeyMoment[];
  mood: string;
  pacing: string;
  topics: string[];
  viral_potential?: string;
}

export interface KeyMoment {
  timestamp_start: number; // seconds
  timestamp_end: number;
  description: string;
  type: "hook" | "highlight" | "transition" | "cta" | "filler";
}

export interface VideoTranscription {
  full_text: string;
  segments: TranscriptionSegment[];
  language: string;
}

export interface TranscriptionSegment {
  start: number; // seconds
  end: number;
  text: string;
  words?: TranscriptionWord[];
}

export interface TranscriptionWord {
  word: string;
  start: number;
  end: number;
}

export interface VideoEdits {
  cuts: VideoCut[];
  subtitles_enabled: boolean;
  logo?: LogoOverlay;
  srt_content?: string;
}

export interface VideoCut {
  id: string;
  start: number; // seconds
  end: number;
  label?: string;
  created_at: string;
}

export interface LogoOverlay {
  url: string;
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  size: number; // percentage of width (5-25)
  opacity: number; // 0-1
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  action?: AgentAction;
  timestamp: string;
}

export type AgentActionType =
  | "ADD_CUT"
  | "ADJUST_CUT"
  | "REMOVE_CUT"
  | "ADD_SUBTITLES"
  | "REMOVE_SUBTITLES"
  | "ADD_LOGO"
  | "REMOVE_LOGO"
  | "SUGGEST_CUTS"
  | "EXPORT"
  | "NONE";

export interface AgentAction {
  type: AgentActionType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any;
}

export interface AgentResponse {
  message: string;
  action?: AgentAction;
  suggestions?: string[];
}

// ═══════════════════════════════════════════════════════════════════════
// TIMESTAMP HELPERS
// ═══════════════════════════════════════════════════════════════════════

export function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function parseTimestamp(ts: string): number | null {
  // Supports "1:30", "01:30", "1m30s", "90s", "1:30:00"
  const hmsMatch = ts.match(/^(\d+):(\d{2}):(\d{2})$/);
  if (hmsMatch) {
    return parseInt(hmsMatch[1]) * 3600 + parseInt(hmsMatch[2]) * 60 + parseInt(hmsMatch[3]);
  }
  const msMatch = ts.match(/^(\d+):(\d{2})$/);
  if (msMatch) {
    return parseInt(msMatch[1]) * 60 + parseInt(msMatch[2]);
  }
  const minsecMatch = ts.match(/^(\d+)m(\d+)s$/);
  if (minsecMatch) {
    return parseInt(minsecMatch[1]) * 60 + parseInt(minsecMatch[2]);
  }
  const secMatch = ts.match(/^(\d+)s$/);
  if (secMatch) {
    return parseInt(secMatch[1]);
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════════════

export function createVideoAgentContext(
  project: VideoProject,
  dna?: DNASintetizado
): string {
  const parts: string[] = [];

  parts.push(`Voce e um assistente de edicao de video inteligente e amigavel chamado "GO Studio Video".
Voce ajuda o usuario a editar, cortar e otimizar videos para redes sociais.
SEMPRE responda em PT-BR. Seja direto, pratico e proativo.

Regras gerais:
- Quando o usuario pedir para cortar, identifique os timestamps exatos e retorne a acao ADD_CUT.
- Quando sugerir cortes, use os key_moments e a transcricao para encontrar os melhores trechos virais.
- Sempre inclua timestamps formatados (ex: 1:30) nas suas respostas quando referenciar momentos do video.
- Sugira melhorias proativamente: hooks melhores, ritmo, legendas, logo.
- Para conteudo viral, priorize: gancho forte nos primeiros 3s, ritmo rapido, legendas, CTA no final.
- Quando nao entender a intencao do usuario, pergunte para esclarecer.

Acoes disponiveis (retorne no campo "action" do JSON quando aplicavel):
- ADD_CUT: { type: "ADD_CUT", payload: { start: number, end: number, label?: string } }
- ADJUST_CUT: { type: "ADJUST_CUT", payload: { cutIndex: number, newStart?: number, newEnd?: number } }
- REMOVE_CUT: { type: "REMOVE_CUT", payload: { cutIndex: number } }
- ADD_SUBTITLES: { type: "ADD_SUBTITLES", payload: { enabled: true } }
- REMOVE_SUBTITLES: { type: "REMOVE_SUBTITLES", payload: { enabled: false } }
- ADD_LOGO: { type: "ADD_LOGO", payload: { position: string, logoUrl?: string } }
- REMOVE_LOGO: { type: "REMOVE_LOGO" }
- SUGGEST_CUTS: { type: "SUGGEST_CUTS", payload: { suggestions: [{ start, end, label, reason }] } }
- EXPORT: { type: "EXPORT" }
- NONE: quando e so conversa, sem acao

IMPORTANTE: Sua resposta DEVE ser um JSON valido puro (sem markdown, sem backticks):
{
  "message": "sua resposta em PT-BR",
  "action": { "type": "...", "payload": { ... } } ou null,
  "suggestions": ["sugestao rapida 1", "sugestao rapida 2"]
}`);

  // Video info
  parts.push(`\n══════ VIDEO ══════
Titulo: ${project.title}
Duracao: ${formatTimestamp(project.duration_seconds)} (${project.duration_seconds}s)`);

  // Analysis
  if (project.analysis) {
    const a = project.analysis;
    parts.push(`\n══════ ANALISE DO VIDEO ══════
Resumo: ${a.summary}
Mood: ${a.mood}
Ritmo: ${a.pacing}
Topicos: ${a.topics.join(", ")}
${a.viral_potential ? `Potencial viral: ${a.viral_potential}` : ""}`);

    if (a.key_moments.length > 0) {
      parts.push("\nMomentos-chave:");
      a.key_moments.forEach((km) => {
        parts.push(
          `  [${formatTimestamp(km.timestamp_start)} - ${formatTimestamp(km.timestamp_end)}] (${km.type}) ${km.description}`
        );
      });
    }
  }

  // Transcription
  if (project.transcription) {
    const t = project.transcription;
    parts.push(`\n══════ TRANSCRICAO COMPLETA ══════
Idioma: ${t.language}
Texto: ${t.full_text}`);

    if (t.segments.length > 0) {
      parts.push("\nSegmentos com timestamps:");
      t.segments.forEach((seg) => {
        parts.push(`  [${formatTimestamp(seg.start)} - ${formatTimestamp(seg.end)}] ${seg.text}`);
      });
    }
  }

  // Current edits
  const e = project.edits;
  if (e.cuts.length > 0 || e.subtitles_enabled || e.logo) {
    parts.push("\n══════ EDICOES ATUAIS ══════");
    if (e.cuts.length > 0) {
      parts.push("Cortes:");
      e.cuts.forEach((cut, i) => {
        parts.push(
          `  ${i + 1}. [${formatTimestamp(cut.start)} - ${formatTimestamp(cut.end)}]${cut.label ? ` "${cut.label}"` : ""}`
        );
      });
    }
    parts.push(`Legendas: ${e.subtitles_enabled ? "ativadas" : "desativadas"}`);
    if (e.logo) {
      parts.push(`Logo: ${e.logo.position} (${e.logo.url})`);
    }
  } else {
    parts.push("\n══════ EDICOES ATUAIS ══════\nNenhuma edicao aplicada ainda.");
  }

  // Brand DNA
  if (dna) {
    parts.push("\n══════ DNA DA MARCA ══════");
    if (dna.tom_de_voz) parts.push(`Tom de voz: ${dna.tom_de_voz}`);
    if (dna.personalidade_marca) parts.push(`Personalidade: ${dna.personalidade_marca}`);
    if (dna.estilo_visual) parts.push(`Estilo visual: ${dna.estilo_visual}`);
    if (dna.paleta_cores?.length) parts.push(`Cores: ${dna.paleta_cores.join(", ")}`);
    if (dna.pilares_conteudo?.length) parts.push(`Pilares: ${dna.pilares_conteudo.join(", ")}`);
    if (dna.publico_alvo) parts.push(`Publico-alvo: ${dna.publico_alvo}`);
    parts.push(
      "Use o DNA da marca para sugerir estilo de legendas, posicao do logo, e tom das sugestoes."
    );
  }

  return parts.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════
// AGENT MESSAGE PROCESSOR
// ═══════════════════════════════════════════════════════════════════════

export async function processAgentMessage(
  project: VideoProject,
  userMessage: string,
  history: ChatMessage[],
  dna?: DNASintetizado
): Promise<AgentResponse> {
  const openai = getOpenAIClient();
  const systemPrompt = createVideoAgentContext(project, dna);

  // Build conversation history for OpenAI
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  // Include recent history (last 20 messages to stay within context)
  const recentHistory = history.slice(-20);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  messages.push({ role: "user", content: userMessage });

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

    const response: AgentResponse = {
      message: parsed.message || "Desculpe, nao consegui processar sua mensagem. Pode repetir?",
    };

    if (parsed.action && parsed.action.type && parsed.action.type !== "NONE") {
      response.action = {
        type: parsed.action.type,
        payload: parsed.action.payload,
      };
    }

    if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
      response.suggestions = parsed.suggestions;
    }

    return response;
  } catch {
    // If JSON parsing fails, return raw text as message
    return {
      message: raw || "Desculpe, ocorreu um erro. Tente novamente.",
      suggestions: ["Sugere cortes virais", "Adiciona legendas", "Exporta"],
    };
  }
}
