"use client";

import { useState, useEffect, useCallback } from "react";
import { Post, PostApproval } from "@/types";
import { useEmpresa } from "@/hooks/useEmpresa";

export interface ApprovalItem {
  post: Post;
  approval: PostApproval;
}

interface UseApprovalsReturn {
  items: ApprovalItem[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  approve: (approvalId: string, comment?: string) => Promise<void>;
  reject: (approvalId: string, comment: string) => Promise<void>;
}

export function useApprovals(): UseApprovalsReturn {
  const { empresa } = useEmpresa();
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    if (!empresa?.id) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `/api/post-approvals/pending?empresaId=${empresa.id}`
      );

      if (!res.ok) {
        throw new Error(`Erro ao buscar aprovacoes: ${res.status}`);
      }

      const data = await res.json();
      setItems(data.items ?? []);
    } catch (err) {
      console.error("useApprovals fetchPending:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao carregar aprovacoes pendentes."
      );
    } finally {
      setLoading(false);
    }
  }, [empresa?.id]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const approve = useCallback(
    async (approvalId: string, comment?: string) => {
      const res = await fetch(
        `/api/post-approvals/${approvalId}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comment: comment ?? "" }),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Erro ao aprovar: ${res.status}`);
      }

      await fetchPending();
    },
    [fetchPending]
  );

  const reject = useCallback(
    async (approvalId: string, comment: string) => {
      const res = await fetch(
        `/api/post-approvals/${approvalId}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comment }),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Erro ao rejeitar: ${res.status}`);
      }

      await fetchPending();
    },
    [fetchPending]
  );

  return { items, loading, error, refetch: fetchPending, approve, reject };
}
