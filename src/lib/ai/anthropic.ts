import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY não configurada");
  }
  if (!client) {
    client = new Anthropic({ apiKey });
  }
  return client;
}

export function isAnthropicConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export const ANTHROPIC_MODELS = {
  sonnet: "claude-sonnet-4-6",
  opus: "claude-opus-4-7",
} as const;

export type AnthropicModelKey = keyof typeof ANTHROPIC_MODELS;

export function resolveModel(key: string | null | undefined): string {
  if (key === "opus") return ANTHROPIC_MODELS.opus;
  return ANTHROPIC_MODELS.sonnet;
}
