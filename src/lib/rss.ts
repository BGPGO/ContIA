import Parser from 'rss-parser';

const parser = new Parser({
  timeout: 10000,
  customFields: {
    item: [['content:encoded', 'fullContent'], ['media:thumbnail', 'thumbnail']],
  },
});

export interface NoticiaItem {
  id: string;
  titulo: string;
  descricao: string;
  url: string;
  fonte: string;
  topico: string;
  publicado_em: string;
  imagem_url: string | null;
}

// Feeds padrao por nicho
const DEFAULT_FEEDS: Record<string, Array<{ nome: string; url: string; topico: string }>> = {
  tecnologia: [
    { nome: 'TechCrunch', url: 'https://techcrunch.com/feed/', topico: 'Tech' },
    { nome: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', topico: 'Tech' },
  ],
  marketing: [
    { nome: 'HubSpot Blog', url: 'https://blog.hubspot.com/marketing/rss.xml', topico: 'Marketing' },
    { nome: 'Content Marketing Institute', url: 'https://contentmarketinginstitute.com/feed/', topico: 'Marketing' },
  ],
  negocios: [
    { nome: 'Forbes', url: 'https://www.forbes.com/innovation/feed/', topico: 'Negocios' },
  ],
  geral: [
    { nome: 'Google News BR', url: 'https://news.google.com/rss?hl=pt-BR&gl=BR&ceid=BR:pt-419', topico: 'Geral' },
  ],
};

export async function parseFeed(feedUrl: string, fonte: string, topico: string): Promise<NoticiaItem[]> {
  try {
    const feed = await parser.parseURL(feedUrl);
    return (feed.items || []).slice(0, 10).map((item) => ({
      id: item.guid || item.link || `${fonte}-${Date.now()}-${Math.random()}`,
      titulo: item.title || 'Sem titulo',
      descricao: item.contentSnippet?.substring(0, 200) || item.content?.substring(0, 200) || '',
      url: item.link || '',
      fonte,
      topico,
      publicado_em: item.pubDate || new Date().toISOString(),
      imagem_url: extractImage(item) || null,
    }));
  } catch (error) {
    console.error(`Erro ao parsear feed ${feedUrl}:`, error);
    return [];
  }
}

function extractImage(item: Record<string, any>): string | null {
  if (item.thumbnail?.url) return item.thumbnail.url;
  if (item.enclosure?.url) return item.enclosure.url;
  // Tentar extrair imagem do content
  const match = item.fullContent?.match(/<img[^>]+src="([^">]+)"/);
  return match ? match[1] : null;
}

export async function getNoticiasForNicho(
  nicho: string,
  customFeeds?: Array<{ nome: string; url: string; topico: string }>
): Promise<NoticiaItem[]> {
  const feeds = customFeeds?.length
    ? customFeeds
    : (DEFAULT_FEEDS[nicho.toLowerCase()] || DEFAULT_FEEDS.geral);

  const results = await Promise.allSettled(
    feeds.map((f) => parseFeed(f.url, f.nome, f.topico))
  );

  const allNoticias = results
    .filter((r): r is PromiseFulfilledResult<NoticiaItem[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value);

  // Ordenar por data (mais recentes primeiro)
  return allNoticias.sort(
    (a, b) => new Date(b.publicado_em).getTime() - new Date(a.publicado_em).getTime()
  );
}

export function getDefaultFeeds(): Record<string, Array<{ nome: string; url: string; topico: string }>> {
  return DEFAULT_FEEDS;
}
