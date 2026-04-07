import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, parseResponse } from '../helpers/api-test-utils';

// Mocks devem ser declarados antes dos imports do modulo testado
vi.mock('@/lib/ai/config', () => ({
  isAIConfigured: vi.fn(),
  getOpenAIClient: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

vi.mock('@/lib/anti-duplicidade', () => ({
  checkDuplicate: vi.fn(() => ({ isDuplicate: false, similarity: 0 })),
  addToHistory: vi.fn(),
}));

vi.mock('@/lib/ai/prompts', () => ({
  getPromptForFormat: vi.fn(() => 'prompt mock'),
  getTemperature: vi.fn(() => 0.7),
  getMaxTokens: vi.fn(() => 2000),
  getSystemPrompt: vi.fn(() => 'system prompt mock'),
}));

import { POST } from '@/app/api/ai/generate/route';
import { isAIConfigured, getOpenAIClient } from '@/lib/ai/config';
import { checkRateLimit } from '@/lib/rate-limit';
import { checkDuplicate } from '@/lib/anti-duplicidade';

describe('POST /api/ai/generate', () => {
  beforeEach(() => {
    vi.mocked(isAIConfigured).mockReturnValue(true);
    vi.mocked(checkRateLimit).mockReturnValue(true);
    vi.mocked(checkDuplicate).mockReturnValue({ isDuplicate: false, similarity: 0 });
  });

  it('retorna 503 se OpenAI nao esta configurado', async () => {
    vi.mocked(isAIConfigured).mockReturnValue(false);

    const req = createMockRequest('/api/ai/generate', {
      method: 'POST',
      body: { format: 'post', topic: 'teste' },
    });

    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(503);
    expect(body.error).toBe('AI not configured');
  });

  it('retorna 429 se rate limit excedido', async () => {
    vi.mocked(checkRateLimit).mockReturnValue(false);

    const req = createMockRequest('/api/ai/generate', {
      method: 'POST',
      body: { format: 'post', topic: 'teste' },
    });

    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(429);
    expect(body.error).toContain('Limite de requisicoes');
  });

  it('retorna 400 se topic esta faltando', async () => {
    const req = createMockRequest('/api/ai/generate', {
      method: 'POST',
      body: { format: 'post' },
    });

    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body.error).toContain('topic');
  });

  it('retorna 400 se format esta faltando', async () => {
    const req = createMockRequest('/api/ai/generate', {
      method: 'POST',
      body: { topic: 'algo interessante' },
    });

    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body.error).toContain('format');
  });

  it('retorna 200 com payload valido e mock da OpenAI', async () => {
    const mockContent = {
      titulo: 'Post sobre tecnologia',
      conteudo: 'Conteudo gerado pela IA sobre tecnologia moderna',
      hashtags: ['#tech', '#ia'],
    };

    vi.mocked(getOpenAIClient).mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify(mockContent) } }],
          }),
        },
      },
    } as any);

    const req = createMockRequest('/api/ai/generate', {
      method: 'POST',
      body: { format: 'post', topic: 'tecnologia' },
    });

    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.titulo).toBe('Post sobre tecnologia');
    expect(body.conteudo).toContain('tecnologia');
  });

  it('response inclui campo duplicidade quando conteudo e similar', async () => {
    vi.mocked(checkDuplicate).mockReturnValue({
      isDuplicate: true,
      similarity: 85,
      similarPost: 'Post anterior sobre o mesmo tema',
    });

    const mockContent = {
      titulo: 'Post duplicado',
      conteudo: 'Conteudo muito similar ao anterior',
    };

    vi.mocked(getOpenAIClient).mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify(mockContent) } }],
          }),
        },
      },
    } as any);

    const req = createMockRequest('/api/ai/generate', {
      method: 'POST',
      body: { format: 'post', topic: 'tema repetido' },
    });

    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.duplicidade).toBeDefined();
    expect(body.duplicidade.alerta).toBe(true);
    expect(body.duplicidade.similaridade).toBe('85%');
    expect(body.duplicidade.postSimilar).toBe('Post anterior sobre o mesmo tema');
  });
});
