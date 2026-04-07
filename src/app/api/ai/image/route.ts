import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient, isAIConfigured } from "@/lib/ai/config";
import { imageSchema, formatZodError } from "@/lib/validation";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  if (!isAIConfigured()) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  // Rate limiting
  const clientIp = getClientIp(request);
  if (!checkRateLimit(clientIp, "generate")) {
    return NextResponse.json(
      { error: "Limite de requisicoes excedido. Tente novamente em 1 minuto." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();

    // Input validation
    const parsed = imageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 }
      );
    }

    const { prompt, size } = parsed.data;

    const openai = getOpenAIClient();

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: `Professional social media graphic: ${prompt}. Clean modern design, high quality.`,
      n: 1,
      size: size as "1024x1024" | "1024x1792" | "1792x1024",
      quality: "standard",
    });

    const imageUrl = response.data?.[0]?.url ?? null;

    return NextResponse.json({ imageUrl });
  } catch (error: any) {
    console.error("Image generation error:", error);
    return NextResponse.json(
      { error: error.message || "Image generation failed" },
      { status: 500 }
    );
  }
}
