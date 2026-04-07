import { NextRequest, NextResponse } from "next/server";
import { getNoticiasForNicho, NoticiaItem } from "@/lib/rss";
import { AnalysisCache, cacheKey } from "@/lib/cache";
import { createClient } from "@/lib/supabase/server";

// Cache de noticias com TTL de 1 hora
const noticiasCache = new AnalysisCache(60 * 60 * 1000);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nicho = searchParams.get("nicho") || "geral";
  const empresaId = searchParams.get("empresa_id");

  try {
    // Tentar buscar feeds customizados da empresa
    let customFeeds: Array<{ nome: string; url: string; topico: string }> | undefined;

    if (empresaId) {
      const key = cacheKey("noticias", empresaId, nicho);
      const cached = noticiasCache.get<NoticiaItem[]>(key);
      if (cached) {
        return NextResponse.json({ noticias: cached, source: "cache" });
      }

      try {
        const supabase = await createClient();
        const { data: empresa } = await supabase
          .from("empresas")
          .select("config_rss")
          .eq("id", empresaId)
          .single();

        if (empresa?.config_rss && Array.isArray(empresa.config_rss)) {
          const activeFeeds = empresa.config_rss
            .filter((f: { ativo?: boolean }) => f.ativo !== false)
            .map((f: { nome: string; url: string; topico: string }) => ({
              nome: f.nome,
              url: f.url,
              topico: f.topico,
            }));

          if (activeFeeds.length > 0) {
            customFeeds = activeFeeds;
          }
        }
      } catch {
        // Supabase nao configurado ou erro de conexao — segue com feeds padrao
      }
    }

    const noticias = await getNoticiasForNicho(nicho, customFeeds);

    // Salvar no cache
    if (empresaId) {
      const key = cacheKey("noticias", empresaId, nicho);
      noticiasCache.set(key, noticias);
    }

    return NextResponse.json({ noticias, source: "fresh" });
  } catch (error) {
    console.error("Erro ao buscar noticias:", error);
    return NextResponse.json(
      { error: "Erro ao buscar noticias. Tente novamente." },
      { status: 500 }
    );
  }
}
