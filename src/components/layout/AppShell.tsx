"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import EmpresaProvider from "@/components/layout/EmpresaProvider";
import { Sidebar } from "@/components/layout/Sidebar";
import { EmpresaWizard } from "@/components/empresas/EmpresaWizard";
import { useEmpresa } from "@/hooks/useEmpresa";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Empresa } from "@/types";

const AUTH_ROUTES = ["/login", "/register", "/auth"];

/* ─────────────────────────────────────────────────────────────
   AppContent — lives INSIDE EmpresaProvider so it can read context
───────────────────────────────────────────────────────────── */
function AppContent({ children }: { children: React.ReactNode }) {
  const { empresas, loading } = useEmpresa();
  const supabaseConfigured = isSupabaseConfigured();

  // Show wizard automatically when Supabase is configured but user has no empresas
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardTriggered, setWizardTriggered] = useState(false);

  useEffect(() => {
    if (!loading && supabaseConfigured && empresas.length === 0 && !wizardTriggered) {
      setWizardTriggered(true);
      setWizardOpen(true);
    }
  }, [loading, supabaseConfigured, empresas.length, wizardTriggered]);

  const handleWizardCreated = (_empresa: Empresa) => {
    setWizardOpen(false);
  };

  return (
    <>
      <div className="flex min-h-screen bg-bg-primary">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-bg-primary">
          <div className="mx-auto max-w-[1400px] px-6 py-6 md:px-8 md:py-8 page-enter">
            {children}
          </div>
        </main>
      </div>

      {/* Auto-open wizard for new users with no empresas */}
      <EmpresaWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={handleWizardCreated}
      />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   AppShell — root layout wrapper
───────────────────────────────────────────────────────────── */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_ROUTES.some((r) => pathname.startsWith(r));

  if (isAuthPage) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
        {children}
      </div>
    );
  }

  return (
    <EmpresaProvider>
      <AppContent>{children}</AppContent>
    </EmpresaProvider>
  );
}
