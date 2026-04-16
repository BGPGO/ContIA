import { NextRequest, NextResponse } from "next/server";
import { getDefaultFeeds } from "@/lib/rss";
import { createClient } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { ConfigRSS } from "@/types";
import { invalidateNoticiasCache } from "../route";

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

    // Validar formato de URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "URL invalida. Inclua http:// ou https://" },
        { status: 400 }
      );
    }

    // Verificar autenticacao com client normal
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Nao autenticado." },
        { status: 401 }
      );
    }

    // Buscar config_rss atual — usar admin para garantir leitura mesmo com RLS
    const admin = getAdminSupabase();
    const { data: empresa, error: fetchError } = await admin
      .from("empresas")
      .select("id, user_id, config_rss")
      .eq("id", empresaId)
      .single();

    if (fetchError || !empresa) {
      return NextResponse.json(
        { error: "Empresa nao encontrada." },
        { status: 404 }
      );
    }

    // Garantir que o usuario autenticado eh dono da empresa
    if (empresa.user_id !== user.id) {
      return NextResponse.json(
        { error: "Sem permissao para modificar esta empresa." },
        { status: 403 }
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

    // Usar admin para garantir que o update nao seja bloqueado por RLS
    const { error: updateError } = await admin
      .from("empresas")
      .update({ config_rss: updatedFeeds })
      .eq("id", empresaId);

    if (updateError) {
      console.error("Erro ao atualizar config_rss:", updateError);
      return NextResponse.json(
        { error: "Erro ao salvar feed." },
        { status: 500 }
      );
    }

    // Invalidar cache de noticias para que proximo fetch use os novos feeds
    invalidateNoticiasCache(empresaId);

    return NextResponse.json({
      feed: newFeed,
      feeds: updatedFeeds,
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

    // Verificar autenticacao
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Nao autenticado." },
        { status: 401 }
      );
    }

    const admin = getAdminSupabase();
    const { data: empresa, error: fetchError } = await admin
      .from("empresas")
      .select("id, user_id, config_rss")
      .eq("id", empresaId)
      .single();

    if (fetchError || !empresa) {
      return NextResponse.json(
        { error: "Empresa nao encontrada." },
        { status: 404 }
      );
    }

    if (empresa.user_id !== user.id) {
      return NextResponse.json(
        { error: "Sem permissao para modificar esta empresa." },
        { status: 403 }
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

    const { error: updateError } = await admin
      .from("empresas")
      .update({ config_rss: updatedFeeds })
      .eq("id", empresaId);

    if (updateError) {
      console.error("Erro ao remover feed:", updateError);
      return NextResponse.json(
        { error: "Erro ao remover feed." },
        { status: 500 }
      );
    }

    // Invalidar cache de noticias para que proximo fetch use os feeds atualizados
    invalidateNoticiasCache(empresaId);

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
