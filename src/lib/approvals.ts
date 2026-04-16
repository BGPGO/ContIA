import { SupabaseClient } from "@supabase/supabase-js";
import { Post, PostApproval } from "@/types";

// ── Helper: converte linha do DB (snake_case) para PostApproval (camelCase) ──

function toPostApproval(row: Record<string, unknown>): PostApproval {
  return {
    id: row.id as string,
    postId: row.post_id as string,
    empresaId: row.empresa_id as string,
    requestedBy: (row.requested_by as string) ?? null,
    reviewedBy: (row.reviewed_by as string) ?? null,
    status: row.status as PostApproval["status"],
    comment: (row.comment as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ── Helper: converte linha do DB de posts para Post ──────────────────────────

function toPost(row: Record<string, unknown>): Post {
  return {
    id: row.id as string,
    empresa_id: row.empresa_id as string,
    titulo: row.titulo as string,
    conteudo: row.conteudo as string,
    midia_url: (row.midia_url as string) ?? null,
    plataformas: (row.plataformas as string[]) ?? [],
    status: row.status as Post["status"],
    agendado_para: (row.agendado_para as string) ?? null,
    publicado_em: (row.publicado_em as string) ?? null,
    tematica: (row.tematica as string) ?? "",
    metricas: (row.metricas as Post["metricas"]) ?? null,
    created_at: row.created_at as string,
    approval_required: (row.approval_required as boolean) ?? false,
    rejection_reason: (row.rejection_reason as string) ?? null,
  };
}

// ── submitForApproval ─────────────────────────────────────────────────────────
// Muda status do post para 'pendente_aprovacao' e cria um registro em post_approvals.

export async function submitForApproval(
  supabase: SupabaseClient,
  input: { postId: string; empresaId: string; requestedBy: string; comment?: string }
): Promise<{ post: Post; approval: PostApproval }> {
  const { postId, empresaId, requestedBy, comment } = input;

  // Verificar se o post existe e pertence à empresa
  const { data: existingPost } = await supabase
    .from("posts")
    .select("*")
    .eq("id", postId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (!existingPost) {
    throw new Error("Post não encontrado.");
  }

  if (existingPost.status === "pendente_aprovacao") {
    throw new Error("Post já está aguardando aprovação.");
  }

  if (existingPost.status === "publicado") {
    throw new Error("Post já foi publicado e não pode ser enviado para aprovação.");
  }

  // Atualizar post para pendente_aprovacao
  const { data: updatedPostRow, error: postError } = await supabase
    .from("posts")
    .update({
      status: "pendente_aprovacao",
      approval_required: true,
      rejection_reason: null,
    })
    .eq("id", postId)
    .select("*")
    .single();

  if (postError || !updatedPostRow) {
    throw new Error(`Erro ao atualizar post: ${postError?.message ?? "Falha desconhecida"}`);
  }

  // Criar registro em post_approvals
  const { data: approvalRow, error: approvalError } = await supabase
    .from("post_approvals")
    .insert({
      post_id: postId,
      empresa_id: empresaId,
      requested_by: requestedBy,
      status: "pending",
      comment: comment ?? null,
    })
    .select("*")
    .single();

  if (approvalError || !approvalRow) {
    // Rollback: reverter status do post
    await supabase
      .from("posts")
      .update({ status: existingPost.status, approval_required: false })
      .eq("id", postId);
    throw new Error(`Erro ao criar registro de aprovação: ${approvalError?.message ?? "Falha desconhecida"}`);
  }

  return {
    post: toPost(updatedPostRow as Record<string, unknown>),
    approval: toPostApproval(approvalRow as Record<string, unknown>),
  };
}

// ── approvePost ───────────────────────────────────────────────────────────────
// Aprova o post: atualiza approval + volta post para 'rascunho' para agendar depois.

export async function approvePost(
  supabase: SupabaseClient,
  input: {
    postId: string;
    approvalId: string;
    reviewedBy: string;
    comment?: string;
  }
): Promise<{ post: Post; approval: PostApproval }> {
  const { postId, approvalId, reviewedBy, comment } = input;

  // Buscar o approval e verificar que está pending
  const { data: existingApproval } = await supabase
    .from("post_approvals")
    .select("*")
    .eq("id", approvalId)
    .eq("post_id", postId)
    .maybeSingle();

  if (!existingApproval) {
    throw new Error("Aprovação não encontrada.");
  }

  if (existingApproval.status !== "pending") {
    throw new Error("Aprovação já foi processada.");
  }

  const now = new Date().toISOString();

  // Atualizar approval
  const { data: approvalRow, error: approvalError } = await supabase
    .from("post_approvals")
    .update({
      status: "approved",
      reviewed_by: reviewedBy,
      comment: comment ?? null,
      updated_at: now,
    })
    .eq("id", approvalId)
    .select("*")
    .single();

  if (approvalError || !approvalRow) {
    throw new Error(`Erro ao aprovar: ${approvalError?.message ?? "Falha desconhecida"}`);
  }

  // Voltar post para rascunho (pode ser agendado pelo usuário depois)
  const { data: postRow, error: postError } = await supabase
    .from("posts")
    .update({
      status: "rascunho",
      rejection_reason: null,
    })
    .eq("id", postId)
    .select("*")
    .single();

  if (postError || !postRow) {
    throw new Error(`Erro ao atualizar post após aprovação: ${postError?.message ?? "Falha desconhecida"}`);
  }

  return {
    post: toPost(postRow as Record<string, unknown>),
    approval: toPostApproval(approvalRow as Record<string, unknown>),
  };
}

// ── rejectPost ────────────────────────────────────────────────────────────────
// Rejeita o post: atualiza approval + muda status do post para 'rejeitado'.

export async function rejectPost(
  supabase: SupabaseClient,
  input: {
    postId: string;
    approvalId: string;
    reviewedBy: string;
    comment: string;
  }
): Promise<{ post: Post; approval: PostApproval }> {
  const { postId, approvalId, reviewedBy, comment } = input;

  // Buscar o approval e verificar que está pending
  const { data: existingApproval } = await supabase
    .from("post_approvals")
    .select("*")
    .eq("id", approvalId)
    .eq("post_id", postId)
    .maybeSingle();

  if (!existingApproval) {
    throw new Error("Aprovação não encontrada.");
  }

  if (existingApproval.status !== "pending") {
    throw new Error("Aprovação já foi processada.");
  }

  const now = new Date().toISOString();

  // Atualizar approval
  const { data: approvalRow, error: approvalError } = await supabase
    .from("post_approvals")
    .update({
      status: "rejected",
      reviewed_by: reviewedBy,
      comment,
      updated_at: now,
    })
    .eq("id", approvalId)
    .select("*")
    .single();

  if (approvalError || !approvalRow) {
    throw new Error(`Erro ao rejeitar: ${approvalError?.message ?? "Falha desconhecida"}`);
  }

  // Marcar post como rejeitado com o motivo
  const { data: postRow, error: postError } = await supabase
    .from("posts")
    .update({
      status: "rejeitado",
      rejection_reason: comment,
    })
    .eq("id", postId)
    .select("*")
    .single();

  if (postError || !postRow) {
    throw new Error(`Erro ao atualizar post após rejeição: ${postError?.message ?? "Falha desconhecida"}`);
  }

  return {
    post: toPost(postRow as Record<string, unknown>),
    approval: toPostApproval(approvalRow as Record<string, unknown>),
  };
}

// ── listPendingApprovals ──────────────────────────────────────────────────────
// Lista todos os approvals com status 'pending' de uma empresa.

export async function listPendingApprovals(
  supabase: SupabaseClient,
  input: { empresaId: string }
): Promise<Array<{ post: Post; approval: PostApproval }>> {
  const { empresaId } = input;

  // JOIN manual: buscar approvals pending + post
  const { data: approvals, error } = await supabase
    .from("post_approvals")
    .select(
      `
      *,
      posts (*)
    `
    )
    .eq("empresa_id", empresaId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Erro ao listar aprovações pendentes: ${error.message}`);
  }

  if (!approvals || approvals.length === 0) {
    return [];
  }

  return approvals
    .filter((row) => row.posts !== null)
    .map((row) => {
      const { posts, ...approvalFields } = row as Record<string, unknown> & {
        posts: Record<string, unknown>;
      };
      return {
        post: toPost(posts),
        approval: toPostApproval(approvalFields),
      };
    });
}
