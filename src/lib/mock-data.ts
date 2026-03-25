import { Empresa, Post, Concorrente, Noticia, AnalyticsData, DadoDiario } from "@/types";

export const empresasMock: Empresa[] = [
  {
    id: "1",
    nome: "TechFlow Solutions",
    descricao: "Empresa de soluções tecnológicas B2B focada em automação e IA para PMEs",
    nicho: "Tecnologia / SaaS",
    logo_url: null,
    website: "https://techflow.com.br",
    instagram_handle: "techflow.br",
    concorrentes_ig: ["automai.tech", "digitalboost.br"],
    referencias_ig: ["rockcontent", "resultadosdigitais"],
    referencias_sites: ["https://rockcontent.com", "https://resultadosdigitais.com.br"],
    cor_primaria: "#6c5ce7",
    cor_secundaria: "#a29bfe",
    redes_sociais: {
      instagram: { conectado: true, username: "@techflow.br" },
      linkedin: { conectado: true, username: "techflow-solutions" },
      facebook: { conectado: false, username: "" },
      twitter: { conectado: true, username: "@techflow_br" },
    },
    config_rss: [
      { nome: "TechCrunch", url: "https://techcrunch.com/feed/", topico: "Tecnologia", ativo: true },
      { nome: "Startup Brasil", url: "https://startupbrasil.com/feed/", topico: "Startups", ativo: true },
    ],
    created_at: "2024-01-15",
    updated_at: "2024-03-20",
  },
  {
    id: "2",
    nome: "Café Artesanal Moenda",
    descricao: "Rede de cafeterias artesanais premium com foco em experiência e sustentabilidade",
    nicho: "Alimentação / Cafeteria",
    logo_url: null,
    website: "https://cafemoenda.com.br",
    instagram_handle: "cafemoenda",
    concorrentes_ig: ["starbucksbrasil", "coffeetown.br"],
    referencias_ig: ["nespresso", "specialtycoffee"],
    referencias_sites: ["https://perfectdailygrind.com"],
    cor_primaria: "#e17055",
    cor_secundaria: "#fab1a0",
    redes_sociais: {
      instagram: { conectado: true, username: "@cafemoenda" },
      facebook: { conectado: true, username: "cafemoenda" },
      tiktok: { conectado: true, username: "@cafemoenda" },
    },
    config_rss: [
      { nome: "Food Magazine", url: "https://foodmag.com/rss", topico: "Gastronomia", ativo: true },
    ],
    created_at: "2024-02-10",
    updated_at: "2024-03-18",
  },
];

const hoje = new Date();
const formatDate = (d: Date) => d.toISOString().split("T")[0];
const daysAgo = (n: number) => {
  const d = new Date(hoje);
  d.setDate(d.getDate() - n);
  return d;
};
const daysFromNow = (n: number) => {
  const d = new Date(hoje);
  d.setDate(d.getDate() + n);
  return d;
};

