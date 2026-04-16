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

/**
 * Tenta descobrir a URL do feed RSS a partir de uma URL de site.
 * Se a URL já for um feed válido, retorna ela mesma.
 *
 * Ordem: HTML <link> tag (mais rápido) → sufixos comuns → fallback URL original
 */
export async function discoverFeedUrl(url: string): Promise<string> {
  // Se já tem /feed, /rss, .xml, .atom — provavelmente é feed direto
  if (/\/(feed|rss|atom)|\.xml|\.rss|\.atom/i.test(url)) {
    return url;
  }

  // PRIMEIRO: buscar HTML e procurar <link rel="alternate" type="application/rss+xml">
  // Isso é rápido (1 request) e cobre casos como Valor Econômico (RSS em domínio diferente)
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ContIA/1.0)" },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });
    if (res.ok) {
      const html = await res.text();
      // Buscar tanto href antes quanto depois do type (ambos patterns são válidos em HTML)
      const rssLink =
        html.match(/<link[^>]+type=["']application\/rss\+xml["'][^>]+href=["']([^"']+)["']/i)?.[1] ||
        html.match(/<link[^>]+href=["']([^"']+)["'][^>]+type=["']application\/rss\+xml["']/i)?.[1];
      const atomLink =
        html.match(/<link[^>]+type=["']application\/atom\+xml["'][^>]+href=["']([^"']+)["']/i)?.[1] ||
        html.match(/<link[^>]+href=["']([^"']+)["'][^>]+type=["']application\/atom\+xml["']/i)?.[1];
      const discovered = rssLink || atomLink;
      if (discovered) {
        const fullUrl = discovered.startsWith("http") ? discovered : new URL(discovered, url).toString();
        console.log(`[rss] Discovered feed via HTML: ${fullUrl}`);
        return fullUrl;
      }
    }
  } catch { /* timeout ou erro de fetch — segue para próxima */ }

  // SEGUNDO: tentar sufixos comuns de RSS (com timeout curto de 5s cada)
  const base = url.replace(/\/$/, "");
  const candidates = [
    base + "/feed/",
    base + "/feed",
    base + "/rss",
    base + "/blog/feed/",
    base + "/rss.xml",
    base + "/atom.xml",
  ];

  for (const candidate of candidates) {
    try {
      const feed = await parser.parseURL(candidate);
      if (feed.items && feed.items.length > 0) {
        console.log(`[rss] Found feed via suffix: ${candidate}`);
        return candidate;
      }
    } catch {
      continue;
    }
  }

  console.log(`[rss] No feed found for ${url}, using URL as-is`);
  // Retorna URL original como fallback — parseFeed vai falhar e retornar []
  return url;
}

export async function parseFeed(feedUrl: string, fonte: string, topico: string): Promise<NoticiaItem[]> {
  try {
    // Tenta parsear direto; se falhar, tenta descobrir feed RSS
    let feed;
    try {
      feed = await parser.parseURL(feedUrl);
    } catch {
      const discoveredUrl = await discoverFeedUrl(feedUrl);
      if (discoveredUrl !== feedUrl) {
        feed = await parser.parseURL(discoveredUrl);
      } else {
        throw new Error(`URL nao eh feed RSS valido: ${feedUrl}`);
      }
    }
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
  // undefined  → empresa sem feeds custom, usar defaults por nicho
  // []         → empresa TEM feeds custom mas todos desativados, retornar vazio
  // [...items] → usar apenas os feeds ativos da empresa
  if (customFeeds !== undefined && customFeeds.length === 0) {
    return [];
  }

  const feeds = customFeeds !== undefined
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
