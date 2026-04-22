"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import EmpresaProvider from "@/components/layout/EmpresaProvider";
import { Sidebar } from "@/components/layout/Sidebar";
import { EmpresaWizard } from "@/components/empresas/EmpresaWizard";
import { useEmpresa } from "@/hooks/useEmpresa";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Empresa } from "@/types";

const AUTH_ROUTES = ["/login", "/register", "/auth"];
const PUBLIC_ROUTES = ["/privacidade", "/termos"];

/* ─────────────────────────────────────────────────────────────
   AppContent — lives INSIDE EmpresaProvider so it can read context
───────────────────────────────────────────────────────────── */
function AppContent({ children, pathname }: { children: React.ReactNode; pathname: string }) {
  const { empresas, loading } = useEmpresa();
  const supabaseConfigured = isSupabaseConfigured();
  const isEditorPage = pathname.startsWith("/studio/editor") || pathname.startsWith("/criativos");

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
      <div className="flex h-screen overflow-hidden bg-bg-primary">
        <Sidebar />
        <main className={`flex-1 bg-bg-primary pt-14 md:pt-0 ${isEditorPage ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className={isEditorPage
                ? "h-[calc(100vh-3.5rem)] md:h-screen"
                : "mx-auto max-w-[1400px] px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8"}
            >
              {children}
            </motion.div>
          </AnimatePresence>
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

  const isPublicLegalPage = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));

  if (isAuthPage) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        className="min-h-screen bg-bg-primary flex items-center justify-center p-4"
      >
        {children}
      </motion.div>
    );
  }

  if (isPublicLegalPage) {
    return <>{children}</>;
  }

  return (
    <EmpresaProvider>
      <AppContent pathname={pathname}>{children}</AppContent>
    </EmpresaProvider>
  );
}
