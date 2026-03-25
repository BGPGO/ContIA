import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient, isAIConfigured } from "@/lib/ai/config";

export async function POST(request: NextRequest) {
  if (!isAIConfigured()) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: "Missing URL" }, { status: 400 });
    }

    // Fetch the website content
    const siteResponse = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ContIA/1.0)" },
      signal: AbortSignal.timeout(10000),
    });

    if (!siteResponse.ok) {
      return NextResponse.json({ error: "Could not fetch website" }, { status: 400 });
    }

    const html = await siteResponse.text();
    // Extract text content, limit size
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 5000);

    const openai = getOpenAIClient();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Você é um analista de marketing digital. Analise o conteúdo do site e extraia insights para criação de conteúdo. Responda APENAS em JSON válido.",
        },
        {
          role: "user",
          content: `Analise este site (${url}) e extraia:

Conteúdo do site:
${textContent}

Responda em JSON:
{
  "resumo": "resumo do que a empresa faz em 2-3 frases",
  "tom_de_voz": "como a empresa se comunica (formal, casual, técnico, etc)",
  "publico_alvo": "quem é o público-alvo principal",
  "palavras_chave": ["palavra1", "palavra2", "palavra3", "palavra4", "palavra5"],
  "proposta_valor": "principal proposta de valor da empresa",
  "cores_predominantes": ["#hex1", "#hex2"]
}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    let clean = raw.trim();
    if (clean.startsWith("```")) {
      clean = clean.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();
    }
    const analysis = JSON.parse(clean);

    return NextResponse.json(analysis);
  } catch (error: any) {
    console.error("Site analysis error:", error);
    return NextResponse.json({ error: error.message || "Analysis failed" }, { status: 500 });
  }
}
