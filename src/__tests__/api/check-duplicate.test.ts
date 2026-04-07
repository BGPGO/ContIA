import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, parseResponse } from '../helpers/api-test-utils';

// Usamos o modulo real de anti-duplicidade para testar a integracao
// mas limpamos o historico entre testes
vi.mock('@/lib/anti-duplicidade', async () => {
  const actual = await vi.importActual<typeof import('@/lib/anti-duplicidade')>('@/lib/anti-duplicidade');
  return actual;
});

import { POST } from '@/app/api/ai/check-duplicate/route';
import { addToHistory, clearHistory } from '@/lib/anti-duplicidade';

const TEST_EMPRESA = 'empresa-test-dup';

describe('POST /api/ai/check-duplicate', () => {
  beforeEach(() => {
    clearHistory(TEST_EMPRESA);
  });

  it('retorna 400 sem content', async () => {
    const req = createMockRequest('/api/ai/check-duplicate', {
      method: 'POST',
      body: { empresaId: TEST_EMPRESA },
    });

    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body.error).toContain('obrigat');
  });

  it('retorna 400 sem empresaId', async () => {
    const req = createMockRequest('/api/ai/check-duplicate', {
      method: 'POST',
      body: { content: 'Conteudo de teste para verificacao' },
    });

    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body.error).toContain('obrigat');
  });

  it('retorna 400 com conteudo muito curto', async () => {
    const req = createMockRequest('/api/ai/check-duplicate', {
      method: 'POST',
      body: { empresaId: TEST_EMPRESA, content: 'curto' },
    });

    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body.error).toContain('curto');
  });

  it('retorna isDuplicate false para primeiro post', async () => {
    const req = createMockRequest('/api/ai/check-duplicate', {
      method: 'POST',
      body: {
        empresaId: TEST_EMPRESA,
        content: 'Este e um conteudo completamente novo sobre marketing digital para empresas de tecnologia',
      },
    });

    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.isDuplicate).toBe(false);
    expect(body.similarity).toBe(0);
  });

  it('retorna isDuplicate true apos adicionar post similar', async () => {
    const conteudoOriginal =
      'Estrategias avancadas de marketing digital para empresas de tecnologia que querem crescer no mercado brasileiro com inovacao e resultados comprovados';

    // Adicionar post ao historico primeiro
    addToHistory(TEST_EMPRESA, conteudoOriginal);

    // Verificar conteudo muito similar (mesmo texto com pequenas alteracoes)
    const req = createMockRequest('/api/ai/check-duplicate', {
      method: 'POST',
      body: {
        empresaId: TEST_EMPRESA,
        content:
          'Estrategias avancadas de marketing digital para empresas de tecnologia que querem crescer no mercado brasileiro com inovacao e resultados incriveis',
      },
    });

    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.isDuplicate).toBe(true);
    expect(body.similarity).toBeGreaterThan(75);
    expect(body.similarPost).toBeDefined();
  });
});
