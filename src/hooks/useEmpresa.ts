"use client";

import { createContext, useContext } from "react";
import { Empresa } from "@/types";

interface EmpresaContextType {
  empresa: Empresa | null;
  empresas: Empresa[];
  loading: boolean;
  setEmpresaId: (id: string) => void;
  createEmpresa: (data: Partial<Empresa>) => Promise<Empresa | null>;
  updateEmpresa: (id: string, data: Partial<Empresa>) => Promise<Empresa | null>;
  deleteEmpresa: (id: string) => Promise<boolean>;
  refreshEmpresas: () => Promise<void>;
}

export const EmpresaContext = createContext<EmpresaContextType>({
  empresa: null,
  empresas: [],
  loading: true,
  setEmpresaId: () => {},
  createEmpresa: async () => null,
  updateEmpresa: async () => null,
  deleteEmpresa: async () => false,
  refreshEmpresas: async () => {},
});

export function useEmpresa() {
  return useContext(EmpresaContext);
}
