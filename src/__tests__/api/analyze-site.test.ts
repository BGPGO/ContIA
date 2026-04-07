import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, parseResponse } from '../helpers/api-test-utils';

vi.mock('@/lib/ai/config', () => ({
  isAIConfigured: vi.fn(),
  getOpenAIClient: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

vi.mock('@/lib/cache', () => {
  const cacheStore = new Map<string, any>();
  return {
    siteAnalysisCache: {
      get: vi.fn((key: string) => cacheStore.get(key) ?? null),
      set: vi.fn((key: string, data: any) => cacheStore.set(key, data)),
      clear: vi.fn(() => cacheStore.clear()),
    },
    cacheKey: vi.fn((...parts: string[]) => parts.join(':').toLowerCase()),
    __cacheStore: cacheStore,
  };
});

import { POST } from '@/app/api/ai/analyze-site/route';
import { isAIConfigured, getOpenAIClient } from '@/lib/ai/config';
import { checkRateLimit } from '@/lib/rate-limit';
import { siteAnalysisCache } from '@/lib/cache';

describe('POST /api/ai/analyze-site', () => {
  beforeEach(() => {
    vi.mocked(isAIConfigured).mockReturnValue(true);
    vi.mocked(checkRateLimit).mockReturnValue(true);
    vi.mocked(siteAnalysisCache.get).mockReturnValue(null);
  });

  it('retorna 503 se OpenAI nao esta configurado', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(false);

    const req = createMockRequest('/api/ai/analyze-site', {
      method: 'POST',
      body: { url: 'https://example.com' },
    });

    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(503);
    expect(body.error).toBe('AI not configured');
  });

  it('retorna 400 se URL esta faltando', async () => {
    const req = createMockRequest('/api/ai/analyze-site', {
      method: 'POST',
      body: {},
    });

    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body.error).toBeTruthy();
  });

  it('retorna 400 se URL e localhost (SSRF)', async () => {
    const req = createMockRequest('/api/ai/analyze-site', {
      method: 'POST',
      body: { url: 'http://localhost:3000/admin' },
    });

    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body.error).toBeTruthy();
  });

  it('retorna 400 se URL e IP privado (SSRF)', async () => {
    const req = createMockRequest('/api/ai/analyze-site', {
      method: 'POST',
      body: { url: 'http://192.168.1.1/admin' },
    });

    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body.error).toBeTruthy();
  });

  it('retorna cache hit quando disponivel', async () => {
    const cachedData = {
      resumo: 'Empresa de tecnologia',
      tom_de_voz: 'profissional',
      publico_alvo: 'desenvolvedores',
      palavras_chave: ['tech', 'dev'],
      proposta_valor: 'Melhor plataforma',
      cores_predominantes: ['#000', '#fff'],
    };

    vi.mocked(siteAnalysisCache.get).mockReturnValue(cachedData);

    const req = createMockRequest('/api/ai/analyze-site', {
      method: 'POST',
      body: { url: 'https://example.com' },
    });

    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body._cached).toBe(true);
    expect(body.resumo).toBe('Empresa de tecnologia');
  });
});
