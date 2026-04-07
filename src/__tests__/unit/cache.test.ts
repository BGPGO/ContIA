import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalysisCache, cacheKey } from '@/lib/cache';

describe('AnalysisCache', () => {
  let cache: AnalysisCache;

  beforeEach(() => {
    cache = new AnalysisCache(60_000); // 1 min TTL padrao
  });

  it('retorna null para chave inexistente', () => {
    expect(cache.get('nao-existe')).toBeNull();
  });

  it('armazena e recupera dados corretamente', () => {
    cache.set('key1', { nome: 'teste' });
    expect(cache.get('key1')).toEqual({ nome: 'teste' });
  });

  it('armazena strings', () => {
    cache.set('str', 'valor simples');
    expect(cache.get('str')).toBe('valor simples');
  });

  it('armazena arrays', () => {
    cache.set('arr', [1, 2, 3]);
    expect(cache.get('arr')).toEqual([1, 2, 3]);
  });

  it('retorna null apos expiracao do TTL', () => {
    vi.useFakeTimers();
    cache.set('expira', 'dado', 100); // TTL de 100ms
    expect(cache.get('expira')).toBe('dado');

    vi.advanceTimersByTime(150);
    expect(cache.get('expira')).toBeNull();
    vi.useRealTimers();
  });

  it('multiplas chaves nao interferem entre si', () => {
    cache.set('a', 'valor-a');
    cache.set('b', 'valor-b');
    cache.set('c', 'valor-c');

    expect(cache.get('a')).toBe('valor-a');
    expect(cache.get('b')).toBe('valor-b');
    expect(cache.get('c')).toBe('valor-c');
  });

  it('has() retorna false para chave inexistente', () => {
    expect(cache.has('ghost')).toBe(false);
  });

  it('has() retorna true para chave existente', () => {
    cache.set('existe', true);
    expect(cache.has('existe')).toBe(true);
  });

  it('has() retorna false apos expiracao', () => {
    vi.useFakeTimers();
    cache.set('ttl', 'x', 50);
    vi.advanceTimersByTime(100);
    expect(cache.has('ttl')).toBe(false);
    vi.useRealTimers();
  });

  it('invalidate() remove uma chave', () => {
    cache.set('remover', 'dados');
    cache.invalidate('remover');
    expect(cache.get('remover')).toBeNull();
  });

  it('clear() remove todas as chaves', () => {
    cache.set('x', 1);
    cache.set('y', 2);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('size retorna o numero de entradas', () => {
    expect(cache.size).toBe(0);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.size).toBe(2);
  });

  it('sobrescreve valor de chave existente', () => {
    cache.set('key', 'v1');
    cache.set('key', 'v2');
    expect(cache.get('key')).toBe('v2');
    expect(cache.size).toBe(1);
  });
});

describe('cacheKey()', () => {
  it('junta partes com ":"', () => {
    expect(cacheKey('site', 'https://example.com')).toBe('site:https://example.com');
  });

  it('converte para lowercase', () => {
    expect(cacheKey('SITE', 'Example.COM')).toBe('site:example.com');
  });

  it('filtra partes vazias', () => {
    expect(cacheKey('a', '', 'b')).toBe('a:b');
  });

  it('funciona com uma unica parte', () => {
    expect(cacheKey('solo')).toBe('solo');
  });

  it('funciona com varias partes', () => {
    expect(cacheKey('ns', 'tipo', 'id', 'extra')).toBe('ns:tipo:id:extra');
  });
});
