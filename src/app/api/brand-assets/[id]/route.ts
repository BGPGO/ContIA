export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BUCKET_NAME = "brand-assets";

/* ── GET: Single asset ── */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("brand_assets")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Asset nao encontrado" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[BrandAssets] GET single error:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

/* ── DELETE: Remove asset (DB + Storage) ── */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    // Get asset to find storage path
    const { data: asset, error: fetchError } = await supabase
      .from("brand_assets")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !asset) {
      return NextResponse.json({ error: "Asset nao encontrado" }, { status: 404 });
    }

    // Extract storage path from URL
    const url = asset.file_url as string;
    const bucketPath = url.split(`/${BUCKET_NAME}/`)[1];

    // Delete from storage
    if (bucketPath) {
      await supabase.storage.from(BUCKET_NAME).remove([bucketPath]);
    }

    // Delete record
    const { error: deleteError } = await supabase
      .from("brand_assets")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("[BrandAssets] Delete error:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[BrandAssets] DELETE exception:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
