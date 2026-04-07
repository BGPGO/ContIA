import { describe, it, expect } from 'vitest';
import {
  generateSchema,
  imageSchema,
  analyzeSiteSchema,
  analyzeInstagramSchema,
  formatZodError,
} from '@/lib/validation';

describe('generateSchema', () => {
  it('aceita payload valido completo', () => {
    const result = generateSchema.safeParse({
      format: 'post',
      topic: 'Marketing digital para pequenas empresas',
      tone: 'profissional',
      plataformas: ['instagram', 'linkedin'],
    });
    expect(result.success).toBe(true);
  });

  it('aceita payload minimo (apenas format e topic)', () => {
    const result = generateSchema.safeParse({
      format: 'reels',
      topic: 'IA generativa',
    });
    expect(result.success).toBe(true);
  });

  it('rejeita sem topic', () => {
    const result = generateSchema.safeParse({
      format: 'post',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita com topic vazio', () => {
    const result = generateSchema.safeParse({
      format: 'post',
      topic: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita sem format', () => {
    const result = generateSchema.safeParse({
      topic: 'Algo interessante',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita com format vazio', () => {
    const result = generateSchema.safeParse({
      format: '',
      topic: 'Algo',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita topic com mais de 1000 caracteres', () => {
    const result = generateSchema.safeParse({
      format: 'post',
      topic: 'x'.repeat(1001),
    });
    expect(result.success).toBe(false);
  });
});

describe('imageSchema', () => {
  it('aceita payload com prompt', () => {
    const result = imageSchema.safeParse({
      prompt: 'Um gato usando oculos escuros',
    });
    expect(result.success).toBe(true);
  });

  it('rejeita sem prompt', () => {
    const result = imageSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejeita com prompt vazio', () => {
    const result = imageSchema.safeParse({ prompt: '' });
    expect(result.success).toBe(false);
  });

  it('aceita size valido 1024x1024', () => {
    const result = imageSchema.safeParse({
      prompt: 'teste',
      size: '1024x1024',
    });
    expect(result.success).toBe(true);
  });

  it('aceita size valido 1024x1792', () => {
    const result = imageSchema.safeParse({
      prompt: 'teste',
      size: '1024x1792',
    });
    expect(result.success).toBe(true);
  });

  it('aceita size valido 1792x1024', () => {
    const result = imageSchema.safeParse({
      prompt: 'teste',
      size: '1792x1024',
    });
    expect(result.success).toBe(true);
  });

  it('rejeita size invalido', () => {
    const result = imageSchema.safeParse({
      prompt: 'teste',
      size: '512x512',
    });
    expect(result.success).toBe(false);
  });

  it('usa 1024x1024 como size padrao', () => {
    const result = imageSchema.safeParse({ prompt: 'teste' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.size).toBe('1024x1024');
    }
  });

  it('rejeita prompt com mais de 2000 caracteres', () => {
    const result = imageSchema.safeParse({
      prompt: 'x'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

describe('analyzeSiteSchema', () => {
  it('aceita URL valida http', () => {
    const result = analyzeSiteSchema.safeParse({
      url: 'http://example.com',
    });
    expect(result.success).toBe(true);
  });

  it('aceita URL valida https', () => {
    const result = analyzeSiteSchema.safeParse({
      url: 'https://www.google.com',
    });
    expect(result.success).toBe(true);
  });

  it('rejeita localhost', () => {
    const result = analyzeSiteSchema.safeParse({
      url: 'http://localhost:3000',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita 127.0.0.1', () => {
    const result = analyzeSiteSchema.safeParse({
      url: 'http://127.0.0.1',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita IP privado 192.168.x.x', () => {
    const result = analyzeSiteSchema.safeParse({
      url: 'http://192.168.1.1',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita IP privado 10.x.x.x', () => {
    const result = analyzeSiteSchema.safeParse({
      url: 'http://10.0.0.1',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita IP privado 172.16.x.x', () => {
    const result = analyzeSiteSchema.safeParse({
      url: 'http://172.16.0.1',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita protocolo file://', () => {
    const result = analyzeSiteSchema.safeParse({
      url: 'file:///etc/passwd',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita protocolo ftp://', () => {
    const result = analyzeSiteSchema.safeParse({
      url: 'ftp://example.com/file',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita URL invalida', () => {
    const result = analyzeSiteSchema.safeParse({
      url: 'nao-eh-url',
    });
    expect(result.success).toBe(false);
  });
});

describe('analyzeInstagramSchema', () => {
  it('aceita username valido', () => {
    const result = analyzeInstagramSchema.safeParse({
      username: 'bgpgo_oficial',
    });
    expect(result.success).toBe(true);
  });

  it('aceita username com @', () => {
    const result = analyzeInstagramSchema.safeParse({
      username: '@bgpgo',
    });
    expect(result.success).toBe(true);
  });

  it('aceita username com pontos e underscores', () => {
    const result = analyzeInstagramSchema.safeParse({
      username: 'user.name_123',
    });
    expect(result.success).toBe(true);
  });

  it('rejeita username vazio', () => {
    const result = analyzeInstagramSchema.safeParse({
      username: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita sem campo username', () => {
    const result = analyzeInstagramSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejeita username com caracteres invalidos', () => {
    const result = analyzeInstagramSchema.safeParse({
      username: 'user name!',
    });
    expect(result.success).toBe(false);
  });
});

describe('formatZodError()', () => {
  it('formata erro de validacao corretamente', () => {
    const result = generateSchema.safeParse({});
    if (!result.success) {
      const msg = formatZodError(result.error);
      expect(msg.length).toBeGreaterThan(0); // mensagem de erro nao vazia
    }
  });
});
