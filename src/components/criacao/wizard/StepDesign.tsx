"use client";

import { useRef } from "react";
import { motion } from "motion/react";
import { Sparkles } from "lucide-react";
import type { WizardState } from "@/hooks/useCreationWizard";
import type { Empresa } from "@/types";
import type { PostDesignData } from "@/components/post-design/PostCanvas";
import { PostCanvas } from "@/components/post-design/PostCanvas";
import { DesignPicker } from "@/components/post-design/DesignPicker";
import { ExportButton } from "@/components/post-design/ExportButton";
import { useMarcaDNA } from "@/hooks/useMarcaDNA";

interface StepDesignProps {
  state: WizardState;
  setField: <K extends keyof WizardState>(field: K, value: WizardState[K]) => void;
  empresa: Empresa | null;
}

export function StepDesign({ state, setField, empresa }: StepDesignProps) {
  const { dna } = useMarcaDNA(empresa?.id);
  const dnaBrandColors = dna?.dna_sintetizado?.paleta_cores?.filter(
    (c: string) => /^#[0-9A-Fa-f]{6}$/.test(c)
  ) || [];
  const canvasRef = useRef<HTMLDivElement>(null);

  const designData: PostDesignData = {
    headline: state.result?.visualPost?.headline
      || state.result?.titulo
      || state.visualSlides?.[0]?.titulo
      || "Seu título aqui",
    subheadline: state.result?.visualPost?.subheadline || undefined,
    accentText: state.result?.visualPost?.accentText || undefined,
    cta: state.result?.visualPost?.cta || state.result?.cta || undefined,
    brandName: empresa?.nome || "ContIA",
    brandColor: state.designBrandColor || empresa?.cor_primaria || "#4ecdc4",
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-1"
      >
        <h2 className="text-xl font-semibold text-text-primary flex items-center justify-center gap-2">
          <Sparkles size={20} className="text-accent" />
          Design do Post
        </h2>
        <p className="text-sm text-text-secondary">
          Escolha o template e personalize
        </p>
      </motion.div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left: Controls */}
        <div className="flex-1 min-w-0">
          <DesignPicker
            data={designData}
            selectedTemplate={state.designTemplate}
            onTemplateChange={(t) => setField("designTemplate", t)}
            brandColor={state.designBrandColor}
            onBrandColorChange={(c) => setField("designBrandColor", c)}
            aspectRatio={state.designAspectRatio}
            onAspectRatioChange={(r) => setField("designAspectRatio", r)}
            dnaBrandColors={dnaBrandColors}
          />
        </div>

        {/* Right: Preview + Export */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:w-[420px] shrink-0"
        >
          <div className="sticky top-6 flex flex-col items-center gap-4">
            <div className="bg-bg-card border border-border rounded-2xl p-4 w-full flex justify-center">
              <PostCanvas
                ref={canvasRef}
                data={designData}
                template={state.designTemplate}
                aspectRatio={state.designAspectRatio}
                brandColor={state.designBrandColor}
              />
            </div>
            <ExportButton canvasRef={canvasRef} filename={`post-${empresa?.nome || "contia"}`} />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
