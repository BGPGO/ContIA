"use client";

import { useReducer, useCallback } from "react";
import type {
  ContentFormat,
  ContentTone,
  GeneratedContent,
  AnalyzeSiteResponse,
  FullInstagramAnalysis,
  PostVisualStyle,
  SuggestedPost,
  CreationTemplate,
} from "@/types/ai";
import type { PostDesignTemplate } from "@/components/post-design/PostCanvas";

// ── State ──

export interface WizardState {
  currentStep: number;
  templateId: string | null;
  templateName: string;

  // Analysis
  siteUrl: string;
  igUsername: string;
  siteAnalysis: AnalyzeSiteResponse | null;
  fullIgAnalysis: FullInstagramAnalysis | null;
  analyzingSite: boolean;
  analyzingIg: boolean;
  igAnalysisStep: number;

  // Format
  format: ContentFormat;
  tone: ContentTone;
  platforms: string[];
  topic: string;
  additionalInstructions: string;
  visualMode: boolean;

  // Generation
  generating: boolean;
  result: GeneratedContent | null;
  visualSlides: any[];
  visualLegenda: string;
  visualHashtags: string[];
  visualCta: string;

  // Images
  slideImages: Record<number, string>;
  generatedImageUrl: string | null;
  generatingImage: boolean;

  // Design
  designTemplate: PostDesignTemplate;
  designBrandColor: string;
  designAspectRatio: "1:1" | "4:5" | "9:16";

  // Export
  saving: boolean;
  saved: boolean;

  error: string | null;
}

const initialState: WizardState = {
  currentStep: 0,
  templateId: null,
  templateName: "",
  siteUrl: "",
  igUsername: "",
  siteAnalysis: null,
  fullIgAnalysis: null,
  analyzingSite: false,
  analyzingIg: false,
  igAnalysisStep: 0,
  format: "post",
  tone: "casual",
  platforms: ["instagram"],
  topic: "",
  additionalInstructions: "",
  visualMode: false,
  generating: false,
  result: null,
  visualSlides: [],
  visualLegenda: "",
  visualHashtags: [],
  visualCta: "",
  slideImages: {},
  generatedImageUrl: null,
  generatingImage: false,
  designTemplate: "bold-statement" as PostDesignTemplate,
  designBrandColor: "#4ecdc4",
  designAspectRatio: "4:5" as const,
  saving: false,
  saved: false,
  error: null,
};

// ── Actions ──

type Action =
  | { type: "SET_STEP"; step: number }
  | { type: "SET_FIELD"; field: keyof WizardState; value: any }
  | { type: "LOAD_TEMPLATE"; template: CreationTemplate }
  | { type: "SET_SITE_ANALYSIS"; data: AnalyzeSiteResponse }
  | { type: "SET_IG_ANALYSIS"; data: FullInstagramAnalysis }
  | { type: "SET_GENERATION_RESULT"; result: GeneratedContent }
  | { type: "SET_VISUAL_RESULT"; slides: any[]; legenda: string; hashtags: string[]; cta: string }
  | { type: "SET_SLIDE_IMAGE"; slideIndex: number; url: string }
  | { type: "SET_GENERATED_IMAGE"; url: string }
  | { type: "SELECT_SUGGESTION"; suggestion: SuggestedPost }
  | { type: "CLEAR_RESULTS" }
  | { type: "RESET" }
  | { type: "SET_ERROR"; error: string | null };

