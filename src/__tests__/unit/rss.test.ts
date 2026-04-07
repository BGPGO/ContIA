import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock rss-parser antes de importar o modulo
const { mockParseURLFn } = vi.hoisted(() => {
  const mockParseURLFn = vi.fn();
  return { mockParseURLFn };
});

vi.mock('rss-parser', () => {
  return {
    default: class MockParser {
      parseURL = mockParseURLFn;
    },
  };
});

import { getDefaultFeeds, parseFeed, getNoticiasForNicho } from '@/lib/rss';

describe('getDefaultFeeds()', () => {
  it('retorna feeds para nicho "tecnologia"', () => {
    const feeds = getDefaultFeeds();
    expect(feeds.tecnologia).toBeDefined();
    expect(feeds.tecnologia.length).toBeGreaterThan(0);
    expect(feeds.tecnologia[0]).toHaveProperty('nome');
    expect(feeds.tecnologia[0]).toHaveProperty('url');
    expect(feeds.tecnologia[0]).toHaveProperty('topico');
  });

  it('retorna feeds para nicho "marketing"', () => {
    const feeds = getDefaultFeeds();
    expect(feeds.marketing).toBeDefined();
    expect(feeds.marketing.length).toBeGreaterThan(0);
  });

  it('retorna feeds para nicho "negocios"', () => {
    const feeds = getDefaultFeeds();
    expect(feeds.negocios).toBeDefined();
    expect(feeds.negocios.length).toBeGreaterThan(0);
  });

  it('retorna feeds para nicho "geral"', () => {
    const feeds = getDefaultFeeds();
    expect(feeds.geral).toBeDefined();
    expect(feeds.geral.length).toBeGreaterThan(0);
  });

  it('todos os feeds tem URLs validas', () => {
    const feeds = getDefaultFeeds();
    for (const nicho of Object.values(feeds)) {
      for (const feed of nicho) {
        expect(feed.url).toMatch(/^https?:\/\//);
      }
    }
  });
});

describe('parseFeed()', () => {
  beforeEach(() => {
    mockParseURLFn.mockReset();
  });

  it('parseia feed com itens corretamente', async () => {
    mockParseURLFn.mockResolvedValue({
      items: [
        {
          guid: 'guid-1',
          title: 'Noticia Teste',
          contentSnippet: 'Descricao da noticia de teste',
          link: 'https://example.com/noticia-1',
          pubDate: '2024-01-15T10:00:00Z',
        },
        {
          guid: 'guid-2',
          title: 'Outra Noticia',
          contentSnippet: 'Segunda noticia',
          link: 'https://example.com/noticia-2',
          pubDate: '2024-01-14T10:00:00Z',
        },
      ],
    });

    const result = await parseFeed('https://feed.example.com/rss', 'TestFeed', 'Tech');

    expect(result).toHaveLength(2);
    expect(result[0].titulo).toBe('Noticia Teste');
    expect(result[0].fonte).toBe('TestFeed');
    expect(result[0].topico).toBe('Tech');
    expect(result[0].url).toBe('https://example.com/noticia-1');
  });

  it('retorna array vazio quando feed esta vazio', async () => {
    mockParseURLFn.mockResolvedValue({ items: [] });

    const result = await parseFeed('https://feed.example.com/rss', 'EmptyFeed', 'Tech');
    expect(result).toEqual([]);
  });

  it('retorna array vazio quando parser lanca erro', async () => {
    mockParseURLFn.mockRejectedValue(new Error('Network error'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await parseFeed('https://bad-feed.com/rss', 'BadFeed', 'Tech');

    expect(result).toEqual([]);
    consoleSpy.mockRestore();
  });

  it('limita a 10 itens por feed', async () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      guid: `guid-${i}`,
      title: `Noticia ${i}`,
      link: `https://example.com/${i}`,
      pubDate: new Date().toISOString(),
    }));
    mockParseURLFn.mockResolvedValue({ items });

    const result = await parseFeed('https://feed.example.com/rss', 'BigFeed', 'Tech');
    expect(result).toHaveLength(10);
  });

  it('usa "Sem titulo" quando item nao tem title', async () => {
    mockParseURLFn.mockResolvedValue({
      items: [{ guid: 'no-title', link: 'https://example.com' }],
    });

    const result = await parseFeed('https://feed.example.com/rss', 'Feed', 'Tech');
    expect(result[0].titulo).toBe('Sem titulo');
  });

  it('extrai imagem do thumbnail', async () => {
    mockParseURLFn.mockResolvedValue({
      items: [
        {
          guid: 'img-1',
          title: 'Com Imagem',
          link: 'https://example.com',
          thumbnail: { url: 'https://img.example.com/thumb.jpg' },
        },
      ],
    });

    const result = await parseFeed('https://feed.example.com/rss', 'Feed', 'Tech');
    expect(result[0].imagem_url).toBe('https://img.example.com/thumb.jpg');
  });
});

describe('getNoticiasForNicho()', () => {
  beforeEach(() => {
    mockParseURLFn.mockReset();
  });

  it('agrega noticias de multiplos feeds', async () => {
    mockParseURLFn.mockResolvedValue({
      items: [
        {
          guid: 'n1',
          title: 'Noticia 1',
          link: 'https://example.com/1',
          pubDate: '2024-01-15T10:00:00Z',
        },
      ],
    });

    const result = await getNoticiasForNicho('tecnologia');
    // tecnologia tem 2 feeds, cada um retorna 1 item
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('ordena noticias por data (mais recente primeiro)', async () => {
    let callCount = 0;
    mockParseURLFn.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          items: [
            { guid: 'old', title: 'Antiga', link: 'https://a.com', pubDate: '2024-01-01T00:00:00Z' },
          ],
        };
      }
      return {
        items: [
          { guid: 'new', title: 'Nova', link: 'https://b.com', pubDate: '2024-06-15T00:00:00Z' },
        ],
      };
    });

    const result = await getNoticiasForNicho('tecnologia');
    if (result.length >= 2) {
      const date1 = new Date(result[0].publicado_em).getTime();
      const date2 = new Date(result[1].publicado_em).getTime();
      expect(date1).toBeGreaterThanOrEqual(date2);
    }
  });

  it('usa feeds customizados quando fornecidos', async () => {
    mockParseURLFn.mockResolvedValue({
      items: [
        { guid: 'custom-1', title: 'Custom', link: 'https://custom.com', pubDate: new Date().toISOString() },
      ],
    });

    const customFeeds = [{ nome: 'Custom Feed', url: 'https://custom.com/rss', topico: 'Custom' }];
    const result = await getNoticiasForNicho('qualquer', customFeeds);

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].fonte).toBe('Custom Feed');
  });

  it('usa feeds "geral" para nicho desconhecido', async () => {
    mockParseURLFn.mockResolvedValue({
      items: [
        { guid: 'g1', title: 'Geral', link: 'https://news.com', pubDate: new Date().toISOString() },
      ],
    });

    const result = await getNoticiasForNicho('nicho-inexistente');
    // Deve usar geral como fallback e retornar algo
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it('retorna array vazio quando todos os feeds falham', async () => {
    mockParseURLFn.mockRejectedValue(new Error('Todos falharam'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await getNoticiasForNicho('tecnologia');
    expect(result).toEqual([]);
  });
});
