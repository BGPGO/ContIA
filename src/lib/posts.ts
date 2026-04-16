import { SupabaseClient } from "@supabase/supabase-js";
import { Post, PostApproval } from "@/types";

// ── Resultado de submit-approval ──
export interface PostApprovalResult {
  post: Post;
  approval: PostApproval;
}

/**
 * Envia um post para o fluxo de aprovação.
 * Encapsula o fetch para POST /api/posts/[postId]/submit-approval.
 */
export async function submitPostForApproval(
  postId: string,
  comment?: string
): Promise<PostApprovalResult> {
  const res = await fetch(`/api/posts/${postId}/submit-approval`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ comment }),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(
      (json as { error?: string }).error ?? `Erro ${res.status} ao enviar para aprovação`
    );
  }

  return res.json() as Promise<PostApprovalResult>;
}

type PostInsert = Omit<Post, "id" | "created_at" | "metricas">;
type PostUpdate = Partial<Omit<Post, "id" | "created_at">>;

export async function listPosts(supabase: SupabaseClient, empresaId: string): Promise<Post[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Post[];
}

export async function createPost(supabase: SupabaseClient, data: PostInsert): Promise<Post> {
  const { data: post, error } = await supabase
    .from("posts")
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return post as Post;
}

export async function updatePost(supabase: SupabaseClient, id: string, data: PostUpdate): Promise<Post> {
  const { data: post, error } = await supabase
    .from("posts")
    .update(data)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return post as Post;
}

export async function deletePost(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) throw error;
}
