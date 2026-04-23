export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";

const BUCKET = "creatives";
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);
const EXT_MAP: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const empresaId = formData.get("empresaId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 400 });
    }
    if (!empresaId) {
      return NextResponse.json({ error: "empresaId obrigatório" }, { status: 400 });
    }

    const mediaType = (file.type || "").toLowerCase();
    if (!ALLOWED_MIMES.has(mediaType)) {
      return NextResponse.json(
        { error: "Formato inválido. Use PNG, JPG ou WEBP." },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Imagem muito grande (máx 5MB)" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const authz = await requireRole(supabase, empresaId, "post.create");
    if (!authz.ok) return authz.response;

    const ext = EXT_MAP[mediaType] ?? "bin";
    const path = `${empresaId}/attachments/${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: mediaType, upsert: false });

    if (uploadErr) {
      console.error("[creatives/upload] storage error:", uploadErr.message);
      return NextResponse.json(
        { error: `Falha no upload: ${uploadErr.message}` },
        { status: 500 }
      );
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    if (!pub?.publicUrl) {
      return NextResponse.json(
        { error: "Falha ao gerar URL pública" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      url: pub.publicUrl,
      mediaType,
      name: file.name,
    });
  } catch (err) {
    console.error("[creatives/upload] exception:", err);
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: `Falha: ${msg}` }, { status: 500 });
  }
}
