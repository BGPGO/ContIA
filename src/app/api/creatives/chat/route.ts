import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getAnthropicClient, resolveModel } from "@/lib/ai/anthropic";
import {
  buildSystem,
  type EmpresaDna,
  type BrandKit,
  type CustomFont,
  type CustomLogo,
} from "@/lib/creatives/system-prompt";
import {
  truncateHistory,
  splitProseAndHtml,
  type RawMessage,
} from "@/lib/creatives/history";

export const runtime = "nodejs";
export const maxDuration = 120;

interface ChatBody {
  messages: RawMessage[];
  empresaId: string;
  conversationId?: string | null;
  model?: "sonnet" | "opus";
  useBrandKit?: boolean;
}

// ── SSE encoder helper ──────────────────────────────────────────────────────

function sseEncode(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ── DNA loader (inline, não modifica lib/creatives/) ────────────────────────

async function loadEmpresaDna(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string
): Promise<EmpresaDna | null> {
  // Busca nome da empresa
  const { data: empresa } = await supabase
    .from("empresas")
    .select("nome, nicho")
    .eq("id", empresaId)
    .single();

  // Busca DNA sintetizado
  const { data: marcaDnaRow } = await supabase
    .from("marca_dna")
    .select("dna_sintetizado")
    .eq("empresa_id", empresaId)
    .single();

  const dnaJson =
    marcaDnaRow?.dna_sintetizado as Record<string, unknown> | null | undefined;

  if (!empresa && !dnaJson) return null;

  // Normaliza campos do JSONB — suporta variações de nomenclatura
  let brandColors: string[] | null = null;
  if (dnaJson) {
    const rawColors =
      dnaJson["cores"] ??
      dnaJson["brand_colors"] ??
      dnaJson["brandColors"] ??
      dnaJson["paleta"];
    if (Array.isArray(rawColors)) {
      brandColors = rawColors as string[];
    } else if (typeof rawColors === "string" && rawColors.trim()) {
      brandColors = [rawColors];
    }
  }

  const tom =
    (dnaJson?.["tom"] as string | undefined) ??
    (dnaJson?.["tom_voz"] as string | undefined) ??
    (dnaJson?.["tom_de_voz"] as string | undefined) ??
    null;

  const nicho =
    (dnaJson?.["nicho"] as string | undefined) ??
    (empresa?.nicho as string | undefined) ??
    null;

  const nome = empresa?.nome ?? null;

  return { nome, brandColors, tom, nicho };
}

// ── BrandKit loader (cores + fontes + logo + brand_assets) ──────────────────

async function loadBrandKit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string
): Promise<BrandKit | null> {
  const { data, error } = await supabase
    .from("empresas")
    .select(
      "nome, cor_primaria, cor_secundaria, brand_colors, brand_fonts, logo_url"
    )
    .eq("id", empresaId)
    .single();

  if (error || !data) return null;

  const row = data as {
    nome?: string | null;
    cor_primaria?: string | null;
    cor_secundaria?: string | null;
    brand_colors?: string[] | null;
    brand_fonts?: string[] | null;
    logo_url?: string | null;
  };

  // Busca assets customizados (fontes e logos da tabela brand_assets)
  const { data: assets } = await supabase
    .from("brand_assets")
    .select("id, name, type, file_url, file_name, mime_type")
    .eq("empresa_id", empresaId)
    .in("type", ["font", "logo"]);

  const customFonts: CustomFont[] = (assets ?? [])
    .filter((a: { type: string }) => a.type === "font")
    .map((a: { name: string | null; file_url: string; file_name: string | null }) => {
      const ext =
        (a.file_name ?? "").toLowerCase().match(/\.(ttf|otf|woff2|woff)$/)?.[1] ?? "";
      const format =
        ext === "ttf" ? "truetype" :
        ext === "otf" ? "opentype" :
        ext === "woff2" ? "woff2" :
        ext === "woff" ? "woff" : "truetype";
      const name =
        a.name && a.name !== "Sem nome"
          ? a.name
          : (a.file_name ?? "").replace(/\.\w+$/, "");
      return { name: name.trim(), url: a.file_url, format };
    })
    .filter((f: CustomFont) => f.name && f.url);

  const customLogos: CustomLogo[] = (assets ?? [])
    .filter((a: { type: string }) => a.type === "logo")
    .map((a: { name: string | null; file_url: string }) => ({
      name: a.name && a.name !== "Sem nome" ? a.name : "Logo",
      url: a.file_url,
    }))
    .filter((l: CustomLogo) => l.url);

  const hasAny =
    !!row.cor_primaria ||
    !!row.cor_secundaria ||
    (row.brand_colors && row.brand_colors.length > 0) ||
    (row.brand_fonts && row.brand_fonts.length > 0) ||
    !!row.logo_url ||
    customFonts.length > 0 ||
    customLogos.length > 0;

  if (!hasAny) return null;

  return {
    nome: row.nome ?? null,
    primaryColor: row.cor_primaria ?? null,
    secondaryColor: row.cor_secundaria ?? null,
    brandColors: row.brand_colors ?? null,
    brandFonts: row.brand_fonts ?? null,
    logoUrl: row.logo_url ?? null,
    customFonts: customFonts.length > 0 ? customFonts : undefined,
    customLogos: customLogos.length > 0 ? customLogos : undefined,
  };
}

