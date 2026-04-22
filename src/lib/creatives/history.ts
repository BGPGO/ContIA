import type Anthropic from "@anthropic-ai/sdk";

export interface MessageAttachment {
  url: string;
  mediaType: "image/png" | "image/jpeg" | "image/webp";
  name?: string;
}

export interface RawMessage {
  role: "user" | "assistant";
  content: string;
  html?: string | null;
  attachments?: MessageAttachment[] | null;
}

const MAX_MESSAGES = 6;
const MAX_HTML_CHARS_OLD = 500;

export function truncateHistory(
  messages: RawMessage[]
): Anthropic.Messages.MessageParam[] {
  const tail = messages.slice(-MAX_MESSAGES);
  const lastIdx = tail.length - 1;
  // Cache boundary = penúltima mensagem. Anthropic cacheia tudo até ela
  // (incluindo), a última roda fresh. Só ativa se houver ≥ 2 mensagens.
  const cacheBoundary = lastIdx >= 1 ? lastIdx - 1 : -1;

  return tail.map((m, i) => {
    const isLast = i === lastIdx;
    const shouldCache = i === cacheBoundary;

    let text = m.content;
    if (m.role === "assistant" && m.html) {
      const htmlPart = isLast
        ? m.html
        : m.html.slice(0, MAX_HTML_CHARS_OLD) +
          (m.html.length > MAX_HTML_CHARS_OLD
            ? "\n<!-- ...truncado... -->"
            : "");
      text = `${m.content}\n\n\`\`\`html\n${htmlPart}\n\`\`\``;
    }

    // Última user com attachments → multimodal (pode ter cache_control se coincidir)
    if (
      isLast &&
      m.role === "user" &&
      m.attachments &&
      m.attachments.length > 0
    ) {
      const imageBlocks: Anthropic.Messages.ImageBlockParam[] =
        m.attachments.map((a) => ({
          type: "image",
          source: { type: "url", url: a.url },
        }));
      const textBlock: Anthropic.Messages.TextBlockParam = {
        type: "text",
        text,
      };
      return { role: "user", content: [...imageBlocks, textBlock] };
    }

    // Mensagem no cache boundary → content array com cache_control no último block.
    // Marca o histórico até aqui como cacheável (economia de ~60-70% em input tokens
    // nas iterações seguintes).
    if (shouldCache) {
      const textBlock: Anthropic.Messages.TextBlockParam = {
        type: "text",
        text,
        cache_control: { type: "ephemeral" },
      };
      return { role: m.role, content: [textBlock] };
    }

    // Demais mensagens: string simples (compat + menor overhead)
    return { role: m.role, content: text };
  });
}

/**
 * Extrai prosa + bloco HTML da resposta bruta do Claude.
 * Formato esperado: "frase curta PT-BR\n\n```html\n<!DOCTYPE html>...\n```"
 */
export function splitProseAndHtml(raw: string): {
  prose: string;
  html: string;
} {
  const match = raw.match(/```html\s*\n([\s\S]*?)\n```/);
  if (!match) {
    // fallback: se não achou bloco, tenta detectar <!DOCTYPE ou <html
    const htmlStart = raw.search(/<!DOCTYPE html>|<html/i);
    if (htmlStart >= 0) {
      return {
        prose: raw.slice(0, htmlStart).trim(),
        html: raw.slice(htmlStart).trim(),
      };
    }
    return { prose: raw.trim(), html: "" };
  }
  const html = match[1].trim();
  const prose = raw.slice(0, match.index).trim();
  return { prose, html };
}
