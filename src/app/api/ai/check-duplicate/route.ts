import { NextRequest, NextResponse } from "next/server";
import { checkDuplicate } from "@/lib/anti-duplicidade";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { empresaId, content } = body as {
      empresaId?: string;
      content?: string;
    };

    if (!empresaId || !content) {
      return NextResponse.json(
        { error: "Campos 'empresaId' e 'content' são obrigatórios" },
        { status: 400 }
      );
    }

    if (content.trim().length < 10) {
      return NextResponse.json(
        { error: "Conteúdo muito curto para verificação (mínimo 10 caracteres)" },
        { status: 400 }
      );
    }

    const result = checkDuplicate(empresaId, content);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Check duplicate error:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao verificar duplicidade" },
      { status: 500 }
    );
  }
}
