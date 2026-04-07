import { describe, it, expect } from 'vitest';
import { cn, formatNumber, getPlataformaCor, getPlataformaLabel } from '@/lib/utils';

describe('cn()', () => {
  it('combina classes simples', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('faz merge de classes conflitantes do Tailwind', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });

  it('ignora null e undefined', () => {
    expect(cn('foo', null, undefined, 'bar')).toBe('foo bar');
  });

  it('ignora valores falsy (false, 0, "")', () => {
    expect(cn('foo', false, '', 'bar')).toBe('foo bar');
  });

  it('retorna string vazia sem argumentos', () => {
    expect(cn()).toBe('');
  });

  it('suporta condicionais com clsx syntax', () => {
    expect(cn('base', { active: true, hidden: false })).toBe('base active');
  });
});

describe('formatNumber()', () => {
  it('retorna "0" para zero', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('retorna numero simples abaixo de 1000', () => {
    expect(formatNumber(42)).toBe('42');
    expect(formatNumber(999)).toBe('999');
  });

  it('formata milhares com "K"', () => {
    expect(formatNumber(1000)).toBe('1.0K');
    expect(formatNumber(1500)).toBe('1.5K');
    expect(formatNumber(10000)).toBe('10.0K');
    expect(formatNumber(999999)).toBe('1000.0K');
  });

  it('formata milhoes com "M"', () => {
    expect(formatNumber(1000000)).toBe('1.0M');
    expect(formatNumber(2500000)).toBe('2.5M');
    expect(formatNumber(10000000)).toBe('10.0M');
  });
});

describe('getPlataformaCor()', () => {
  it('retorna cor correta para instagram', () => {
    expect(getPlataformaCor('instagram')).toBe('#e1306c');
  });

  it('retorna cor correta para facebook', () => {
    expect(getPlataformaCor('facebook')).toBe('#1877f2');
  });

  it('retorna cor correta para linkedin', () => {
    expect(getPlataformaCor('linkedin')).toBe('#0a66c2');
  });

  it('retorna cor correta para twitter', () => {
    expect(getPlataformaCor('twitter')).toBe('#1da1f2');
  });

  it('retorna cor correta para youtube', () => {
    expect(getPlataformaCor('youtube')).toBe('#ff0000');
  });

  it('retorna cor correta para tiktok', () => {
    expect(getPlataformaCor('tiktok')).toBe('#00f2ea');
  });

  it('retorna cor padrao para plataforma desconhecida', () => {
    expect(getPlataformaCor('snapchat')).toBe('#6c5ce7');
    expect(getPlataformaCor('')).toBe('#6c5ce7');
  });
});

describe('getPlataformaLabel()', () => {
  it('retorna label para instagram', () => {
    expect(getPlataformaLabel('instagram')).toBe('Instagram');
  });

  it('retorna label para facebook', () => {
    expect(getPlataformaLabel('facebook')).toBe('Facebook');
  });

  it('retorna label para linkedin', () => {
    expect(getPlataformaLabel('linkedin')).toBe('LinkedIn');
  });

  it('retorna label para twitter', () => {
    expect(getPlataformaLabel('twitter')).toBe('X (Twitter)');
  });

  it('retorna label para youtube', () => {
    expect(getPlataformaLabel('youtube')).toBe('YouTube');
  });

  it('retorna label para tiktok', () => {
    expect(getPlataformaLabel('tiktok')).toBe('TikTok');
  });

  it('retorna o proprio nome para plataforma desconhecida', () => {
    expect(getPlataformaLabel('snapchat')).toBe('snapchat');
    expect(getPlataformaLabel('pinterest')).toBe('pinterest');
  });
});
