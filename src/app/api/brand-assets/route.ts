export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BUCKET_NAME = "brand-assets";
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

/* ── Font validation helpers ── */
const FONT_MIMES = new Set([
  "font/ttf", "font/otf", "font/woff", "font/woff2",
  "application/x-font-ttf", "application/x-font-otf",
  "application/x-font-woff", "application/x-font-woff2",
  "application/font-woff", "application/font-woff2",
  "application/vnd.ms-fontobject",
  "application/octet-stream", // fallback comum
]);

const FONT_EXTENSIONS = /\.(ttf|otf|woff|woff2)$/i;

function isValidFontFile(file: File): boolean {
  const mimeOk = file.type ? FONT_MIMES.has(file.type.toLowerCase()) : false;
  const extOk = FONT_EXTENSIONS.test(file.name);
  return mimeOk || extOk; // aceita se QUALQUER check passar
}

/**
 * Deriva o content-type real do arquivo.
 * Browsers mandam "application/octet-stream" pra fontes frequentemente — o bucket
 * do Supabase rejeita esse MIME. A gente reescreve baseado na extensão.
 */
function resolveContentType(file: File): string {
  const ext = file.name.toLowerCase().split(".").pop() || "";
  const browserType = (file.type || "").toLowerCase();

  // Map por extensão (precedência pra fontes e formatos com MIME quebrado)
  const byExtension: Record<string, string> = {
    ttf: "font/ttf",
    otf: "font/otf",
    woff: "font/woff",
    woff2: "font/woff2",
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
  };

  // Se browser mandou octet-stream ou vazio, usa a extensão
  if (!browserType || browserType === "application/octet-stream") {
    return byExtension[ext] || "application/octet-stream";
  }

  // Se browser mandou algo específico mas é fonte, prefere a extensão
  // (evita "application/font-sfnt" etc que bucket pode rejeitar)
  if (byExtension[ext] && (ext === "ttf" || ext === "otf" || ext === "woff" || ext === "woff2")) {
    return byExtension[ext];
  }

  return browserType;
}

