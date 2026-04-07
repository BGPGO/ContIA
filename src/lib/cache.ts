// Cache simples in-memory com TTL
// Usado para evitar chamadas repetidas à OpenAI para mesma análise

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class AnalysisCache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(defaultTTLMs: number = 7 * 24 * 60 * 60 * 1000) {
    this.defaultTTL = defaultTTLMs;
    // Cleanup a cada 30 minutos
    if (typeof setInterval !== "undefined") {
      this.cleanupTimer = setInterval(() => this.cleanup(), 30 * 60 * 1000);
      // Permitir que o processo encerre mesmo com o timer ativo
      if (this.cleanupTimer && typeof this.cleanupTimer === "object" && "unref" in this.cleanupTimer) {
        this.cleanupTimer.unref();
      }
    }
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs?: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + (ttlMs || this.defaultTTL),
    });
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) this.cache.delete(key);
    }
  }
}

// Singleton instances
export const siteAnalysisCache = new AnalysisCache();
export const instagramAnalysisCache = new AnalysisCache();
export const dnaCache = new AnalysisCache(24 * 60 * 60 * 1000); // 24h para DNA

// Helper para gerar cache keys
export function cacheKey(...parts: string[]): string {
  return parts.filter(Boolean).join(":").toLowerCase();
}