export const postsMock: Post[] = [
  {
    id: "p1", empresa_id: "1", titulo: "5 formas de usar IA no seu negócio",
    conteudo: "A inteligência artificial está transformando a forma como empresas operam...",
    midia_url: null, plataformas: ["instagram", "linkedin"], status: "publicado",
    agendado_para: null, publicado_em: formatDate(daysAgo(2)), tematica: "Educacional",
    metricas: { impressoes: 4520, curtidas: 312, comentarios: 45, compartilhamentos: 89, cliques: 230, alcance: 3800 },
    created_at: formatDate(daysAgo(3)),
  },
  {
    id: "p2", empresa_id: "1", titulo: "Case: como automatizamos 80% do atendimento",
    conteudo: "Nosso cliente XYZ reduziu custos em 40% com automação inteligente...",
    midia_url: null, plataformas: ["linkedin"], status: "publicado",
    agendado_para: null, publicado_em: formatDate(daysAgo(5)), tematica: "Case",
    metricas: { impressoes: 8900, curtidas: 567, comentarios: 123, compartilhamentos: 234, cliques: 456, alcance: 7200 },
    created_at: formatDate(daysAgo(6)),
  },
  {
    id: "p3", empresa_id: "1", titulo: "Webinar: O futuro da automação em 2026",
    conteudo: "Participe do nosso webinar gratuito sobre tendências de automação...",
    midia_url: null, plataformas: ["instagram", "linkedin", "twitter"], status: "agendado",
    agendado_para: formatDate(daysFromNow(2)), publicado_em: null, tematica: "Evento",
    metricas: null, created_at: formatDate(daysAgo(1)),
  },
  {
    id: "p4", empresa_id: "1", titulo: "Dica rápida: 3 prompts para produtividade",
    conteudo: "Use esses 3 prompts no seu dia a dia para triplicar sua produtividade...",
    midia_url: null, plataformas: ["instagram", "twitter"], status: "agendado",
    agendado_para: formatDate(daysFromNow(4)), publicado_em: null, tematica: "Dica",
    metricas: null, created_at: formatDate(hoje),
  },
  {
    id: "p5", empresa_id: "1", titulo: "Bastidores: nosso escritório em SP",
    conteudo: "Um tour pelo nosso espaço de inovação em São Paulo...",
    midia_url: null, plataformas: ["instagram", "tiktok"], status: "rascunho",
    agendado_para: null, publicado_em: null, tematica: "Bastidores",
    metricas: null, created_at: formatDate(hoje),
  },
  {
    id: "p6", empresa_id: "1", titulo: "Nova parceria com XYZ Corp",
    conteudo: "Temos o prazer de anunciar nossa parceria estratégica...",
    midia_url: null, plataformas: ["linkedin", "instagram"], status: "agendado",
    agendado_para: formatDate(daysFromNow(1)), publicado_em: null, tematica: "Institucional",
    metricas: null, created_at: formatDate(hoje),
  },
  {
    id: "p7", empresa_id: "2", titulo: "Novo blend: Cerrado Mineiro edição limitada",
    conteudo: "Acabou de chegar nosso blend exclusivo direto das montanhas de Minas...",
    midia_url: null, plataformas: ["instagram", "facebook", "tiktok"], status: "publicado",
    agendado_para: null, publicado_em: formatDate(daysAgo(1)), tematica: "Produto",
    metricas: { impressoes: 12500, curtidas: 890, comentarios: 234, compartilhamentos: 156, cliques: 345, alcance: 10200 },
    created_at: formatDate(daysAgo(2)),
  },
  {
    id: "p8", empresa_id: "2", titulo: "Receita: Cold Brew com especiarias",
    conteudo: "Aprenda a fazer nosso cold brew signature em casa...",
    midia_url: null, plataformas: ["instagram", "tiktok"], status: "agendado",
    agendado_para: formatDate(daysFromNow(3)), publicado_em: null, tematica: "Receita",
    metricas: null, created_at: formatDate(hoje),
  },
];

export const concorrentesMock: Concorrente[] = [
  {
    id: "c1", empresa_id: "1", nome: "AutomAI Solutions",
    plataformas: [
      {
        rede: "linkedin", username: "automai-solutions", seguidores: 15200,
        taxa_engajamento: 3.2, freq_postagem: "4x/semana",
        posts_recentes: [
          { conteudo: "Como a IA generativa está mudando o mercado B2B", data: formatDate(daysAgo(1)), curtidas: 234, comentarios: 45, compartilhamentos: 67 },
          { conteudo: "Nosso novo produto de automação de vendas", data: formatDate(daysAgo(3)), curtidas: 189, comentarios: 34, compartilhamentos: 52 },
        ],
      },
      {
        rede: "instagram", username: "@automai.tech", seguidores: 8400,
        taxa_engajamento: 4.1, freq_postagem: "5x/semana",
        posts_recentes: [
          { conteudo: "Reel: IA no dia a dia do empresário", data: formatDate(daysAgo(1)), curtidas: 567, comentarios: 89, compartilhamentos: 123 },
        ],
      },
    ],
    created_at: "2024-01-20",
  },
  {
    id: "c2", empresa_id: "1", nome: "Digital Boost BR",
    plataformas: [
      {
        rede: "instagram", username: "@digitalboost.br", seguidores: 23500,
        taxa_engajamento: 5.4, freq_postagem: "7x/semana",
        posts_recentes: [
          { conteudo: "Carrossel: 10 ferramentas de IA gratuitas", data: formatDate(daysAgo(0)), curtidas: 1230, comentarios: 156, compartilhamentos: 345 },
        ],
      },
    ],
    created_at: "2024-02-05",
  },
];

