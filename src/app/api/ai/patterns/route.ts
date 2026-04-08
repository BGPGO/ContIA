import { NextRequest, NextResponse } from "next/server";
import { analyzePostPatterns } from "@/lib/ai/pattern-analyzer";
import { isAIConfigured } from "@/lib/ai/config";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const empresaId = searchParams.get("empresa_id");

  if (!empresaId) {
    return NextResponse.json(
      { error: "empresa_id é obrigatório" },
      { status: 400 }
    );
  }

  if (!isAIConfigured()) {
    return NextResponse.json(
      { error: "OpenAI API não configurada" },
      { status: 503 }
    );
  }

  const clientIp = getClientIp(request);
  if (!checkRateLimit(clientIp, "analyze")) {
    return NextResponse.json(
      { error: "Limite de requisições excedido" },
      { status: 429 }
    );
  }

  try {
    const styleProfile = await analyzePostPatterns(empresaId);
    return NextResponse.json({ style_profile: styleProfile });
  } catch (error: any) {
    console.error("[patterns] Error:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao analisar padrões" },
      { status: 500 }
    );
  }
}
