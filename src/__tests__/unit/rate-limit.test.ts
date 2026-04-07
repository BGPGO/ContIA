import { describe, it, expect, vi, beforeEach } from 'vitest';

// Precisamos reimportar para cada teste ter um store limpo
// O modulo usa um Map global, entao vamos resetar via vi.resetModules
describe('checkRateLimit()', () => {
  let checkRateLimit: typeof import('@/lib/rate-limit').checkRateLimit;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/lib/rate-limit');
    checkRateLimit = mod.checkRateLimit;
  });

  it('primeira requisicao sempre passa', () => {
    expect(checkRateLimit('1.2.3.4', 'generate')).toBe(true);
  });

  it('requisicoes dentro do limite passam (generate: 20/min)', () => {
    for (let i = 0; i < 20; i++) {
      expect(checkRateLimit('10.0.0.1', 'generate')).toBe(true);
    }
  });

  it('requisicao que excede limite e bloqueada (generate)', () => {
    for (let i = 0; i < 20; i++) {
      checkRateLimit('blocked-ip', 'generate');
    }
    // 21a deve ser bloqueada
    expect(checkRateLimit('blocked-ip', 'generate')).toBe(false);
  });

  it('requisicao que excede limite e bloqueada (analyze: 5/min)', () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit('analyzer-ip', 'analyze')).toBe(true);
    }
    expect(checkRateLimit('analyzer-ip', 'analyze')).toBe(false);
  });

  it('IPs diferentes tem limites separados', () => {
    // Esgota limite do IP-A
    for (let i = 0; i < 5; i++) {
      checkRateLimit('ip-a', 'analyze');
    }
    expect(checkRateLimit('ip-a', 'analyze')).toBe(false);

    // IP-B ainda deve funcionar
    expect(checkRateLimit('ip-b', 'analyze')).toBe(true);
  });

  it('apos expiracao da janela, permite novamente', () => {
    vi.useFakeTimers();

    // Esgota o limite
    for (let i = 0; i < 5; i++) {
      checkRateLimit('expiry-ip', 'analyze');
    }
    expect(checkRateLimit('expiry-ip', 'analyze')).toBe(false);

    // Avanca 61 segundos (janela e de 60s)
    vi.advanceTimersByTime(61_000);
    expect(checkRateLimit('expiry-ip', 'analyze')).toBe(true);

    vi.useRealTimers();
  });

  it('tipos diferentes (generate vs analyze) nao interferem', () => {
    // Esgota analyze
    for (let i = 0; i < 5; i++) {
      checkRateLimit('multi-ip', 'analyze');
    }
    expect(checkRateLimit('multi-ip', 'analyze')).toBe(false);

    // Generate do mesmo IP ainda funciona
    expect(checkRateLimit('multi-ip', 'generate')).toBe(true);
  });
});

describe('getClientIp()', () => {
  let getClientIp: typeof import('@/lib/rate-limit').getClientIp;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/lib/rate-limit');
    getClientIp = mod.getClientIp;
  });

  it('extrai IP do header x-forwarded-for', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '203.0.113.50, 70.41.3.18' },
    });
    expect(getClientIp(req)).toBe('203.0.113.50');
  });

  it('extrai IP do header x-real-ip como fallback', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-real-ip': '192.0.2.1' },
    });
    expect(getClientIp(req)).toBe('192.0.2.1');
  });

  it('retorna "unknown" quando nenhum header esta presente', () => {
    const req = new Request('http://localhost');
    expect(getClientIp(req)).toBe('unknown');
  });
});
