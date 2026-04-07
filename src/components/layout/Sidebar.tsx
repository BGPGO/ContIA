"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutDashboard,
  Sparkles,
  BarChart3,
  CalendarDays,
  Users,
  Newspaper,
  Brain,
  Cable,
  Settings,
  ChevronDown,
  Check,
  LogOut,
  Plus,
  Menu,
  X,
} from "lucide-react";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useUser } from "@/hooks/useUser";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { EmpresaWizard } from "@/components/empresas/EmpresaWizard";
import type { Empresa } from "@/types";

const navLinks = [
  { label: "Gestor de Redes", href: "/dashboard", icon: LayoutDashboard },
  { label: "Criacao", href: "/criacao", icon: Sparkles },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Calendario", href: "/calendario", icon: CalendarDays },
  { label: "Concorrentes", href: "/concorrentes", icon: Users },
  { label: "Noticias", href: "/noticias", icon: Newspaper },
  { label: "Relatorio", href: "/relatorio", icon: Brain, needsDNA: true },
  { label: "Conexoes", href: "/conexoes", icon: Cable },
  { label: "Configuracoes", href: "/configuracoes", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { empresa, empresas, setEmpresaId } = useEmpresa();
  const { user, signOut } = useUser();
  const supabaseConfigured = isSupabaseConfigured();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check if DNA sources are missing
  const dnaMissingSources = empresa
    ? !empresa.instagram_handle && !empresa.website && (!empresa.concorrentes_ig || empresa.concorrentes_ig.length === 0)
    : false;

  const handleWizardCreated = (empresa: Empresa) => {
    setShowWizard(false);
  };

  const closeMobile = useCallback(() => {
    setMobileOpen(false);
  }, []);

  // Close mobile drawer on navigation
  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [mobileOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [dropdownOpen]);

  /* ── Shared sidebar content (reused by desktop and mobile drawer) ── */
  const sidebarContent = (
    <>
      {/* Brand */}
      <div className="px-5 h-14 flex items-center gap-2.5 border-b border-border">
        <div className="w-[26px] h-[26px] rounded-lg bg-gradient-to-br from-[#4ecdc4] to-[#2db6a0] flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-text-primary">
          ContIA
        </span>
        <span className="ml-auto text-[10px] font-medium text-text-muted bg-bg-card px-1.5 py-0.5 rounded">
          AI
        </span>
        {/* Close button visible only inside the mobile drawer */}
        <button
          onClick={closeMobile}
          className="md:hidden ml-2 p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-card-hover transition-colors"
          aria-label="Fechar menu"
        >
          <X size={18} />
        </button>
      </div>

      {/* Empresa Selector */}
      <div className="px-3 py-3 border-b border-border relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen((o) => !o)}
          className="w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg bg-[#141736]/60 border border-[#1e2348]/50 hover:border-[#4ecdc4]/30 transition-all duration-200 group"
        >
          {empresa && (
            <span
              className="w-2 h-2 rounded-full shrink-0 ring-2 ring-transparent group-hover:ring-[#282d58] transition-all duration-200"
              style={{ backgroundColor: empresa.cor_primaria }}
            />
          )}
          <span className="flex-1 text-left text-[13px] text-text-primary truncate font-medium">
            {empresa?.nome ?? "Selecionar empresa"}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 ${
              dropdownOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        <AnimatePresence>
          {dropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="absolute left-3 right-3 top-full mt-1 z-50 bg-gradient-to-b from-[#141736] to-[#0f1230] border border-[#1e2348]/50 backdrop-blur-xl rounded-lg shadow-xl shadow-black/30 overflow-hidden py-1"
            >
              {empresas.map((e) => (
                <button
                  key={e.id}
                  onClick={() => {
                    setEmpresaId(e.id);
                    setDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-[7px] text-[13px] text-text-secondary hover:text-text-primary hover:bg-[#1a1e42] transition-colors duration-150"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: e.cor_primaria }}
                  />
                  <span className="flex-1 text-left truncate">{e.nome}</span>
                  {empresa?.id === e.id && (
                    <Check className="w-3 h-3 text-accent" />
                  )}
                </button>
              ))}
              <div className="my-1 mx-2 border-t border-border" />
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  setShowWizard(true);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-[7px] text-[13px] text-accent hover:bg-[#6c5ce714] transition-colors duration-150"
              >
                <Plus className="w-3 h-3" />
                Nova Empresa
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5 overflow-y-auto">
        {navLinks.map((link, index) => {
          const { label, href, icon: Icon } = link;
          const active = pathname === href || pathname.startsWith(href + "/");
          const showBadge = "needsDNA" in link && link.needsDNA && dnaMissingSources;
          return (
            <motion.div
              key={href}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
              <Link
                href={href}
                onClick={closeMobile}
                className={`relative flex items-center gap-2.5 px-2.5 h-9 rounded-lg text-[13px] font-medium transition-all duration-200 ${
                  active
                    ? "text-text-primary bg-gradient-to-r from-[#4ecdc4]/15 to-transparent"
                    : "text-text-secondary hover:text-text-primary hover:bg-[#4ecdc4]/5"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="activeNav"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-gradient-to-b from-[#4ecdc4] to-[#6c5ce7] shadow-[0_0_8px_rgba(78,205,196,0.4)]"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="relative shrink-0">
                  <Icon
                    className={`w-4 h-4 ${active ? "text-accent-light" : ""}`}
                  />
                  {showBadge && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#4ecdc4] border-2 border-[#0c0f24] animate-pulse shadow-[0_0_8px_rgba(78,205,196,0.5)]" />
                  )}
                </span>
                {label}
              </Link>
            </motion.div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-border space-y-2">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          <p className="text-[11px] text-text-muted">Powered by AI</p>
          <span className="ml-auto text-[10px] text-text-muted/60">v0.1</span>
        </div>
        {supabaseConfigured && (
          <button
            type="button"
            onClick={signOut}
            className="w-full flex items-center gap-2 px-2 h-7 rounded-lg text-[11px] text-text-muted hover:text-danger hover:bg-danger/10 transition-all duration-200 group"
            title="Sair"
          >
            <LogOut className="w-3 h-3 shrink-0" />
            <span className="flex-1 text-left truncate">
              {user?.email ?? "Sair"}
            </span>
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* ── Mobile Top Bar (only <md) ── */}
      <div className="fixed top-0 left-0 right-0 z-40 md:hidden h-14 bg-[#0c0f24] border-b border-border flex items-center px-4 gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-card-hover transition-colors"
          aria-label="Abrir menu"
        >
          <Menu size={22} />
        </button>
        <div className="w-[24px] h-[24px] rounded-lg bg-gradient-to-br from-[#4ecdc4] to-[#2db6a0] flex items-center justify-center">
          <Sparkles className="w-3 h-3 text-white" />
        </div>
        <span className="text-[14px] font-semibold tracking-tight text-text-primary">
          ContIA
        </span>
        {empresa && (
          <span className="ml-auto text-[11px] text-text-secondary truncate max-w-[140px]">
            {empresa.nome}
          </span>
        )}
      </div>

      {/* ── Mobile Overlay + Drawer ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="mobile-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
              onClick={closeMobile}
              aria-hidden="true"
            />
            <motion.aside
              key="mobile-drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 35 }}
              className="fixed top-0 left-0 bottom-0 z-50 w-[270px] flex flex-col bg-[#0c0f24] border-r border-border md:hidden"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Desktop Sidebar (md+) ── */}
      <aside className="hidden md:flex flex-col w-[240px] min-h-screen shrink-0 border-r border-border bg-[#0c0f24] relative z-30">
        {sidebarContent}
      </aside>

      {/* Empresa creation wizard */}
      <EmpresaWizard
        open={showWizard}
        onClose={() => setShowWizard(false)}
        onCreated={handleWizardCreated}
      />
    </>
  );
}
