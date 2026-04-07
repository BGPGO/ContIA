// Sistema de anti-duplicidade in-memory
// Abordagem: TF-IDF simplificado + cosine similarity
// Funciona in-memory, sem dependências externas

// Armazenar últimos N posts gerados por empresa
const postHistory = new Map<
  string,
  { content: string; tokens: Map<string, number>; createdAt: number }[]
>();

// Stopwords comuns em PT-BR para melhorar a qualidade da comparação
const STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "em", "no", "na", "nos", "nas",
  "por", "para", "com", "sem", "sob", "que", "uma", "um", "uns",
  "umas", "como", "mais", "menos", "muito", "pouco", "todo", "toda",
  "todos", "todas", "este", "esta", "esse", "essa", "isso", "isto",
  "aquele", "aquela", "ele", "ela", "eles", "elas", "seu", "sua",
  "seus", "suas", "meu", "minha", "nao", "sim", "mas", "pois",
  "porque", "quando", "onde", "quem", "qual", "cada", "entre",
  "sobre", "ate", "pode", "ser", "ter", "foi", "tem", "vai",
  "nos", "voc", "voce", "voces",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos para normalização
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

export function termFrequency(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) || 0) + 1);
  }
  // Normalizar pelo valor máximo
  const values = [...freq.values()];
  const max = values.length > 0 ? Math.max(...values) : 1;
  for (const [k, v] of freq) {
    freq.set(k, v / max);
  }
  return freq;
}

export function cosineSimilarity(
  a: Map<string, number>,
  b: Map<string, number>
): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  const allKeys = new Set([...a.keys(), ...b.keys()]);
  for (const key of allKeys) {
    const va = a.get(key) || 0;
    const vb = b.get(key) || 0;
    dotProduct += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  similarity: number;
  similarPost?: string;
}

export function checkDuplicate(
  empresaId: string,
  newContent: string
): DuplicateCheckResult {
  const history = postHistory.get(empresaId) || [];
  const newTokens = termFrequency(tokenize(newContent));

  let maxSimilarity = 0;
  let similarPost: string | undefined;

  for (const entry of history) {
    const sim = cosineSimilarity(newTokens, entry.tokens);
    if (sim > maxSimilarity) {
      maxSimilarity = sim;
      similarPost = entry.content.substring(0, 100);
    }
  }

  return {
    isDuplicate: maxSimilarity > 0.75, // threshold 75%
    similarity: Math.round(maxSimilarity * 100),
    similarPost: maxSimilarity > 0.75 ? similarPost : undefined,
  };
}

export function addToHistory(empresaId: string, content: string): void {
  if (!postHistory.has(empresaId)) postHistory.set(empresaId, []);
  const history = postHistory.get(empresaId)!;

  history.push({
    content,
    tokens: termFrequency(tokenize(content)),
    createdAt: Date.now(),
  });

  // Manter apenas últimos 100 posts por empresa
  if (history.length > 100) history.shift();
}

/** Retorna quantos posts estão no histórico de uma empresa */
export function getHistorySize(empresaId: string): number {
  return postHistory.get(empresaId)?.length || 0;
}

/** Limpa o histórico de uma empresa específica */
export function clearHistory(empresaId: string): void {
  postHistory.delete(empresaId);
}
