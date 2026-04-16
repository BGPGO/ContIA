"use client";

import { useState, useCallback, useEffect } from "react";
import type { Connection, ProviderKey } from "@/types/providers";
import { useEmpresa } from "./useEmpresa";

interface UseConnectionsReturn {
  connections: Record<ProviderKey, Connection[]>;
  loading: boolean;
  isConnected: (provider: ProviderKey) => boolean;
  getConnections: (provider: ProviderKey) => Connection[];
  refresh: () => void;
}

const EMPTY_CONNECTIONS = {} as Record<ProviderKey, Connection[]>;

export function useConnections(): UseConnectionsReturn {
  const { empresa } = useEmpresa();
  const [connections, setConnections] =
    useState<Record<ProviderKey, Connection[]>>(EMPTY_CONNECTIONS);
  const [loading, setLoading] = useState(true);

  const fetchConnections = useCallback(async () => {
    if (!empresa?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/connections/list?empresa_id=${empresa.id}`);
      if (!res.ok) throw new Error("Failed to fetch connections");

      const data = (await res.json()) as { connections: Connection[] };
      const grouped: Record<string, Connection[]> = {};

      for (const conn of data.connections) {
        if (!grouped[conn.provider]) grouped[conn.provider] = [];
        grouped[conn.provider].push(conn);
      }

      setConnections(grouped as Record<ProviderKey, Connection[]>);
    } catch (err) {
      console.error("[useConnections] fetch error:", err);
      setConnections(EMPTY_CONNECTIONS);
    } finally {
      setLoading(false);
    }
  }, [empresa?.id]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const isConnected = useCallback(
    (provider: ProviderKey): boolean =>
      (connections[provider] ?? []).length > 0,
    [connections]
  );

  const getConnections = useCallback(
    (provider: ProviderKey): Connection[] => connections[provider] ?? [],
    [connections]
  );

  return {
    connections,
    loading,
    isConnected,
    getConnections,
    refresh: fetchConnections,
  };
}
