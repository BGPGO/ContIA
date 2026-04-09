import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  listVisualTemplates,
  createVisualTemplate,
} from "@/lib/visual-templates-db";

// ── GET: List visual templates for empresa ─────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const empresaId = request.nextUrl.searchParams.get("empresa_id");
    if (!empresaId) {
      return NextResponse.json(
        { error: "Query param 'empresa_id' e obrigatorio." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify user has access
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }

    // Optional filters
    const format = request.nextUrl.searchParams.get("format");
    const aspectRatio = request.nextUrl.searchParams.get("aspect_ratio");

    let templates = await listVisualTemplates(supabase, empresaId);

    // Apply filters in memory (lightweight summaries)
    if (format) {
      templates = templates.filter((t) => t.format === format);
    }
    if (aspectRatio) {
      templates = templates.filter((t) => t.aspect_ratio === aspectRatio);
    }

    return NextResponse.json(templates);
  } catch (error: unknown) {
    console.error("[visual-templates] GET error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Falha ao listar templates." },
      { status: 500 }
    );
  }
}

// ── POST: Create new visual template ───────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      empresa_id,
      name,
      description,
      canvas_json,
      thumbnail_url,
      format,
      aspect_ratio,
      source,
      source_image_url,
      ai_prompt,
      tags,
      is_public,
    } = body as {
      empresa_id?: string;
      name?: string;
      description?: string;
      canvas_json?: object;
      thumbnail_url?: string | null;
      format?: string;
      aspect_ratio?: string;
      source?: string;
      source_image_url?: string | null;
      ai_prompt?: string | null;
      tags?: string[];
      is_public?: boolean;
    };

    if (!empresa_id) {
      return NextResponse.json(
        { error: "Campo 'empresa_id' e obrigatorio." },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: "Campo 'name' e obrigatorio." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }

    const template = await createVisualTemplate(supabase, {
      empresa_id,
      user_id: user.id,
      name,
      description: description || "",
      canvas_json: canvas_json || {},
      thumbnail_url: thumbnail_url || null,
      format: (format as "post" | "carousel" | "story") || "post",
      aspect_ratio: (aspect_ratio as "1:1" | "4:5" | "9:16") || "1:1",
      source: (source as "manual" | "ai_chat" | "image_extraction" | "psd" | "import" | "preset") || "manual",
      source_image_url: source_image_url || null,
      ai_prompt: ai_prompt || null,
      tags: tags || [],
      is_public: is_public ?? false,
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error: unknown) {
    console.error("[visual-templates] POST error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Falha ao criar template." },
      { status: 500 }
    );
  }
}
