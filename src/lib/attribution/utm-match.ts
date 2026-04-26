/**
 * Helpers de matching UTM ↔ campanha Meta.
 * Sem dependências externas — Levenshtein próprio (~30 linhas).
 */

/* ── Levenshtein (interno) ───────────────────────────────────────── */

/**
 * Calcula a distância de Levenshtein entre dois strings.
 * Complexidade O(m*n) — adequado para nomes de campanha (~100 chars).
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  // Usa array 1D rolling pra economizar memória
  const row: number[] = Array.from({ length: n + 1 }, (_, i) => i);

  for (let i = 1; i <= m; i++) {
    let prev = i;
    for (let j = 1; j <= n; j++) {
      const val =
        a[i - 1] === b[j - 1]
          ? row[j - 1]
          : 1 + Math.min(row[j - 1], row[j], prev);
      row[j - 1] = prev;
      prev = val;
    }
    row[n] = prev;
  }

  return row[n];
}

/* ── Normalize ───────────────────────────────────────────────────── */

/**
 * Normaliza string para matching: lowercase, strip acentos, substitui
 * qualquer sequência de não-alfanuméricos por underscore, trim underscores.
 *
 * @example
 * normalizeForMatch("AZ|BI|CADASTRO|Lal-venda")
 * // → "az_bi_cadastro_lal_venda"
 *
 * @example
 * normalizeForMatch("Campanha Verão 2025 — Meta Ads")
 * // → "campanha_verao_2025_meta_ads"
 */
export function normalizeForMatch(s: string): string {
  return s
    .normalize("NFD") // decompõe acentos (á → a + ́)
    .replace(/[̀-ͯ]/g, "") // remove combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_") // não-alfanumérico → underscore
    .replace(/^_+|_+$/g, ""); // trim underscores das bordas
}

/* ── Match Score ─────────────────────────────────────────────────── */

/**
 * Calcula score de confiança (0..1) entre nome de campanha Meta e utm_campaign do CRM.
 *
 * Algoritmo:
 * 1. Normaliza ambos com `normalizeForMatch`
 * 2. Match exato → 1.0
 * 3. Substring bidirecional (um contém o outro) → 0.85
 * 4. Levenshtein normalizada >= 0.7 → score de Levenshtein
 * 5. Caso contrário → 0
 *
 * @param metaCampaign - Nome da campanha vindo do Meta Ads Manager
 * @param utmCampaign  - Valor de utm_campaign vindo do CRM
 * @returns Score 0..1
 */
export function matchScore(metaCampaign: string, utmCampaign: string): number {
  const a = normalizeForMatch(metaCampaign);
  const b = normalizeForMatch(utmCampaign);

  if (!a || !b) return 0;

  // Match exato
  if (a === b) return 1.0;

  // Substring bidirecional
  if (a.includes(b) || b.includes(a)) return 0.85;

  // Levenshtein normalizado
  const maxLen = Math.max(a.length, b.length);
  const dist = levenshtein(a, b);
  const similarity = 1 - dist / maxLen;

  return similarity >= 0.7 ? similarity : 0;
}

/* ── Find Best Match ─────────────────────────────────────────────── */

/**
 * Para uma campanha Meta, encontra a melhor correspondência entre uma lista de utm_campaigns.
 * Retorna null se nenhum candidato atingir o threshold.
 *
 * @param metaCampaign  - Nome da campanha Meta
 * @param utmCampaigns  - Lista de utm_campaigns disponíveis no CRM
 * @param threshold     - Score mínimo para considerar match (padrão: 0.7)
 * @returns O melhor match `{ utm, score }` ou null
 *
 * @example
 * findBestMatch("AZ | BI | CADASTRO | Lal-Venda", ["az_bi_cadastro_lal_venda", "az_outro"])
 * // → { utm: "az_bi_cadastro_lal_venda", score: 1.0 }
 */
export function findBestMatch(
  metaCampaign: string,
  utmCampaigns: string[],
  threshold = 0.7
): { utm: string; score: number } | null {
  let best: { utm: string; score: number } | null = null;

  for (const utm of utmCampaigns) {
    const score = matchScore(metaCampaign, utm);
    if (score >= threshold && (!best || score > best.score)) {
      best = { utm, score };
    }
  }

  return best;
}
