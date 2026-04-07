"use client";

import { useState, useCallback } from "react";
import { useEmpresa } from "./useEmpresa";

interface IGProfileData {
  username: string;
  name: string;
  followers_count: number;
  media_count: number;
  profile_picture_url: string;
}

interface UseInstagramReturn {
  /** Status da conexão */
  connected: boolean;
  /** Perfil do Instagram (após verificar) */
  profile: IGProfileData | null;
  /** Carregando alguma operação */
  loading: boolean;
  /** Último erro */
  error: string | null;
  /** Inicia o fluxo OAuth — redireciona para Facebook Login */
  connect: () => void;
  /** Verifica se a conexão ainda é válida */
  verify: () => Promise<boolean>;
  /** Verifica com credenciais manuais (token + ig_user_id) */
  verifyManual: (accessToken: string, igUserId: string) => Promise<boolean>;
  /** Desconecta o Instagram */
  disconnect: () => Promise<void>;
}

export function useInstagram(): UseInstagramReturn {
  const { empresa } = useEmpresa();
  const [profile, setProfile] = useState<IGProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connected = empresa?.redes_sociais?.instagram?.conectado ?? false;

  const connect = useCallback(() => {
    if (!empresa) return;
    // Redireciona para o endpoint OAuth
    window.location.href = `/api/instagram/auth?empresa_id=${empresa.id}`;
  }, [empresa]);

  const verify = useCallback(async (): Promise<boolean> => {
    if (!empresa) return false;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/instagram/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresa_id: empresa.id }),
      });

      const data = await res.json();

      if (data.valid) {
        setProfile(data.profile);
        return true;
      } else {
        setError(data.error);
        return false;
      }
    } catch {
      setError("Erro ao verificar conexão");
      return false;
    } finally {
      setLoading(false);
    }
  }, [empresa]);

  const verifyManual = useCallback(
    async (accessToken: string, igUserId: string): Promise<boolean> => {
      if (!empresa) return false;
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/instagram/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            empresa_id: empresa.id,
            access_token: accessToken,
            ig_user_id: igUserId,
          }),
        });

        const data = await res.json();

        if (data.valid) {
          setProfile(data.profile);
          return true;
        } else {
          setError(data.error);
          return false;
        }
      } catch {
        setError("Erro ao verificar credenciais");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [empresa]
  );

  const disconnect = useCallback(async () => {
    if (!empresa) return;
    setLoading(true);

    try {
      await fetch("/api/instagram/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresa_id: empresa.id }),
      });

      setProfile(null);
      setError(null);
    } catch {
      setError("Erro ao desconectar");
    } finally {
      setLoading(false);
    }
  }, [empresa]);

  return { connected, profile, loading, error, connect, verify, verifyManual, disconnect };
}
