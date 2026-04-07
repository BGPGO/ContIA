import { describe, it, expect, beforeEach } from 'vitest';
import {
  tokenize,
  termFrequency,
  cosineSimilarity,
  checkDuplicate,
  addToHistory,
  getHistorySize,
  clearHistory,
} from '@/lib/anti-duplicidade';

describe('tokenize()', () => {
  it('converte para lowercase e remove acentos', () => {
    const tokens = tokenize('Automação de Marketing');
    expect(tokens).toContain('automacao');
    expect(tokens).toContain('marketing');
  });

  it('remove pontuacao', () => {
    const tokens = tokenize('Olá, mundo! Como vai?');
    expect(tokens.every((t) => /^\w+$/.test(t))).toBe(true);
  });

  it('remove palavras curtas (<=2 caracteres)', () => {
    const tokens = tokenize('eu vi um boi no rio');
    // "eu" (2), "vi" (2), "um" (stopword+2), "boi" (3), "no" (stopword+2), "rio" (3)
    expect(tokens).not.toContain('eu');
    expect(tokens).not.toContain('vi');
    expect(tokens).toContain('boi');
    expect(tokens).toContain('rio');
  });

  it('remove stopwords em PT-BR', () => {
    const tokens = tokenize('para que você possa ter mais resultados');
    expect(tokens).not.toContain('para');
    expect(tokens).not.toContain('que');
    expect(tokens).not.toContain('mais');
    expect(tokens).toContain('resultados');
  });

  it('retorna array vazio para string vazia', () => {
    expect(tokenize('')).toEqual([]);
  });
});

describe('termFrequency()', () => {
  it('calcula frequencia normalizada pelo maximo', () => {
    const tf = termFrequency(['marketing', 'digital', 'marketing']);
    expect(tf.get('marketing')).toBe(1.0); // 2/2
    expect(tf.get('digital')).toBe(0.5);   // 1/2
  });

  it('retorna Map vazio para tokens vazios', () => {
    const tf = termFrequency([]);
    expect(tf.size).toBe(0);
  });

  it('token unico tem frequencia 1.0', () => {
    const tf = termFrequency(['unico']);
    expect(tf.get('unico')).toBe(1.0);
  });
});

describe('cosineSimilarity()', () => {
  it('retorna ~1.0 para vetores identicos', () => {
    const a = new Map([['marketing', 1.0], ['digital', 0.5]]);
    const b = new Map([['marketing', 1.0], ['digital', 0.5]]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 5);
  });

  it('retorna ~0.0 para vetores totalmente diferentes', () => {
    const a = new Map([['marketing', 1.0], ['digital', 0.5]]);
    const b = new Map([['culinaria', 1.0], ['receita', 0.5]]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 5);
  });

  it('retorna 0 quando um vetor esta vazio', () => {
    const a = new Map([['algo', 1.0]]);
    const b = new Map<string, number>();
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('retorna valor entre 0 e 1 para vetores parcialmente similares', () => {
    const a = new Map([['marketing', 1.0], ['digital', 0.5], ['redes', 0.3]]);
    const b = new Map([['marketing', 1.0], ['social', 0.5], ['redes', 0.3]]);
    const sim = cosineSimilarity(a, b);
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });
});

describe('checkDuplicate() e addToHistory()', () => {
  const EMPRESA = 'test-empresa';

  beforeEach(() => {
    clearHistory(EMPRESA);
  });

  it('retorna nao duplicado quando historico esta vazio', () => {
    const result = checkDuplicate(EMPRESA, 'Qualquer conteudo de marketing digital');
    expect(result.isDuplicate).toBe(false);
    expect(result.similarity).toBe(0);
    expect(result.similarPost).toBeUndefined();
  });

  it('detecta texto similar como duplicado', () => {
    const texto1 = 'Estratégias de marketing digital para aumentar vendas no Instagram em 2024';
    const texto2 = 'Estratégias de marketing digital para aumentar vendas no Instagram em 2025';

    addToHistory(EMPRESA, texto1);
    const result = checkDuplicate(EMPRESA, texto2);

    expect(result.isDuplicate).toBe(true);
    expect(result.similarity).toBeGreaterThan(75);
    expect(result.similarPost).toBeDefined();
  });

  it('permite textos completamente diferentes', () => {
    const texto1 = 'Dicas de culinária vegana para iniciantes com receitas fáceis e rápidas';
    const texto2 = 'Estratégias avançadas de investimento em criptomoedas e blockchain para lucrar';

    addToHistory(EMPRESA, texto1);
    const result = checkDuplicate(EMPRESA, texto2);

    expect(result.isDuplicate).toBe(false);
  });

  it('empresas diferentes tem historicos separados', () => {
    const empresaA = 'empresa-a';
    const empresaB = 'empresa-b';
    clearHistory(empresaA);
    clearHistory(empresaB);

    const texto = 'Conteudo sobre marketing digital e redes sociais para empresas';
    addToHistory(empresaA, texto);

    // empresa B nao tem historico, entao nao deve ser duplicado
    const result = checkDuplicate(empresaB, texto);
    expect(result.isDuplicate).toBe(false);

    clearHistory(empresaA);
    clearHistory(empresaB);
  });

  it('mantem limite de 100 posts no historico', () => {
    for (let i = 0; i < 110; i++) {
      addToHistory(EMPRESA, `Post unico numero ${i} sobre tema ${i * 37} diferente xyz${i}`);
    }
    expect(getHistorySize(EMPRESA)).toBe(100);
  });

  it('getHistorySize retorna 0 para empresa sem historico', () => {
    expect(getHistorySize('empresa-fantasma')).toBe(0);
  });

  it('clearHistory limpa corretamente', () => {
    addToHistory(EMPRESA, 'Algum conteudo para teste');
    expect(getHistorySize(EMPRESA)).toBe(1);
    clearHistory(EMPRESA);
    expect(getHistorySize(EMPRESA)).toBe(0);
  });
});
