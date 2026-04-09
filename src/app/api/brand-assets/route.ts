export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BUCKET_NAME = "brand-assets";
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

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

    // Ensure bucket exists
    try {
      await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: MAX_FILE_SIZE,
      });
    } catch {
      // Bucket may already exist — that's fine
    }

    // Upload to Supabase Storage
    const ext = file.name.split(".").pop() || "bin";
    const storagePath = `${empresaId}/${type}/${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[BrandAssets] Upload error:", uploadError);
      return NextResponse.json({ error: "Falha no upload: " + uploadError.message }, { status: 500 });
    }

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
        mime_type: file.type,
        metadata: {},
        tags,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[BrandAssets] Insert error:", insertError);
      // Try to clean up uploaded file
      await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(asset, { status: 201 });
  } catch (err) {
    console.error("[BrandAssets] POST exception:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
