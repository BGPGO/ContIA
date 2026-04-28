"use client";

import { useContext } from "react";
import { ThemeContext } from "@/components/layout/ThemeProvider";

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme deve ser usado dentro de <ThemeProvider />");
  }
  return ctx;
}
