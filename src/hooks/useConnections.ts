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

      // FALLBACK: if the API didn't return instagram but empresa.redes_sociais says connected,
      // inject a synthetic connection so the UI shows IG as connected
      if (!grouped["instagram"] && empresa.redes_sociais?.instagram?.conectado) {
        const ig = empresa.redes_sociais.instagram;
        grouped["instagram"] = [
          {
            id: `legacy-ig-${empresa.id}`,
            empresa_id: empresa.id,
            user_id: "",
            provider: "instagram",
            provider_user_id: ig.provider_user_id ?? `legacy_${empresa.id}`,
            username: ig.username ?? null,
            display_name: ig.username ?? null,
            display_label: ig.username ?? null,
            profile_picture_url: ig.profile_picture_url ?? null,
            access_token: ig.access_token ?? "",
            refresh_token: null,
            token_expires_at: null,
            page_id: null,
            page_access_token: null,
            app_id: null,
            scopes: ["instagram_business_basic"],
            is_active: true,
            last_verified_at: null,
            last_error: null,
            metadata: { migrated_from: "empresa.redes_sociais", fallback: true },
            created_at: empresa.updated_at ?? new Date().toISOString(),
            updated_at: empresa.updated_at ?? new Date().toISOString(),
          },
        ];
      }

      setConnections(grouped as Record<ProviderKey, Connection[]>);
    } catch (err) {
      console.error("[useConnections] fetch error:", err);
      setConnections(EMPTY_CONNECTIONS);
    } finally {
      setLoading(false);
    }
  }, [empresa?.id, empresa?.redes_sociais]);

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
