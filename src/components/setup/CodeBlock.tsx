"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = code;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="relative group rounded-lg bg-[#0a0d20] border border-border overflow-hidden">
      {language && (
        <div className="px-3 py-1 text-[10px] font-medium text-text-muted border-b border-border bg-[#0c0f24]">
          {language}
        </div>
      )}
      <pre className="p-3 text-[12px] leading-relaxed text-text-primary overflow-x-auto whitespace-pre-wrap break-all font-mono">
        {code}
      </pre>
      <button
        onClick={handleCopy}
        className={`absolute top-2 right-2 p-1.5 rounded-md transition-all duration-200 ${
          copied
            ? "bg-success/20 text-success"
            : "bg-bg-elevated/80 text-text-muted hover:text-text-primary hover:bg-bg-elevated"
        }`}
        title={copied ? "Copiado!" : "Copiar"}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}
