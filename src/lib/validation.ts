import { z } from "zod";

// ── SSRF Protection: block internal/private IPs and dangerous protocols ──────

function isBlockedUrl(urlString: string): string | null {
  try {
    const url = new URL(urlString);

    // Block non-http(s) protocols
    if (!["http:", "https:"].includes(url.protocol)) {
      return "Apenas protocolos http e https sao permitidos";
    }

    const hostname = url.hostname.toLowerCase();

    // Block localhost variants
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "[::1]" ||
      hostname === "::1"
    ) {
      return "URLs locais nao sao permitidas";
    }

    // Block private IP ranges
    const ipMatch = hostname.match(
      /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
    );
    if (ipMatch) {
      const [, a, b] = ipMatch.map(Number);
      // 10.0.0.0/8
      if (a === 10) return "IPs internos nao sao permitidos";
      // 172.16.0.0/12
      if (a === 172 && b >= 16 && b <= 31)
        return "IPs internos nao sao permitidos";
      // 192.168.0.0/16
      if (a === 192 && b === 168) return "IPs internos nao sao permitidos";
      // 0.0.0.0/8
      if (a === 0) return "IPs internos nao sao permitidos";
      // 169.254.0.0/16 (link-local)
      if (a === 169 && b === 254) return "IPs internos nao sao permitidos";
    }

    return null; // URL is safe
  } catch {
    return "URL invalida";
  }
}

// ── Schemas ──────────────────────────────────────────────────────────────────

export const generateSchema = z.object({
  format: z.string().min(1, "Campo 'format' e obrigatorio"),
  topic: z.string().min(1, "Campo 'topic' e obrigatorio").max(1000, "Campo 'topic' excede o limite de 1000 caracteres"),
  tone: z.string().max(200).optional(),
  empresaContext: z.any().optional(),
  plataformas: z.array(z.string()).optional(),
});

export const imageSchema = z.object({
  prompt: z.string().min(1, "Campo 'prompt' e obrigatorio").max(2000, "Campo 'prompt' excede o limite de 2000 caracteres"),
  size: z
    .enum(["1024x1024", "1024x1792", "1792x1024"])
    .optional()
    .default("1024x1024"),
});

export const analyzeSiteSchema = z.object({
  url: z
    .string()
    .url("URL invalida")
    .refine(
      (val) => {
        // Block file://, ftp://, etc.
        try {
          const url = new URL(val);
          return ["http:", "https:"].includes(url.protocol);
        } catch {
          return false;
        }
      },
      { message: "Apenas protocolos http e https sao permitidos" }
    )
    .refine(
      (val) => {
        const blocked = isBlockedUrl(val);
        return blocked === null;
      },
      { message: "URL bloqueada por politica de seguranca (SSRF)" }
    ),
});

export const analyzeInstagramSchema = z.object({
  username: z
    .string()
    .min(1, "Campo 'username' e obrigatorio")
    .max(100, "Username excede o limite de 100 caracteres")
    .regex(
      /^@?[a-zA-Z0-9._]+$/,
      "Username contém caracteres invalidos"
    ),
});

export const generatePostDesignSchema = z.object({
  topic: z.string().min(1, "Campo 'topic' e obrigatorio").max(1000, "Campo 'topic' excede o limite de 1000 caracteres"),
  empresaContext: z.any().optional(),
  visualStyle: z.any().optional(),
  tone: z.string().max(200).optional(),
  format: z.string().max(100).optional(),
  additionalInstructions: z.string().max(2000).optional(),
});

export const marcaAnalisarSchema = z.object({
  empresaId: z.string().min(1, "Campo 'empresaId' e obrigatorio"),
});

// ── Helper to format Zod errors ──────────────────────────────────────────────

export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return `${path}${issue.message}`;
    })
    .join("; ");
}
