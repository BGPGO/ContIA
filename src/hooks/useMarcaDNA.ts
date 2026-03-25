"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface MarcaDNA {
  id: string;
  empresa_id: string;
  site_analysis: any | null;
  instagram_analysis: any | null;
  dna_sintetizado: {
    tom_de_voz: string;
    pilares_conteudo: string[];
    publico_alvo: string;
    proposta_valor: string;
    palavras_chave: string[];
    estilo_visual: string;
    formatos_preferidos: string[];
    hashtags_marca: string[];
  } | null;
  created_at: string;
  updated_at: string;
}

export function useMarcaDNA(empresaId?: string) {
  const [dna, setDna] = useState<MarcaDNA | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!empresaId || !isSupabaseConfigured()) {
      setDna(null);
      return;
    }

    const fetchDNA = async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("marca_dna")
          .select("*")
          .eq("empresa_id", empresaId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.warn("useMarcaDNA: tabela marca_dna nao encontrada ou erro:", error.message);
          setDna(null);
        } else {
          setDna(data);
        }
      } catch {
        setDna(null);
      } finally {
        setLoading(false);
      }
    };

    fetchDNA();
  }, [empresaId]);

  return { dna, loading };
}