function reducer(state: WizardState, action: Action): WizardState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, currentStep: action.step, error: null };

    case "SET_FIELD":
      return { ...state, [action.field]: action.value };

    case "LOAD_TEMPLATE":
      return {
        ...state,
        templateId: action.template.id,
        templateName: action.template.name,
        tone: action.template.tone,
        platforms: action.template.platforms,
        siteUrl: action.template.site_url || "",
        igUsername: action.template.instagram_username || "",
        siteAnalysis: action.template.site_analysis || null,
        fullIgAnalysis: action.template.ig_analysis || null,
        visualMode: !!action.template.ig_analysis,
        currentStep: action.template.ig_analysis || action.template.site_analysis ? 2 : 1,
        error: null,
      };

    case "SET_SITE_ANALYSIS":
      return { ...state, siteAnalysis: action.data, analyzingSite: false };

    case "SET_IG_ANALYSIS":
      return {
        ...state,
        fullIgAnalysis: action.data,
        analyzingIg: false,
        igAnalysisStep: 0,
        visualMode: true,
      };

    case "SET_GENERATION_RESULT":
      return { ...state, result: action.result, generating: false };

    case "SET_VISUAL_RESULT":
      return {
        ...state,
        visualSlides: action.slides,
        visualLegenda: action.legenda,
        visualHashtags: action.hashtags,
        visualCta: action.cta,
        generating: false,
      };

    case "SET_SLIDE_IMAGE":
      return {
        ...state,
        slideImages: { ...state.slideImages, [action.slideIndex]: action.url },
      };

    case "SET_GENERATED_IMAGE":
      return { ...state, generatedImageUrl: action.url, generatingImage: false };

    case "SELECT_SUGGESTION":
      return {
        ...state,
        topic: action.suggestion.topic,
        format: (action.suggestion.format === "carrossel" ? "carrossel" : action.suggestion.format === "reels" || action.suggestion.format === "video" ? "reels" : "post") as ContentFormat,
      };

    case "CLEAR_RESULTS":
      return {
        ...state,
        result: null,
        visualSlides: [],
        visualLegenda: "",
        visualHashtags: [],
        visualCta: "",
        slideImages: {},
        generatedImageUrl: null,
        saved: false,
        designTemplate: "bold-statement" as PostDesignTemplate,
        designBrandColor: "#4ecdc4",
        designAspectRatio: "4:5" as const,
      };

    case "RESET":
      return { ...initialState };

    case "SET_ERROR":
      return { ...state, error: action.error };

    default:
      return state;
  }
}

export function useCreationWizard() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setStep = useCallback((step: number) => dispatch({ type: "SET_STEP", step }), []);
  const setField = useCallback(<K extends keyof WizardState>(field: K, value: WizardState[K]) =>
    dispatch({ type: "SET_FIELD", field, value }), []);
  const loadTemplate = useCallback((t: CreationTemplate) => dispatch({ type: "LOAD_TEMPLATE", template: t }), []);
  const setSiteAnalysis = useCallback((d: AnalyzeSiteResponse) => dispatch({ type: "SET_SITE_ANALYSIS", data: d }), []);
  const setIgAnalysis = useCallback((d: FullInstagramAnalysis) => dispatch({ type: "SET_IG_ANALYSIS", data: d }), []);
  const setGenerationResult = useCallback((r: GeneratedContent) => dispatch({ type: "SET_GENERATION_RESULT", result: r }), []);
  const setVisualResult = useCallback((slides: any[], legenda: string, hashtags: string[], cta: string) =>
    dispatch({ type: "SET_VISUAL_RESULT", slides, legenda, hashtags, cta }), []);
  const setSlideImage = useCallback((idx: number, url: string) => dispatch({ type: "SET_SLIDE_IMAGE", slideIndex: idx, url }), []);
  const setGeneratedImage = useCallback((url: string) => dispatch({ type: "SET_GENERATED_IMAGE", url }), []);
  const selectSuggestion = useCallback((s: SuggestedPost) => dispatch({ type: "SELECT_SUGGESTION", suggestion: s }), []);
  const clearResults = useCallback(() => dispatch({ type: "CLEAR_RESULTS" }), []);
  const reset = useCallback(() => dispatch({ type: "RESET" }), []);
  const setError = useCallback((e: string | null) => dispatch({ type: "SET_ERROR", error: e }), []);

  return {
    state,
    dispatch,
    setStep,
    setField,
    loadTemplate,
    setSiteAnalysis,
    setIgAnalysis,
    setGenerationResult,
    setVisualResult,
    setSlideImage,
    setGeneratedImage,
    selectSuggestion,
    clearResults,
    reset,
    setError,
  };
}
