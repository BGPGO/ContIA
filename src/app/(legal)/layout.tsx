import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { GoStudioLogo } from "@/components/layout/GoStudioLogo";

export const metadata: Metadata = {
  robots: "index, follow",
};

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#080b1e] text-[#e8eaff]">
      {/* Header */}
      <header className="border-b border-[#1e2348] bg-[#0c0f24]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 text-[#e8eaff] hover:text-[#4ecdc4] transition-colors"
            aria-label="GO Studio — Página inicial"
          >
            <GoStudioLogo className="w-7 h-7" idSuffix="legal" withSpark={false} withShadow={false} />
            <span className="text-base font-semibold tracking-tight">GO Studio</span>
          </Link>

          {/* Voltar */}
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-[#8b8fb0] hover:text-[#4ecdc4] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Voltar
          </Link>
        </div>
      </header>

      {/* Content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="border-t border-[#1e2348] bg-[#0c0f24] mt-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-[#5e6388]">
            © {new Date().getFullYear()} BGP — Bertuzzi Patrimonial. Todos os direitos reservados.
          </p>
          <nav className="flex items-center gap-4 text-sm" aria-label="Links legais">
            <Link href="/privacidade" className="text-[#8b8fb0] hover:text-[#4ecdc4] transition-colors">
              Política de Privacidade
            </Link>
            <span className="text-[#1e2348]" aria-hidden="true">|</span>
            <Link href="/termos" className="text-[#8b8fb0] hover:text-[#4ecdc4] transition-colors">
              Termos de Uso
            </Link>
            <span className="text-[#1e2348]" aria-hidden="true">|</span>
            <a
              href="mailto:oliver@bertuzzipatrimonial.com.br"
              className="text-[#8b8fb0] hover:text-[#4ecdc4] transition-colors"
            >
              Contato
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