/* ── GET: List brand assets (with optional type filter) ── */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const empresaId = searchParams.get("empresa_id");
    const type = searchParams.get("type");

    if (!empresaId) {
      return NextResponse.json({ error: "empresa_id obrigatorio" }, { status: 400 });
    }

    let query = supabase
      .from("brand_assets")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });

    if (type) {
      query = query.eq("type", type);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[BrandAssets] GET error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error("[BrandAssets] GET exception:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

/* ── POST: Upload new brand asset ── */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const empresaId = formData.get("empresa_id") as string | null;
    const name = (formData.get("name") as string) || "Sem nome";
    const type = (formData.get("type") as string) || "element";
    const tagsRaw = formData.get("tags") as string | null;

    if (!file) {
      return NextResponse.json({ error: "Arquivo obrigatorio" }, { status: 400 });
    }
    if (!empresaId) {
      return NextResponse.json({ error: "empresa_id obrigatorio" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Arquivo muito grande (max 20MB)" }, { status: 400 });
    }

    const validTypes = ["logo", "font", "element", "texture", "photo"];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: `Tipo invalido. Use: ${validTypes.join(", ")}` }, { status: 400 });
    }

    // Validação específica para fontes
    if (type === "font" && !isValidFontFile(file)) {
      return NextResponse.json(
        { error: "Arquivo de fonte inválido. Use .ttf, .otf, .woff ou .woff2." },
        { status: 400 }
      );
    }

    // Upload to Supabase Storage (bucket "brand-assets" must exist — created via Supabase dashboard)
    const ext = file.name.split(".").pop() || "bin";
    const storagePath = `${empresaId}/${type}/${crypto.randomUUID()}.${ext}`;

    const resolvedContentType = resolveContentType(file);
    console.log(`[BrandAssets] Uploading: ${file.name} (${file.size} bytes, browser=${file.type}, resolved=${resolvedContentType}) -> ${storagePath}`);

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: resolvedContentType,
        upsert: false,
      });

    if (uploadError) {
      console.error("[BrandAssets] Upload error:", uploadError);
      const msg = uploadError.message?.includes("not found")
        ? `Bucket "${BUCKET_NAME}" nao existe no Supabase. Crie-o no painel do Supabase Storage.`
        : uploadError.message?.includes("security")
        ? "Erro de permissao no Storage. Verifique as politicas RLS do bucket."
        : `Falha no upload: ${uploadError.message}`;
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    console.log(`[BrandAssets] Upload OK: ${storagePath}`);

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);

    const fileUrl = urlData.publicUrl;

    // Parse tags
    const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [];

    // Insert record
    const { data: asset, error: insertError } = await supabase
      .from("brand_assets")
      .insert({
        empresa_id: empresaId,
        user_id: user.id,
        name,
        type,
        file_url: fileUrl,
        file_name: file.name,
        file_size: file.size,
        mime_type: resolvedContentType,
        metadata: {},
        tags,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[BrandAssets] Insert error:", insertError);
      // Try to clean up uploaded file
      await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
      const msg = insertError.message?.includes("brand_assets")
        ? "Tabela brand_assets nao encontrada. Execute a migration no Supabase."
        : `Falha ao salvar registro: ${insertError.message}`;
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    console.log(`[BrandAssets] Asset created: ${asset.id} (${name}, ${type})`);

    // Side-effects em empresas — não falham o endpoint se derem erro
    let logoUrlUpdated: string | undefined;
    let fontNameAdded: string | undefined;

    if (type === "logo") {
      const { error: logoUpdateError } = await supabase
        .from("empresas")
        .update({ logo_url: fileUrl })
        .eq("id", empresaId);

      if (logoUpdateError) {
        console.warn("[BrandAssets] Aviso: falha ao atualizar logo_url na empresa:", logoUpdateError.message);
      } else {
        logoUrlUpdated = fileUrl;
        console.log(`[BrandAssets] empresas.logo_url atualizado para empresa ${empresaId}`);
      }
    }

    if (type === "font") {
      const { data: empresa, error: empresaFetchError } = await supabase
        .from("empresas")
        .select("brand_fonts")
        .eq("id", empresaId)
        .single();

      if (empresaFetchError) {
        console.warn("[BrandAssets] Aviso: falha ao buscar brand_fonts da empresa:", empresaFetchError.message);
      } else {
        const current = (empresa?.brand_fonts ?? []) as string[];
        const rawFontName = name && name !== "Sem nome"
          ? name
          : file.name.replace(/\.(ttf|otf|woff|woff2)$/i, "");
        const fontName = rawFontName.trim().slice(0, 80);

        if (fontName && !current.includes(fontName)) {
          const { error: fontUpdateError } = await supabase
            .from("empresas")
            .update({ brand_fonts: [...current, fontName] })
            .eq("id", empresaId);

          if (fontUpdateError) {
            console.warn("[BrandAssets] Aviso: falha ao atualizar brand_fonts na empresa:", fontUpdateError.message);
          } else {
            fontNameAdded = fontName;
            console.log(`[BrandAssets] empresas.brand_fonts: fonte "${fontName}" adicionada para empresa ${empresaId}`);
          }
        } else if (fontName && current.includes(fontName)) {
          console.log(`[BrandAssets] empresas.brand_fonts: fonte "${fontName}" já existe, sem alteração`);
        }
      }
    }

    return NextResponse.json(
      {
        asset,
        empresa_updated: {
          logo_url: logoUrlUpdated,
          font_added: fontNameAdded,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[BrandAssets] POST exception:", err);
    const message = (err as Error).message || "Erro interno";
    return NextResponse.json({ error: `Erro no upload: ${message}` }, { status: 500 });
  }
}
