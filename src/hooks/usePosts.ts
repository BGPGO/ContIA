"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Post } from "@/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";
import { postsMock } from "@/lib/mock-data";
import * as postsApi from "@/lib/posts";

export function usePosts(empresaId: string | undefined) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const configured = useMemo(() => isSupabaseConfigured(), []);

  const fetchPosts = useCallback(async () => {
    if (!empresaId) return;

    if (!configured) {
      setPosts(postsMock.filter((p) => p.empresa_id === empresaId));
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const supabase = createClient();
      const data = await postsApi.listPosts(supabase, empresaId);
      setPosts(data);
    } catch (err) {
      console.error("Failed to load posts:", err);
      setPosts(postsMock.filter((p) => p.empresa_id === empresaId));
    } finally {
      setLoading(false);
    }
  }, [empresaId, configured]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const createPost = useCallback(
    async (data: Omit<Post, "id" | "created_at" | "metricas">): Promise<Post | null> => {
      if (!configured) return null;
      try {
        const supabase = createClient();
        const post = await postsApi.createPost(supabase, data);
        setPosts((prev) => [post, ...prev]);
        return post;
      } catch (err) {
        console.error("Failed to create post:", err);
        return null;
      }
    },
    [configured]
  );

  const updatePost = useCallback(
    async (id: string, data: Partial<Post>): Promise<Post | null> => {
      if (!configured) return null;
      try {
        const supabase = createClient();
        const post = await postsApi.updatePost(supabase, id, data);
        setPosts((prev) => prev.map((p) => (p.id === id ? post : p)));
        return post;
      } catch (err) {
        console.error("Failed to update post:", err);
        return null;
      }
    },
    [configured]
  );

  const deletePost = useCallback(
    async (id: string): Promise<boolean> => {
      if (!configured) return false;
      try {
        const supabase = createClient();
        await postsApi.deletePost(supabase, id);
        setPosts((prev) => prev.filter((p) => p.id !== id));
        return true;
      } catch (err) {
        console.error("Failed to delete post:", err);
        return false;
      }
    },
    [configured]
  );

  const cancelPostSchedule = useCallback(async (postId: string): Promise<void> => {
    if (!empresaId) throw new Error("Empresa não selecionada");

    // 1. Buscar o jobId do agendamento
    const statusRes = await fetch(`/api/posts/schedule/status?postId=${encodeURIComponent(postId)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!statusRes.ok) {
      const errData = await statusRes.json().catch(() => ({})) as { error?: string };
      throw new Error(errData.error || "Falha ao buscar agendamento");
    }

    const statusData = await statusRes.json() as { schedule?: { jobId?: string } | null };
    const jobId = statusData.schedule?.jobId;

    if (!jobId) {
      throw new Error("Este post não tem agendamento ativo");
    }

    // 2. Cancelar via DELETE
    const cancelRes = await fetch("/api/posts/schedule", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    });

    if (!cancelRes.ok) {
      const errData = await cancelRes.json().catch(() => ({})) as { error?: string };
      throw new Error(errData.error || "Falha ao cancelar agendamento");
    }

    // 3. Refresh da lista de posts pra refletir mudança de status
    await fetchPosts();
  }, [empresaId, fetchPosts]);

  return { posts, loading, createPost, updatePost, deletePost, cancelPostSchedule, refreshPosts: fetchPosts };
}
