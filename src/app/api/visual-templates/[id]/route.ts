import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getVisualTemplate,
  updateVisualTemplate,
  deleteVisualTemplate,
} from "@/lib/visual-templates-db";

// ── GET: Get full template by ID ───────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }

    const template = await getVisualTemplate(supabase, id);
    return NextResponse.json(template);
  } catch (error: unknown) {
    console.error("[visual-templates/id] GET error:", error);
    const msg = (error as Error).message || "";
    if (msg.includes("no rows") || msg.includes("not found")) {
      return NextResponse.json(
        { error: "Template nao encontrado." },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: msg || "Falha ao buscar template." },
      { status: 500 }
    );
  }
}

// ── PATCH: Update template ─────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.canvas_json !== undefined) updates.canvas_json = body.canvas_json;
    if (body.thumbnail_url !== undefined)
      updates.thumbnail_url = body.thumbnail_url;
    if (body.format !== undefined) updates.format = body.format;
    if (body.aspect_ratio !== undefined)
      updates.aspect_ratio = body.aspect_ratio;
    if (body.source !== undefined) updates.source = body.source;
    if (body.source_image_url !== undefined)
      updates.source_image_url = body.source_image_url;
    if (body.ai_prompt !== undefined) updates.ai_prompt = body.ai_prompt;
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.is_public !== undefined) updates.is_public = body.is_public;

    const template = await updateVisualTemplate(supabase, id, updates);
    return NextResponse.json(template);
  } catch (error: unknown) {
    console.error("[visual-templates/id] PATCH error:", error);
    return NextResponse.json(
      {
        error:
          (error as Error).message || "Falha ao atualizar template.",
      },
      { status: 500 }
    );
  }
}

// ── DELETE: Delete template ────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }

    await deleteVisualTemplate(supabase, id);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("[visual-templates/id] DELETE error:", error);
    return NextResponse.json(
      {
        error:
          (error as Error).message || "Falha ao deletar template.",
      },
      { status: 500 }
    );
  }
}
