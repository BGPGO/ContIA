"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Generates real canvas preview thumbnails for preset templates.
 * Uses an off-screen Fabric.js canvas to render each preset JSON and export as data URL.
 */
export function usePresetPreviews(
  presetIds: string[],
  aspectRatio: string
): Map<string, string> {
  const [previews, setPreviews] = useState<Map<string, string>>(new Map());
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // Skip if no presets
    if (presetIds.length === 0) return;

    let cancelled = false;

    async function generatePreviews() {
      const fabric = await import("fabric");
      const { generatePresetJson } = await import("@/lib/preset-templates");

      // Create off-screen canvas element
      if (!canvasElRef.current) {
        canvasElRef.current = document.createElement("canvas");
      }

      const canvasEl = canvasElRef.current;
      const fabricCanvas = new fabric.Canvas(canvasEl, {
        width: 270,
        height: 270,
        renderOnAddRemove: false,
      });

      const newPreviews = new Map<string, string>();

      for (const presetId of presetIds) {
        if (cancelled) break;

        const json = generatePresetJson(presetId, aspectRatio);

        try {
          await fabricCanvas.loadFromJSON(json);
          fabricCanvas.renderAll();

          const dataUrl = fabricCanvas.toDataURL({
            format: "png",
            quality: 0.7,
            multiplier: 0.25,
          });

          newPreviews.set(presetId, dataUrl);
        } catch (e) {
          console.warn(`[PresetPreviews] Failed to render ${presetId}:`, e);
        }

        fabricCanvas.clear();
      }

      fabricCanvas.dispose();

      if (!cancelled) {
        setPreviews(newPreviews);
      }
    }

    generatePreviews();

    return () => {
      cancelled = true;
    };
  }, [presetIds.join(","), aspectRatio]); // eslint-disable-line react-hooks/exhaustive-deps

  return previews;
}