// ── @font-face injector ──────────────────────────────────────────────────────

function injectFontFaces(html: string, fonts: CustomFont[]): string {
  if (!fonts || fonts.length === 0) return html;
  const faces = fonts
    .map(
      (f) =>
        `@font-face{font-family:'${f.name.replace(/'/g, "")}';src:url('${f.url}') format('${f.format}');font-display:swap;}`
    )
    .join("\n");
  const styleBlock = `<style data-brand-fonts="true">\n${faces}\n</style>`;

  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${styleBlock}\n</head>`);
  }
  // Sem </head>: inserir logo após <body> de abertura
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/(<body[^>]*>)/i, `$1\n${styleBlock}`);
  }
  // Sem <body> tampouco: preceder o HTML inteiro
  return `${styleBlock}\n${html}`;
}

// ── Main route handler ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── 1. Parse body ──
  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return NextResponse.json(
      { error: "Body inválido." },
      { status: 400 }
    );
  }

  const { messages, empresaId, conversationId, model, useBrandKit } = body;

  if (!empresaId || !Array.isArray(messages)) {
    return NextResponse.json(
      { error: "Campos obrigatórios faltando" },
      { status: 400 }
    );
  }

  // ── 2. Auth + RBAC ──
  const supabase = await createClient();
  const authz = await requireRole(supabase, empresaId, "post.create");
  if (!authz.ok) return authz.response;

  // ── 3. Rate limit ──
  const ip = getClientIp(req);
  const allowed = checkRateLimit(ip, "generate");
  if (!allowed) {
    return NextResponse.json(
      { error: "Limite atingido, tente em alguns segundos." },
      { status: 429 }
    );
  }

  // ── 4. DNA da marca ──
  let dna: EmpresaDna | null = null;
  try {
    dna = await loadEmpresaDna(supabase, empresaId);
  } catch (err) {
    console.warn("[creatives/chat] DNA load error:", (err as Error).message);
  }

  // ── 4b. Brand Kit (fontes/cores/logo) — só se usuário pediu ──
  let brandKit: BrandKit | null = null;
  if (useBrandKit) {
    try {
      brandKit = await loadBrandKit(supabase, empresaId);
    } catch (err) {
      console.warn(
        "[creatives/chat] BrandKit load error:",
        (err as Error).message
      );
    }
  }

  // ── 5. Resolve or create conversation ──
  let activeConversationId = conversationId ?? null;

  if (!activeConversationId) {
    const lastUserMsg =
      [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const title = lastUserMsg.slice(0, 60) || "Novo criativo";

    const { data: newConv, error: convErr } = await supabase
      .from("creative_conversations")
      .insert({
        empresa_id: empresaId,
        user_id: authz.user.id,
        title,
      })
      .select("id")
      .single();

    if (convErr || !newConv) {
      console.error(
        "[creatives/chat] Failed to create conversation:",
        convErr?.message
      );
      return NextResponse.json(
        { error: "Falha ao criar conversa." },
        { status: 500 }
      );
    }

    activeConversationId = newConv.id as string;
  }

  // ── 6. Save user message ──
  const lastUserMessage =
    [...messages].reverse().find((m) => m.role === "user") ?? null;

  if (lastUserMessage) {
    const { error: msgErr } = await supabase
      .from("creative_messages")
      .insert({
        conversation_id: activeConversationId,
        role: "user",
        content: lastUserMessage.content,
      });

    if (msgErr) {
      console.error(
        "[creatives/chat] Failed to save user message:",
        msgErr.message
      );
    }
  }

  // ── 7. Stream from Anthropic ──
  const anthropic = getAnthropicClient();
  const resolvedModel = resolveModel(model);

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      let buffer = "";

      try {
        const stream = anthropic.messages.stream({
          model: resolvedModel,
          max_tokens: 8000,
          system: buildSystem({ dna, brandKit }),
          messages: truncateHistory(messages),
        });

        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            const delta = chunk.delta.text;
            buffer += delta;
            controller.enqueue(
              encoder.encode(sseEncode("text", { content: delta }))
            );
          }
        }

        // Await final message for accurate usage
        const finalMsg = await stream.finalMessage();
        const usage = finalMsg.usage;

        // Split prose and HTML from complete buffer
        const { prose, html } = splitProseAndHtml(buffer);

        // Inject @font-face declarations for custom brand fonts (only when useBrandKit=true)
        let finalHtml = html;
        if (html && brandKit?.customFonts && brandKit.customFonts.length > 0) {
          finalHtml = injectFontFaces(html, brandKit.customFonts);
        }

        // Emit HTML event
        if (finalHtml) {
          controller.enqueue(
            encoder.encode(sseEncode("html", { html: finalHtml }))
          );
        }

        // Save assistant message
        let savedMessageId: string | null = null;
        try {
          const { data: assistantMsg, error: assistantErr } = await supabase
            .from("creative_messages")
            .insert({
              conversation_id: activeConversationId,
              role: "assistant",
              content: prose,
              html: finalHtml || null,
              model: resolvedModel,
              tokens_in: usage.input_tokens,
              tokens_out: usage.output_tokens,
            })
            .select("id")
            .single();

          if (assistantErr) {
            console.error(
              "[creatives/chat] Failed to save assistant message:",
              assistantErr.message
            );
          } else {
            savedMessageId = (assistantMsg?.id as string) ?? null;
          }
        } catch (saveErr) {
          console.error(
            "[creatives/chat] Exception saving assistant message:",
            (saveErr as Error).message
          );
        }

        // Update conversation.updated_at
        try {
          await supabase
            .from("creative_conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", activeConversationId!);
        } catch (updateErr) {
          console.warn(
            "[creatives/chat] Failed to update conversation timestamp:",
            (updateErr as Error).message
          );
        }

        // Emit done event
        controller.enqueue(
          encoder.encode(
            sseEncode("done", {
              messageId: savedMessageId,
              conversationId: activeConversationId,
              usage: {
                input_tokens: usage.input_tokens,
                output_tokens: usage.output_tokens,
                cache_creation_input_tokens:
                  (usage as unknown as Record<string, unknown>)[
                    "cache_creation_input_tokens"
                  ] ?? 0,
                cache_read_input_tokens:
                  (usage as unknown as Record<string, unknown>)[
                    "cache_read_input_tokens"
                  ] ?? 0,
              },
            })
          )
        );

        controller.close();
      } catch (err) {
        console.error("[creatives/chat] Stream error:", err);
        try {
          controller.enqueue(
            encoder.encode(
              sseEncode("error", {
                message:
                  (err as Error).message || "Erro ao processar requisição.",
              })
            )
          );
        } catch {
          // controller may already be closed
        }
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
}
