import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "ContIA — Gestor de Conteúdo IA",
  description:
    "Plataforma de gestão de conteúdo e redes sociais com inteligência artificial",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className={`${inter.className} bg-bg-primary text-text-primary`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
