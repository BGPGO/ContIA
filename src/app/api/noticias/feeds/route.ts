import { NextRequest, NextResponse } from "next/server";
import { parseFeed, getDefaultFeeds } from "@/lib/rss";
import { createClient } from "@/lib/supabase/server";
import { ConfigRSS } from "@/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const empresaId = searchParams.get("empresaId");
  const nicho = searchParams.get("nicho") || "geral";

  const defaultFeeds = getDefaultFeeds();
  const nichoFeeds = defaultFeeds[nicho.toLowerCase()] || defaultFeeds.geral;

  let customFeeds: ConfigRSS[] = [];

  if (empresaId) {
    try {
      const supabase = await createClient();
      const { data: empresa } = await supabase
        .from("empresas")
        .select("config_rss")
        .eq("id", empresaId)
        .single();

      if (empresa?.config_rss && Array.isArray(empresa.config_rss)) {
        customFeeds = empresa.config_rss;
      }
    } catch {
      // Supabase nao disponivel
    }
  }

  return NextResponse.json({
    customFeeds,
    defaultFeeds: nichoFeeds,
    allDefaultFeeds: defaultFeeds,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { empresaId, nome, url, topico } = body;

    if (!empresaId || !nome || !url || !topico) {
      return NextResponse.json(
        { error: "Campos obrigatorios: empresaId, nome, url, topico" },
        { status: 400 }
      );
    }

    // Validar URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "URL invalida. Inclua http:// ou https://" },
        { status: 400 }
      );
    }

    // Validar se eh um feed RSS valido tentando parsear
    const testItems = await parseFeed(url, nome, topico);
    if (testItems.length === 0) {
      return NextResponse.json(
        { error: "Nao foi possivel ler o feed RSS. Verifique se a URL eh de um feed valido." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Buscar config_rss atual
    const { data: empresa, error: fetchError } = await supabase
      .from("empresas")
      .select("config_rss")
      .eq("id", empresaId)
      .single();

    if (fetchError) {
      return NextResponse.json(
        { error: "Empresa nao encontrada." },
        { status: 404 }
      );
    }

    const currentFeeds: ConfigRSS[] = Array.isArray(empresa.config_rss)
      ? empresa.config_rss
      : [];

    // Verificar duplicata por URL
    if (currentFeeds.some((f) => f.url === url)) {
      return NextResponse.json(
        { error: "Este feed ja esta cadastrado." },
        { status: 409 }
      );
    }

    const newFeed: ConfigRSS = { nome, url, topico, ativo: true };
    const updatedFeeds = [...currentFeeds, newFeed];

    const { error: updateError } = await supabase
      .from("empresas")
      .update({ config_rss: updatedFeeds })
      .eq("id", empresaId);

    if (updateError) {
      return NextResponse.json(
        { error: "Erro ao salvar feed." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      feed: newFeed,
      feeds: updatedFeeds,
      testItems: testItems.slice(0, 3),
    });
  } catch (error) {
    console.error("Erro ao adicionar feed:", error);
    return NextResponse.json(
      { error: "Erro interno ao adicionar feed." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { empresaId, index } = body;

    if (!empresaId || typeof index !== "number") {
      return NextResponse.json(
        { error: "Campos obrigatorios: empresaId, index" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: empresa, error: fetchError } = await supabase
      .from("empresas")
      .select("config_rss")
      .eq("id", empresaId)
      .single();

    if (fetchError) {
      return NextResponse.json(
        { error: "Empresa nao encontrada." },
        { status: 404 }
      );
    }

    const currentFeeds: ConfigRSS[] = Array.isArray(empresa.config_rss)
      ? empresa.config_rss
      : [];

    if (index < 0 || index >= currentFeeds.length) {
      return NextResponse.json(
        { error: "Indice invalido." },
        { status: 400 }
      );
    }

    const removed = currentFeeds[index];
    const updatedFeeds = currentFeeds.filter((_, i) => i !== index);

    const { error: updateError } = await supabase
      .from("empresas")
      .update({ config_rss: updatedFeeds })
      .eq("id", empresaId);

    if (updateError) {
      return NextResponse.json(
        { error: "Erro ao remover feed." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      removed,
      feeds: updatedFeeds,
    });
  } catch (error) {
    console.error("Erro ao remover feed:", error);
    return NextResponse.json(
      { error: "Erro interno ao remover feed." },
      { status: 500 }
    );
  }
}
