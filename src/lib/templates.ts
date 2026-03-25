import { CreationTemplate } from "@/types/ai";

const STORAGE_KEY = "contia_templates";

function getStorageKey(empresaId: string): string {
  return `${STORAGE_KEY}_${empresaId}`;
}

export function getTemplates(empresaId: string): CreationTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getStorageKey(empresaId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTemplate(template: CreationTemplate): CreationTemplate {
  const templates = getTemplates(template.empresa_id);
  const idx = templates.findIndex((t) => t.id === template.id);
  if (idx >= 0) {
    templates[idx] = { ...template, updated_at: new Date().toISOString() };
  } else {
    templates.push(template);
  }
  localStorage.setItem(getStorageKey(template.empresa_id), JSON.stringify(templates));
  return template;
}

export function deleteTemplate(empresaId: string, templateId: string): void {
  const templates = getTemplates(empresaId).filter((t) => t.id !== templateId);
  localStorage.setItem(getStorageKey(empresaId), JSON.stringify(templates));
}
