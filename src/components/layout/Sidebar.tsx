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
  Palette,
  Settings,
  Wrench,
  ChevronDown,
  ChevronRight,
  Check,
  LogOut,
  Plus,
  Menu,
  X,
  FileText,
  Clock,
  TrendingUp,
  Lightbulb,
  LayoutTemplate,
  Scissors,
  type LucideIcon,
} from "lucide-react";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useUser } from "@/hooks/useUser";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { EmpresaWizard } from "@/components/empresas/EmpresaWizard";
import type { Empresa } from "@/types";

/* ── Types ── */

interface NavLink {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  badgeColor?: "emerald" | "purple" | "amber";
}

interface NavSection {
  id: string;
  label: string;
  links: NavLink[];
}

/* ── Navigation structure ── */

const navSections: NavSection[] = [
  {
    id: "criar",
    label: "Criar",
    links: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Studio", href: "/studio", icon: Sparkles },
      { label: "Templates", href: "/templates", icon: LayoutTemplate },
      { label: "Calendario", href: "/calendario", icon: CalendarDays },
      { label: "Cortes de Video", href: "/cortes", icon: Scissors },
    ],
  },
  {
    id: "analisar",
    label: "Analisar",
    links: [
      { label: "Analytics", href: "/analytics", icon: BarChart3 },
      { label: "Inteligencia", href: "/insights", icon: Lightbulb },
      { label: "Comparativo", href: "/insights/comparar", icon: TrendingUp },
      { label: "Concorrentes", href: "/concorrentes", icon: Users },
      { label: "Noticias", href: "/noticias", icon: Newspaper },
    ],
  },
  {
    id: "relatorios",
    label: "Relatorios",
    links: [
      { label: "Relatorios", href: "/relatorios", icon: FileText },
      { label: "Agendados", href: "/relatorios/agendados", icon: Clock },
    ],
  },
  {
    id: "marca",
    label: "Marca",
    links: [
      { label: "DNA da Marca", href: "/marca", icon: Brain },
      { label: "Materiais", href: "/marca/assets", icon: Palette },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    links: [
      { label: "Setup", href: "/setup", icon: Wrench },
      { label: "Conexoes", href: "/conexoes", icon: Cable },
      { label: "Configuracoes", href: "/configuracoes", icon: Settings },
    ],
  },
];

/* ── Icon color map for contextual icons ── */
const iconColorMap: Record<string, string> = {
  "/dashboard": "text-[#4ecdc4]",
  "/criacao": "text-[#a29bfe]",
  "/studio": "text-[#a29bfe]",
  "/templates": "text-[#f093fb]",
  "/calendario": "text-[#fbbf24]",
  "/cortes": "text-[#34d399]",
  "/analytics": "text-[#60a5fa]",
  "/insights": "text-[#4ecdc4]",
  "/insights/comparar": "text-[#34d399]",
  "/concorrentes": "text-[#f87171]",
  "/noticias": "text-[#fbbf24]",
  "/relatorios": "text-[#a29bfe]",
  "/relatorios/agendados": "text-[#60a5fa]",
  "/marca": "text-[#f093fb]",
  "/marca/assets": "text-[#fbbf24]",
  "/setup": "text-[#4ecdc4]",
  "/conexoes": "text-[#6c5ce7]",
  "/configuracoes": "text-[#8b8fb0]",
};

const STORAGE_KEY = "contia_sidebar_sections";

/* ── Sidebar Component ── */

