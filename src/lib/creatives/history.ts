import type Anthropic from "@anthropic-ai/sdk";

export interface RawMessage {
  role: "user" | "assistant";
  content: string;
  html?: string | null;
}

const MAX_MESSAGES = 6;
const MAX_HTML_CHARS_OLD = 500;

export function truncateHistory(
  messages: RawMessage[]
): Anthropic.Messages.MessageParam[] {
  const tail = messages.slice(-MAX_MESSAGES);
  return tail.map((m, i) => {
    const isLast = i === tail.length - 1;
    let text = m.content;
    if (m.role === "assistant" && m.html) {
      const htmlPart =
        isLast
          ? m.html
          : m.html.slice(0, MAX_HTML_CHARS_OLD) +
            (m.html.length > MAX_HTML_CHARS_OLD
              ? "\n<!-- ...truncado... -->"
              : "");
      text = `${m.content}\n\n\`\`\`html\n${htmlPart}\n\`\`\``;
    }
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