export const noticiasMock: Noticia[] = [
  { id: "n1", titulo: "OpenAI lança novo modelo com capacidades de raciocínio avançado", fonte: "TechCrunch", url: "#", resumo: "O novo modelo promete revolucionar a forma como empresas utilizam IA para tomada de decisão, com melhorias significativas em análise de dados.", topico: "Inteligência Artificial", publicado_em: formatDate(daysAgo(0)), imagem_url: null },
  { id: "n2", titulo: "Brasil atinge marca de 100 mil startups ativas", fonte: "Exame", url: "#", resumo: "O ecossistema de startups brasileiro continua em crescimento acelerado, com destaque para fintechs e healthtechs.", topico: "Startups", publicado_em: formatDate(daysAgo(0)), imagem_url: null },
  { id: "n3", titulo: "Meta anuncia novas ferramentas para criadores de conteúdo", fonte: "The Verge", url: "#", resumo: "Instagram e Facebook ganham recursos de IA para edição de imagens e geração de legendas automáticas.", topico: "Redes Sociais", publicado_em: formatDate(daysAgo(1)), imagem_url: null },
  { id: "n4", titulo: "LinkedIn reporta aumento de 40% em engajamento com vídeos curtos", fonte: "Social Media Today", url: "#", resumo: "A plataforma profissional vê crescimento expressivo no formato de vídeos curtos, seguindo tendência do mercado.", topico: "Redes Sociais", publicado_em: formatDate(daysAgo(1)), imagem_url: null },
  { id: "n5", titulo: "Estudo revela que 78% dos consumidores preferem marcas com presença ativa em redes sociais", fonte: "HubSpot", url: "#", resumo: "Pesquisa global mostra a importância crescente de uma presença consistente em múltiplas plataformas.", topico: "Marketing Digital", publicado_em: formatDate(daysAgo(2)), imagem_url: null },
  { id: "n6", titulo: "Google atualiza algoritmo: conteúdo gerado por IA será avaliado por qualidade", fonte: "Search Engine Journal", url: "#", resumo: "A atualização foca em recompensar conteúdo útil independentemente de ser gerado por humanos ou IA.", topico: "SEO", publicado_em: formatDate(daysAgo(2)), imagem_url: null },
];

export function getAnalyticsMock(empresaId: string): AnalyticsData {
  // Seed-based pseudo-random for consistent data across renders
  const seed = empresaId === "1" ? 42 : 77;
  function seededRandom(i: number) {
    const x = Math.sin(seed + i * 9301 + 49297) * 233280;
    return x - Math.floor(x);
  }

  const baseSeguidores = empresaId === "1" ? 23200 : 43500;
  const baseImpressoes = empresaId === "1" ? 2800 : 4200;
  const baseInteracoes = empresaId === "1" ? 180 : 320;

  const dados_diarios: DadoDiario[] = Array.from({ length: 30 }, (_, i) => {
    // Trend: gradual growth with weekly patterns (weekends dip)
    const dayOfWeek = new Date(daysAgo(29 - i)).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const trendMultiplier = 1 + (i / 30) * 0.25; // 25% growth over the month
    const weekendDip = isWeekend ? 0.65 : 1;
    const noise = 0.7 + seededRandom(i) * 0.6;

    const impressoes = Math.floor(baseImpressoes * trendMultiplier * weekendDip * noise);
    const interacoes = Math.floor(baseInteracoes * trendMultiplier * weekendDip * (0.8 + seededRandom(i + 100) * 0.5));
    const engajamento = parseFloat(((interacoes / Math.max(impressoes, 1)) * 100).toFixed(1));
    const seguidores_novos = Math.floor((15 + seededRandom(i + 200) * 45) * trendMultiplier * weekendDip);
    const seguidores_total = 0; // will be fixed in cumulative pass below

    return {
      data: formatDate(daysAgo(29 - i)),
      impressoes,
      engajamento,
      seguidores_novos,
      interacoes,
      seguidores_total,
    };
  });

  // Fix seguidores_total to be cumulative
  let runningTotal = baseSeguidores;
  for (const d of dados_diarios) {
    runningTotal += d.seguidores_novos;
    d.seguidores_total = runningTotal;
  }

  return {
    total_impressoes: dados_diarios.reduce((a, b) => a + b.impressoes, 0),
    taxa_engajamento: parseFloat((dados_diarios.reduce((a, b) => a + b.engajamento, 0) / dados_diarios.length).toFixed(1)),
    crescimento_seguidores: parseFloat((((runningTotal - baseSeguidores) / baseSeguidores) * 100).toFixed(1)),
    total_seguidores: runningTotal,
    melhores_posts: postsMock.filter((p) => p.empresa_id === empresaId && p.status === "publicado"),
    dados_diarios,
  };
}
