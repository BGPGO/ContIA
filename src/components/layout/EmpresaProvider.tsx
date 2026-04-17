"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { EmpresaContext } from "@/hooks/useEmpresa";
import { Empresa } from "@/types";
import type { EmpresaRole, RbacAction } from "@/types/rbac";
import { canDoAction } from "@/types/rbac";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";
import { empresasMock } from "@/lib/mock-data";
import * as empresasApi from "@/lib/empresas";

export default function EmpresaProvider({ children }: { children: React.ReactNode }) {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [myRole, setMyRole] = useState<EmpresaRole | null>(null);

  const configured = useMemo(() => isSupabaseConfigured(), []);

  // Load empresas on mount
  useEffect(() => {
    if (!configured) {
      // Mock mode
      setEmpresas(empresasMock);
      setEmpresaId(empresasMock[0]?.id ?? "");
      setLoading(false);
      return;
    }

    // Supabase mode
    const supabase = createClient();
    empresasApi.listEmpresas(supabase)
      .then((data) => {
        setEmpresas(data);
        if (data.length > 0) {
          // Restore last selected from localStorage or pick first
          const saved = localStorage.getItem("contia_empresa_id");
          const found = data.find((e) => e.id === saved);
          setEmpresaId(found ? found.id : data[0].id);
        }
      })
      .catch((err) => {
        console.error("Failed to load empresas:", err);
        // Fallback to mock on error
        setEmpresas(empresasMock);
        setEmpresaId(empresasMock[0]?.id ?? "");
      })
      .finally(() => setLoading(false));
  }, [configured]);

  // Fetch role for current empresa
  const fetchRole = useCallback(async (id: string) => {
    if (!configured || !id) {
      setMyRole(null);
      return;
    }
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("user_empresa_role", {
        p_empresa_id: id,
      });
      if (error || data === null) {
        setMyRole(null);
      } else {
        setMyRole(data as EmpresaRole);
      }
    } catch {
      setMyRole(null);
    }
  }, [configured]);

  // Re-fetch role when empresaId changes
  useEffect(() => {
    if (empresaId) {
      fetchRole(empresaId);
    } else {
      setMyRole(null);
    }
  }, [empresaId, fetchRole]);

  const refreshRole = useCallback(async () => {
    if (empresaId) {
      await fetchRole(empresaId);
    }
  }, [empresaId, fetchRole]);

  const canDo = useCallback((action: RbacAction): boolean => {
    return canDoAction(myRole, action);
  }, [myRole]);

  // Persist selected empresa
  const handleSetEmpresaId = useCallback((id: string) => {
    setEmpresaId(id);
    if (configured) {
      localStorage.setItem("contia_empresa_id", id);
    }
  }, [configured]);

  const empresa = useMemo(
    () => empresas.find((e) => e.id === empresaId) ?? null,
    [empresas, empresaId]
  );

  const refreshEmpresas = useCallback(async () => {
    if (!configured) return;
    const supabase = createClient();
    const data = await empresasApi.listEmpresas(supabase);
    setEmpresas(data);
  }, [configured]);

  const handleCreateEmpresa = useCallback(async (data: Partial<Empresa>): Promise<Empresa | null> => {
    if (!configured) return null;
    try {
      const supabase = createClient();
      const nova = await empresasApi.createEmpresa(supabase, {
        nome: data.nome || "Nova Empresa",
        descricao: data.descricao || "",
        nicho: data.nicho || "",
        logo_url: data.logo_url ?? null,
        website: data.website ?? null,
        cor_primaria: data.cor_primaria || "#6c5ce7",
        cor_secundaria: data.cor_secundaria || "#a29bfe",
        redes_sociais: data.redes_sociais || {},
        config_rss: data.config_rss || [],
      });
      setEmpresas((prev) => [...prev, nova]);
      setEmpresaId(nova.id);
      return nova;
    } catch (err) {
      console.error("Failed to create empresa:", err);
      return null;
    }
  }, [configured]);

  const handleUpdateEmpresa = useCallback(async (id: string, data: Partial<Empresa>): Promise<Empresa | null> => {
    if (!configured) return null;
    try {
      const supabase = createClient();
      const updated = await empresasApi.updateEmpresa(supabase, id, data);
      setEmpresas((prev) => prev.map((e) => (e.id === id ? updated : e)));
      return updated;
    } catch (err) {
      console.error("Failed to update empresa:", err);
      return null;
    }
  }, [configured]);

  const handleDeleteEmpresa = useCallback(async (id: string): Promise<boolean> => {
    if (!configured) return false;
    try {
      const supabase = createClient();
      await empresasApi.deleteEmpresa(supabase, id);
      setEmpresas((prev) => {
        const next = prev.filter((e) => e.id !== id);
        if (empresaId === id && next.length > 0) {
          setEmpresaId(next[0].id);
        }
        return next;
      });
      return true;
    } catch (err) {
      console.error("Failed to delete empresa:", err);
      return false;
    }
  }, [configured, empresaId]);

  return (
    <EmpresaContext.Provider
      value={{
        empresa,
        empresas,
        loading,
        setEmpresaId: handleSetEmpresaId,
        createEmpresa: handleCreateEmpresa,
        updateEmpresa: handleUpdateEmpresa,
        deleteEmpresa: handleDeleteEmpresa,
        refreshEmpresas,
        myRole,
        refreshRole,
        canDo,
      }}
    >
      {children}
    </EmpresaContext.Provider>
  );
}
