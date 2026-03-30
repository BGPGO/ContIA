"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { motion } from "motion/react";

interface ExportButtonProps {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  filename?: string;
}

export function ExportButton({
  canvasRef,
  filename = "post-contia",
}: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!canvasRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const canvas = await html2canvas(canvasRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: null,
      });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.png`;
      a.click();
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleExport}
      disabled={exporting}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-[#6c5ce7] to-[#4ecdc4] text-white hover:shadow-[0_0_25px_rgba(78,205,196,0.3)] disabled:opacity-50 transition-all"
    >
      {exporting ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <Download size={16} />
      )}
      {exporting ? "Exportando..." : "Baixar como Imagem"}
    </motion.button>
  );
}
