import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient, isAIConfigured } from "@/lib/ai/config";
import { getPromptForFormat } from "@/lib/ai/prompts";
import type { GenerationRequest, GeneratedContent } from "@/types/ai";

export async function POST(request: NextRequest) {
  if (!isAIConfigured()) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  try {
    const body: GenerationRequest = await request.json();
    const { format, topic, empresaContext, plataformas, tone } = body;

    if (!topic || !format) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const openai = getOpenAIClient();
    const prompt = getPromptForFormat(format, empresaContext, topic, tone, plataformas);

    const hasDNA = empresaContext?.dnaMarca;
    const systemPrompt = hasDNA
      ? "Você é um estrategista de conteúdo sênior que segue rigorosamente o DNA da marca do cliente. Cada post deve refletir o tom de voz, personalidade e pilares de conteúdo definidos. Responda SEMPRE em JSON válido, sem markdown code blocks."
      : "Você é um assistente de criação de conteúdo. Responda SEMPRE em JSON válido, sem markdown code blocks.";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 2000,
    });

    const rawContent = completion.choices[0]?.message?.content || "{}";

    // Try to parse JSON, handling potential markdown wrapping
    let cleanJson = rawContent.trim();
    if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();
    }

    const generated: GeneratedContent = JSON.parse(cleanJson);

    return NextResponse.json(generated);
  } catch (error: any) {
    console.error("AI generation error:", error);
    return NextResponse.json(
      { error: error.message || "Generation failed" },
      { status: 500 }
    );
  }
}
