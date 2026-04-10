import type { CopyContent } from "@/types/copy-studio";

interface BrandStyle {
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  brandName?: string;
}

interface LayoutOptions {
  aspectRatio: "1:1" | "4:5" | "9:16";
  format: "post" | "carrossel" | "reels";
  style?: "bold" | "minimal" | "editorial" | "gradient" | "split";
}

const DIMS: Record<string, { w: number; h: number }> = {
  "1:1": { w: 1080, h: 1080 },
  "4:5": { w: 1080, h: 1350 },
  "9:16": { w: 1080, h: 1920 },
};

export function generateSmartLayout(
  copy: CopyContent,
  brand: BrandStyle,
  options: LayoutOptions
): object {
  const { w, h } = DIMS[options.aspectRatio] || DIMS["1:1"];
  const primary = brand.primaryColor || "#4ecdc4";
  const secondary = brand.secondaryColor || "#6c5ce7";

  // Analyze content to determine visual weight
  const headlineLength = (copy.headline || "").length;
  const captionLength = (copy.caption || "").length;
  const hasSlides = copy.slides && copy.slides.length > 0;
  const hasCTA = !!copy.cta;

  // Determine headline font size based on content length
  const headlineFontSize =
    headlineLength > 40 ? 48 : headlineLength > 20 ? 64 : 80;

  // Determine body font size
  const bodyFontSize =
    captionLength > 300 ? 24 : captionLength > 150 ? 28 : 32;

  // Auto-select style based on content
  const style =
    options.style ||
    (hasSlides ? "editorial" : headlineLength < 20 ? "bold" : "minimal");

  const objects: object[] = [];

  let bgColor = "#080b1e";

  switch (style) {
    case "bold": {
      bgColor = "#0a0e24";

      // Accent shape top-left
      objects.push({
        type: "Rect",
        left: 0,
        top: 0,
        width: w * 0.4,
        height: 6,
        fill: primary,
        selectable: false,
        data: { role: "decoration" },
      });

      // Headline — takes ~40% of height
      objects.push({
        type: "Textbox",
        left: 60,
        top: h * 0.15,
        width: w - 120,
        text: copy.headline || "Headline",
        fontSize: headlineFontSize,
        fontFamily: "Inter, sans-serif",
        fontWeight: "900",
        fill: "#ffffff",
        textAlign: "left",
        lineHeight: 1.1,
        data: { role: "headline", editable: true },
      });

      // Body — below headline
      if (copy.caption) {
        const displayCaption =
          copy.caption.length > 200
            ? copy.caption.slice(0, 200) + "..."
            : copy.caption;
        objects.push({
          type: "Textbox",
          left: 60,
          top: h * 0.55,
          width: w - 120,
          text: displayCaption,
          fontSize: bodyFontSize,
          fontFamily: "Inter, sans-serif",
          fontWeight: "400",
          fill: "#e8eaff",
          opacity: 0.8,
          textAlign: "left",
          lineHeight: 1.4,
          data: { role: "body", editable: true },
        });
      }

      // CTA at bottom
      if (hasCTA) {
        objects.push({
          type: "Textbox",
          left: 60,
          top: h - 120,
          width: w - 120,
          text: copy.cta || "",
          fontSize: 28,
          fontFamily: "Inter, sans-serif",
          fontWeight: "700",
          fill: primary,
          textAlign: "left",
          data: { role: "cta", editable: true },
        });
      }

      // Brand name bottom-right
      if (brand.brandName) {
        objects.push({
          type: "Textbox",
          left: w - 260,
          top: h - 60,
          width: 200,
          text: brand.brandName,
          fontSize: 18,
          fontFamily: "Inter, sans-serif",
          fontWeight: "600",
          fill: "#ffffff",
          opacity: 0.4,
          textAlign: "right",
          data: { role: "brand", editable: true },
        });
      }
      break;
    }

    case "minimal": {
      bgColor = "#ffffff";

      // Thin colored line at top
      objects.push({
        type: "Rect",
        left: 60,
        top: 40,
        width: 60,
        height: 4,
        fill: primary,
        selectable: false,
        data: { role: "decoration" },
      });

      // Headline
      objects.push({
        type: "Textbox",
        left: 60,
        top: 80,
        width: w - 120,
        text: copy.headline || "Headline",
        fontSize: headlineFontSize * 0.8,
        fontFamily: "Inter, sans-serif",
        fontWeight: "800",
        fill: "#1a1a2e",
        textAlign: "left",
        lineHeight: 1.15,
        data: { role: "headline", editable: true },
      });

      // Body
      if (copy.caption) {
        const displayCaption =
          copy.caption.length > 250
            ? copy.caption.slice(0, 250) + "..."
            : copy.caption;
        objects.push({
          type: "Textbox",
          left: 60,
          top: h * 0.4,
          width: w - 120,
          text: displayCaption,
          fontSize: bodyFontSize * 0.9,
          fontFamily: "Inter, sans-serif",
          fontWeight: "400",
          fill: "#333355",
          textAlign: "left",
          lineHeight: 1.5,
          data: { role: "body", editable: true },
        });
      }

      // CTA
      if (hasCTA) {
        objects.push({
          type: "Textbox",
          left: 60,
          top: h - 100,
          width: w - 120,
          text: copy.cta || "",
          fontSize: 24,
          fontFamily: "Inter, sans-serif",
          fontWeight: "700",
          fill: primary,
          data: { role: "cta", editable: true },
        });
      }
      break;
    }

    case "editorial": {
      bgColor = "#0a0e24";

      // Left accent bar
      objects.push({
        type: "Rect",
        left: 0,
        top: 0,
        width: 8,
        height: h,
        fill: primary,
        selectable: false,
        data: { role: "decoration" },
      });

      // Category label (from hashtags or generic)
      const category = (copy.hashtags?.[0] || "insight")
        .replace("#", "")
        .toUpperCase();
      objects.push({
        type: "Textbox",
        left: 60,
        top: 60,
        width: 300,
        text: category,
        fontSize: 16,
        fontFamily: "Inter, sans-serif",
        fontWeight: "700",
        fill: primary,
        charSpacing: 200,
        data: { role: "category", editable: true },
      });

      // Headline
      objects.push({
        type: "Textbox",
        left: 60,
        top: 120,
        width: w - 120,
        text: copy.headline || "Headline",
        fontSize: headlineFontSize * 0.85,
        fontFamily: "Inter, sans-serif",
        fontWeight: "800",
        fill: "#ffffff",
        textAlign: "left",
        lineHeight: 1.15,
        data: { role: "headline", editable: true },
      });

      // Divider line
      objects.push({
        type: "Rect",
        left: 60,
        top: h * 0.38,
        width: w * 0.3,
        height: 2,
        fill: primary,
        opacity: 0.5,
        selectable: false,
        data: { role: "decoration" },
      });

      // Body
      if (copy.caption) {
        const displayCaption =
          copy.caption.length > 300
            ? copy.caption.slice(0, 300) + "..."
            : copy.caption;
        objects.push({
          type: "Textbox",
          left: 60,
          top: h * 0.42,
          width: w - 120,
          text: displayCaption,
          fontSize: bodyFontSize,
          fontFamily: "Inter, sans-serif",
          fontWeight: "400",
          fill: "#e8eaff",
          opacity: 0.85,
          textAlign: "left",
          lineHeight: 1.45,
          data: { role: "body", editable: true },
        });
      }

      // CTA
      if (hasCTA) {
        objects.push({
          type: "Textbox",
          left: 60,
          top: h - 100,
          width: w - 120,
          text: copy.cta || "",
          fontSize: 26,
          fontFamily: "Inter, sans-serif",
          fontWeight: "700",
          fill: primary,
          data: { role: "cta", editable: true },
        });
      }

      // Brand
      if (brand.brandName) {
        objects.push({
          type: "Textbox",
          left: w - 260,
          top: h - 50,
          width: 200,
          text: brand.brandName,
          fontSize: 16,
          fontFamily: "Inter, sans-serif",
          fontWeight: "600",
          fill: "#ffffff",
          opacity: 0.35,
          textAlign: "right",
          data: { role: "brand", editable: true },
        });
      }
      break;
    }

    case "gradient": {
      bgColor = "#080b1e";

      // Gradient overlay shapes
      objects.push({
        type: "Rect",
        left: 0,
        top: h * 0.6,
        width: w,
        height: h * 0.4,
        fill: primary,
        opacity: 0.15,
        selectable: false,
        data: { role: "decoration" },
      });
      objects.push({
        type: "Rect",
        left: w * 0.5,
        top: 0,
        width: w * 0.5,
        height: h * 0.5,
        fill: secondary,
        opacity: 0.1,
        selectable: false,
        data: { role: "decoration" },
      });

      // Headline centered
      objects.push({
        type: "Textbox",
        left: 80,
        top: h * 0.2,
        width: w - 160,
        text: copy.headline || "Headline",
        fontSize: headlineFontSize,
        fontFamily: "Inter, sans-serif",
        fontWeight: "900",
        fill: "#ffffff",
        textAlign: "center",
        lineHeight: 1.1,
        data: { role: "headline", editable: true },
      });

      // Body centered
      if (copy.caption) {
        const displayCaption =
          copy.caption.length > 200
            ? copy.caption.slice(0, 200) + "..."
            : copy.caption;
        objects.push({
          type: "Textbox",
          left: 80,
          top: h * 0.5,
          width: w - 160,
          text: displayCaption,
          fontSize: bodyFontSize,
          fontFamily: "Inter, sans-serif",
          fontWeight: "400",
          fill: "#e8eaff",
          opacity: 0.85,
          textAlign: "center",
          lineHeight: 1.4,
          data: { role: "body", editable: true },
        });
      }

      // CTA
      if (hasCTA) {
        objects.push({
          type: "Textbox",
          left: 80,
          top: h - 140,
          width: w - 160,
          text: copy.cta || "",
          fontSize: 28,
          fontFamily: "Inter, sans-serif",
          fontWeight: "700",
          fill: primary,
          textAlign: "center",
          data: { role: "cta", editable: true },
        });
      }
      break;
    }

    case "split": {
      bgColor = "#080b1e";

      // Left colored panel
      objects.push({
        type: "Rect",
        left: 0,
        top: 0,
        width: w * 0.35,
        height: h,
        fill: primary,
        selectable: false,
        data: { role: "decoration" },
      });

      // Brand on colored panel
      if (brand.brandName) {
        objects.push({
          type: "Textbox",
          left: 30,
          top: h - 80,
          width: w * 0.3,
          text: brand.brandName,
          fontSize: 18,
          fontFamily: "Inter, sans-serif",
          fontWeight: "700",
          fill: "#ffffff",
          opacity: 0.9,
          data: { role: "brand", editable: true },
        });
      }

      // Headline on right
      objects.push({
        type: "Textbox",
        left: w * 0.4,
        top: h * 0.15,
        width: w * 0.55,
        text: copy.headline || "Headline",
        fontSize: headlineFontSize * 0.75,
        fontFamily: "Inter, sans-serif",
        fontWeight: "800",
        fill: "#ffffff",
        textAlign: "left",
        lineHeight: 1.15,
        data: { role: "headline", editable: true },
      });

      // Body on right
      if (copy.caption) {
        const displayCaption =
          copy.caption.length > 200
            ? copy.caption.slice(0, 200) + "..."
            : copy.caption;
        objects.push({
          type: "Textbox",
          left: w * 0.4,
          top: h * 0.45,
          width: w * 0.55,
          text: displayCaption,
          fontSize: bodyFontSize * 0.9,
          fontFamily: "Inter, sans-serif",
          fontWeight: "400",
          fill: "#e8eaff",
          opacity: 0.8,
          textAlign: "left",
          lineHeight: 1.4,
          data: { role: "body", editable: true },
        });
      }

      // CTA
      if (hasCTA) {
        objects.push({
          type: "Textbox",
          left: w * 0.4,
          top: h - 100,
          width: w * 0.55,
          text: copy.cta || "",
          fontSize: 24,
          fontFamily: "Inter, sans-serif",
          fontWeight: "700",
          fill: primary,
          data: { role: "cta", editable: true },
        });
      }
      break;
    }
  }

  return {
    version: "6.0.0",
    objects,
    background: bgColor,
  };
}

// Generate carousel slides from copy
export function generateCarouselLayout(
  copy: CopyContent,
  brand: BrandStyle,
  options: LayoutOptions
): object[] {
  if (!copy.slides || copy.slides.length === 0) {
    return [generateSmartLayout(copy, brand, options)];
  }

  return copy.slides.map((slide, i) => {
    const slideCopy: CopyContent = {
      headline: slide.headline,
      caption: slide.body,
      hashtags: i === 0 ? copy.hashtags : [],
      cta: i === copy.slides!.length - 1 ? copy.cta : "",
    };

    // First slide gets "bold" style, middle get "editorial", last gets "gradient" with CTA
    const styles: Array<
      "bold" | "minimal" | "editorial" | "gradient" | "split"
    > = ["bold", "editorial", "minimal", "split", "gradient"];
    const style =
      i === 0
        ? "bold"
        : i === copy.slides!.length - 1
          ? "gradient"
          : styles[i % styles.length];

    return generateSmartLayout(slideCopy, brand, { ...options, style });
  });
}
