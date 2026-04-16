import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

// ── GET /api/concorrentes?empresa_id=xxx ─────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const empresaId = searchParams.get("empresa_id");

  if (!empresaId) {
    return NextResponse.json({ error: "empresa_id obrigatorio" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ concorrentes: [] });
  }

  try {
    const supabase = await createClient();

    const { data: concorrentes, error } = await supabase
      .from("concorrentes")
      .select("id, empresa_id, nome, created_at")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching concorrentes:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch plataformas for each concorrente
    const ids = (concorrentes || []).map((c) => c.id);
    let plataformasMap: Record<string, any[]> = {};

    if (ids.length > 0) {
      const { data: plataformas } = await supabase
        .from("concorrente_plataformas")
        .select("*")
        .in("concorrente_id", ids);

      if (plataformas) {
        for (const p of plataformas) {
          if (!plataformasMap[p.concorrente_id]) {
            plataformasMap[p.concorrente_id] = [];
          }
          plataformasMap[p.concorrente_id].push(p);
        }
      }
    }

    const result = (concorrentes || []).map((c) => ({
      ...c,
      plataformas: plataformasMap[c.id] || [],
    }));

    return NextResponse.json({ concorrentes: result });
  } catch (err: any) {
    console.error("Concorrentes GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── POST /api/concorrentes ───────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase nao configurado" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { nome, username_instagram, empresa_id } = body;

    if (!nome || !username_instagram || !empresa_id) {
      return NextResponse.json(
        { error: "nome, username_instagram e empresa_id sao obrigatorios" },
        { status: 400 }
      );
    }

    const cleanUsername = username_instagram.replace(/^@/, "").trim();
    const supabase = await createClient();

    // Insert concorrente
    const { data: concorrente, error: concError } = await supabase
      .from("concorrentes")
      .insert({ nome, empresa_id })
      .select("id, empresa_id, nome, created_at")
      .single();

    if (concError) {
      console.error("Error creating concorrente:", concError);
      return NextResponse.json({ error: concError.message }, { status: 500 });
    }

    // Insert instagram platform
    const { data: plataforma, error: platError } = await supabase
      .from("concorrente_plataformas")
      .insert({
        concorrente_id: concorrente.id,
        rede: "instagram",
        username: cleanUsername,
        seguidores: 0,
        taxa_engajamento: 0,
        freq_postagem: "-",
      })
      .select("*")
      .single();

    if (platError) {
      console.error("Error creating plataforma:", platError);
    }

    return NextResponse.json({
      concorrente: {
        ...concorrente,
        plataformas: plataforma ? [plataforma] : [],
      },
    });
  } catch (err: any) {
    console.error("Concorrentes POST error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── DELETE /api/concorrentes?id=xxx ──────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase nao configurado" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    // cascade deletes plataformas
    const { error } = await supabase.from("concorrentes").delete().eq("id", id);

    if (error) {
      console.error("Error deleting concorrente:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Concorrentes DELETE error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