export function Sidebar() {
  const pathname = usePathname();
  const { empresa, empresas, setEmpresaId } = useEmpresa();
  const { user, signOut } = useUser();
  const supabaseConfigured = isSupabaseConfigured();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Collapsible sections state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleSection = useCallback((sectionId: string) => {
    setOpenSections((prev) => {
      const next = { ...prev, [sectionId]: !prev[sectionId] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* noop */
      }
      return next;
    });
  }, []);

  // Check if section has active link
  const sectionHasActive = useCallback(
    (section: NavSection) =>
      section.links.some(
        (l) => pathname === l.href || pathname.startsWith(l.href + "/")
      ),
    [pathname]
  );

  // Section is open if explicitly toggled or has active link
  const isSectionOpen = useCallback(
    (section: NavSection) => {
      if (section.id in openSections) return openSections[section.id];
      return sectionHasActive(section);
    },
    [openSections, sectionHasActive]
  );

  const handleWizardCreated = (_empresa: Empresa) => {
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
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [dropdownOpen]);

  // Get user initials for avatar
  const userInitials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : "??";

  /* ── Shared sidebar content ── */
  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* ── Brand Header ── */}
      <div className="relative px-5 h-16 flex items-center gap-3 border-b border-[#1e2348]/80">
        {/* Subtle gradient overlay on brand area */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#4ecdc4]/[0.03] to-[#6c5ce7]/[0.03] pointer-events-none" />
        <div className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-[#4ecdc4] to-[#6c5ce7] flex items-center justify-center shadow-lg shadow-[#4ecdc4]/20">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="text-[15px] font-bold tracking-tight text-[#e8eaff]">
            ContIA
          </span>
          <span className="text-[10px] font-medium text-[#5e6388] tracking-wide">
            Content Intelligence
          </span>
        </div>
        <span className="ml-auto text-[9px] font-semibold text-[#4ecdc4] bg-[#4ecdc4]/10 px-2 py-0.5 rounded-full border border-[#4ecdc4]/20 uppercase tracking-wider">
          AI
        </span>
        {/* Mobile close */}
        <button
          onClick={closeMobile}
          className="md:hidden ml-1 p-1.5 rounded-lg text-[#5e6388] hover:text-[#e8eaff] hover:bg-[#1a1e42] transition-all duration-200"
          aria-label="Fechar menu"
        >
          <X size={18} />
        </button>
      </div>

      {/* ── Empresa Selector ── */}
      <div className="px-3 py-3 border-b border-[#1e2348]/60 relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen((o) => !o)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#141736]/80 border border-[#1e2348]/60 hover:border-[#4ecdc4]/30 hover:bg-[#141736] transition-all duration-200 group"
          aria-expanded={dropdownOpen}
          aria-haspopup="listbox"
        >
          {empresa ? (
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-[#141736] group-hover:ring-[#1a1e42] transition-all duration-200"
              style={{ backgroundColor: empresa.cor_primaria }}
            />
          ) : (
            <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#5e6388]/50" />
          )}
          <span className="flex-1 text-left text-[13px] text-[#e8eaff] truncate font-medium">
            {empresa?.nome ?? "Selecionar empresa"}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-[#5e6388] transition-transform duration-200 ${
              dropdownOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        <AnimatePresence>
          {dropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
              className="absolute left-3 right-3 top-full mt-1 z-50 bg-gradient-to-b from-[#141736] to-[#0f1230] border border-[#1e2348]/60 backdrop-blur-xl rounded-xl shadow-xl shadow-black/40 overflow-hidden py-1"
              role="listbox"
            >
              {empresas.map((e) => (
                <button
                  key={e.id}
                  onClick={() => {
                    setEmpresaId(e.id);
                    setDropdownOpen(false);
                  }}
                  role="option"
                  aria-selected={empresa?.id === e.id}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#8b8fb0] hover:text-[#e8eaff] hover:bg-[#1a1e42] transition-colors duration-150"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: e.cor_primaria }}
                  />
                  <span className="flex-1 text-left truncate">{e.nome}</span>
                  {empresa?.id === e.id && (
                    <Check className="w-3.5 h-3.5 text-[#4ecdc4]" />
                  )}
                </button>
              ))}
              <div className="my-1 mx-2.5 border-t border-[#1e2348]" />
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  setShowWizard(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[#6c5ce7] hover:text-[#a29bfe] hover:bg-[#6c5ce7]/[0.06] transition-colors duration-150"
              >
                <Plus className="w-3.5 h-3.5" />
                Nova Empresa
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Navigation ── */}
      <nav
        className="flex-1 px-3 py-2 flex flex-col gap-0.5 overflow-y-auto"
        aria-label="Menu principal"
      >
        {navSections.map((section, sectionIdx) => {
          const open = isSectionOpen(section);
          const hasActive = sectionHasActive(section);

          return (
            <div key={section.id}>
              {/* Section divider (not before the first) */}
              {sectionIdx > 0 && (
                <div className="mx-2 my-2 border-t border-[#1e2348]/50" />
              )}

              {/* Section label */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-2 px-2.5 h-7 mb-0.5 group"
                aria-expanded={open}
                aria-controls={`nav-section-${section.id}`}
              >
                <span
                  className={`text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors duration-200 ${
                    hasActive
                      ? "text-[#4ecdc4]/80"
                      : "text-[#5e6388]/70 group-hover:text-[#5e6388]"
                  }`}
                >
                  {section.label}
                </span>
                <div className="flex-1" />
                <ChevronRight
                  className={`w-3 h-3 text-[#5e6388]/50 transition-transform duration-200 ${
                    open ? "rotate-90" : ""
                  }`}
                />
              </button>

              {/* Section links */}
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    id={`nav-section-${section.id}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                    className="overflow-hidden"
                    role="group"
                  >
                    <div className="flex flex-col gap-[2px]">
                      {section.links.map((link) => {
                        const active =
                          pathname === link.href ||
                          pathname.startsWith(link.href + "/");
                        const iconColor = active
                          ? "text-white"
                          : iconColorMap[link.href] || "text-[#5e6388]";

                        return (
                          <Link
                            key={link.href}
                            href={link.href}
                            onClick={closeMobile}
                            aria-current={active ? "page" : undefined}
                            className={`relative flex items-center gap-2.5 px-2.5 h-9 rounded-xl text-[13px] font-medium transition-all duration-200 group/link ${
                              active
                                ? "text-white bg-gradient-to-r from-[#4ecdc4]/20 via-[#6c5ce7]/10 to-transparent shadow-[inset_0_0_20px_rgba(78,205,196,0.06)]"
                                : "text-[#8b8fb0] hover:text-[#e8eaff] hover:bg-[#1a1e42]/60"
                            }`}
                          >
                            {/* Active indicator bar */}
                            {active && (
                              <motion.span
                                layoutId="sidebarActiveIndicator"
                                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-gradient-to-b from-[#4ecdc4] to-[#6c5ce7] shadow-[0_0_12px_rgba(78,205,196,0.5)]"
                                transition={{
                                  type: "spring",
                                  stiffness: 380,
                                  damping: 28,
                                }}
                              />
                            )}

                            {/* Icon with contextual color */}
                            <span
                              className={`flex items-center justify-center w-5 h-5 shrink-0 transition-all duration-200 ${iconColor} ${
                                !active
                                  ? "group-hover/link:scale-110 group-hover/link:drop-shadow-[0_0_6px_rgba(78,205,196,0.3)]"
                                  : "drop-shadow-[0_0_8px_rgba(78,205,196,0.4)]"
                              }`}
                            >
                              <link.icon className="w-[18px] h-[18px]" />
                            </span>

                            {/* Label */}
                            <span className="flex-1 truncate">{link.label}</span>

                            {/* Badge */}
                            {link.badge && (
                              <span
                                className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                                  link.badgeColor === "purple"
                                    ? "bg-[#6c5ce7]/15 text-[#a29bfe] border border-[#6c5ce7]/20"
                                    : link.badgeColor === "amber"
                                      ? "bg-[#fbbf24]/15 text-[#fbbf24] border border-[#fbbf24]/20"
                                      : "bg-[#4ecdc4]/15 text-[#4ecdc4] border border-[#4ecdc4]/20"
                                }`}
                              >
                                {link.badge}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      {/* ── Footer ── */}
      <div className="px-3 py-3 border-t border-[#1e2348]/80">
        {/* Powered by AI indicator */}
        <div className="flex items-center gap-1.5 px-2.5 mb-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34d399] opacity-50" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#34d399]" />
          </span>
          <span className="text-[10px] text-[#5e6388] font-medium">
            Powered by AI
          </span>
          <span className="ml-auto text-[10px] text-[#5e6388]/50 font-mono">
            v0.1
          </span>
        </div>

        {/* User row */}
        {supabaseConfigured && (
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-[#1a1e42]/60 transition-all duration-200 group/user">
            {/* User avatar */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6c5ce7]/30 to-[#4ecdc4]/30 border border-[#1e2348] flex items-center justify-center shrink-0">
              <span className="text-[11px] font-bold text-[#a29bfe]">
                {userInitials}
              </span>
            </div>
            {/* Email */}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-[#e8eaff] font-medium truncate">
                {user?.email ?? "Usuario"}
              </p>
              <p className="text-[10px] text-[#5e6388] truncate">
                {empresa?.nome ?? "Sem empresa"}
              </p>
            </div>
            {/* Logout */}
            <button
              type="button"
              onClick={signOut}
              className="p-1.5 rounded-lg text-[#5e6388] hover:text-[#f87171] hover:bg-[#f87171]/10 transition-all duration-200 opacity-0 group-hover/user:opacity-100"
              title="Sair"
              aria-label="Sair da conta"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* ── Mobile Top Bar ── */}
      <div className="fixed top-0 left-0 right-0 z-40 md:hidden h-14 bg-[#0c0f24]/95 backdrop-blur-xl border-b border-[#1e2348]/60 flex items-center px-4 gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-lg text-[#5e6388] hover:text-[#e8eaff] hover:bg-[#1a1e42] transition-all duration-200"
          aria-label="Abrir menu"
        >
          <Menu size={22} />
        </button>
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#4ecdc4] to-[#6c5ce7] flex items-center justify-center shadow-lg shadow-[#4ecdc4]/15">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-[14px] font-bold tracking-tight text-[#e8eaff]">
          ContIA
        </span>
        {empresa && (
          <span className="ml-auto text-[11px] text-[#8b8fb0] truncate max-w-[140px] font-medium">
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
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-40 bg-[#080b1e]/70 backdrop-blur-md md:hidden"
              onClick={closeMobile}
              aria-hidden="true"
            />
            <motion.aside
              key="mobile-drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 35 }}
              className="fixed top-0 left-0 bottom-0 z-50 w-[280px] flex flex-col bg-[#0c0f24] border-r border-[#1e2348]/60 shadow-2xl shadow-black/50 md:hidden"
              role="dialog"
              aria-modal="true"
              aria-label="Menu de navegacao"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex flex-col w-[260px] h-screen shrink-0 border-r border-[#1e2348]/60 bg-[#0c0f24] relative z-30 overflow-hidden">
        {/* Subtle side gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#4ecdc4]/[0.02] via-transparent to-[#6c5ce7]/[0.02] pointer-events-none" />
        <div className="relative flex flex-col h-full">
          {sidebarContent}
        </div>
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
