import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

export function getPlataformaCor(plataforma: string): string {
  const cores: Record<string, string> = {
    instagram: "#e1306c",
    facebook: "#1877f2",
    linkedin: "#0a66c2",
    twitter: "#1da1f2",
    youtube: "#ff0000",
    tiktok: "#00f2ea",
  };
  return cores[plataforma] || "#6c5ce7";
}

export function getPlataformaLabel(plataforma: string): string {
  const labels: Record<string, string> = {
    instagram: "Instagram",
    facebook: "Facebook",
    linkedin: "LinkedIn",
    twitter: "X (Twitter)",
    youtube: "YouTube",
    tiktok: "TikTok",
  };
  return labels[plataforma] || plataforma;
}
