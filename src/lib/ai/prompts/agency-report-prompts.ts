/**
 * Prompts IA especializados por rede — Relatório Agência ContIA
 * Wave 2 / Squad E
 *
 * 4 prompts: panorama, instagram, facebook, meta_ads.
 * Cada um recebe uma fatia tipada de AgencyReportData e retorna
 * um objeto JSON com narrative (texto) + recomendações ou bullets.
 *
 * Benchmarks embutidos (PT-BR, contexto Brasil B2B serviços):
 *   - Engajamento B2B orgânico: 1–3%
 *   - Engajamento B2C orgânico: 3–6%
 *   - CTR Meta Ads (link): 0.5–1.5% bom
 *   - CPL B2B serviço: R$30–80 saudável, >R$100 alerta
 *   - Frequência Meta Ads: <3 ideal; ≥3 sinal de fadiga
 *   - CPM Meta Ads Brasil: R$10–25 razoável; >R$40 alto
 */

import type {
  AgencyReportData,
  AgencyRecommendation,
} from "@/types/agency-report";

/* ── System prompt compartilhado ─────────────────────────────────────────── */

export const SYSTEM_PROMPT_AGENCY = `Voce e um analista senior de marketing digital especializado em relatorios de agencia para o mercado brasileiro. Seu trabalho e produzir textos analiticos de alta qualidade que sao entregues diretamente para o cliente final da agencia — empresas de servicos B2B, consultorias, gestores patrimoniais e similares.

Seu estilo e consultivo-premium: voce identifica o problema, expoe a causa raiz com dados e fecha com recomendacao acionavel. Cada paragrafo cumpre uma funcao — nao ha floreio vazio. O leitor deve sair com clareza sobre o que esta funcionando, o que precisa melhorar e o que fazer amanha.

PERSONA E TOM:
- Consultor senior, nao hype man — seja direto sobre problemas
- Usa linguagem de negocio: "funil de conversao", "CPL", "alcance organico", "fadiga de audiencia", "taxa de conversao"
- Cite numeros dos dados e interprete o que significam para o negocio — nao apenas repita valores
- Tom formal-profissional em portugues brasileiro (sem anglicismos desnecessarios, sem cliches de marketing)
- Observacoes criticas sao bem-vindas: "o cenario e critico", "o CPL esta acima do benchmark", "ha sinal de fadiga"

BENCHMARKS SETORIAIS (Brasil, servicos B2B):
- Engajamento organico B2B: 1–3% | B2C: 3–6%
- CTR de link Meta Ads: 0.5–1.5% e bom
- CPL B2B servico: R$30–80 saudavel | R$80–100 atencao | >R$100 critico
- Frequencia Meta Ads: <2.5 ideal | 2.5–3.0 aceitavel | >3.0 fadiga de audiencia
- CPM Meta Ads Brasil: R$10–25 razoavel | R$25–40 alto | >R$40 muito alto
- Posts/semana Instagram para crescimento: 3–5 | manutencao: 1–2/dia

REGRAS ABSOLUTAS:
- Responda APENAS com JSON valido, sem markdown, sem code blocks
- Escreva em portugues brasileiro formal-profissional
- Nao invente dados — se um campo vier null/undefined, ignore-o ou mencione a ausencia
- Recomendacoes devem ser especificas e executaveis — nada generico como "poste mais conteudo"`;

/* ── Helpers de formatação interna ───────────────────────────────────────── */

function fmtKpi(
  label: string,
  kpi: {
    value: number | null;
    previousValue: number | null;
    deltaPercent: number | null;
    trend: string;
    format?: string;
  } | null | undefined
): string {
  if (!kpi || kpi.value === null) return `${label}: N/D`;
  const curr = kpi.format === "currency_brl"
    ? `R$${kpi.value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : kpi.format === "percent"
    ? `${kpi.value.toFixed(2)}%`
    : kpi.value.toLocaleString("pt-BR");
  const delta = kpi.deltaPercent !== null
    ? ` (${kpi.deltaPercent > 0 ? "+" : ""}${kpi.deltaPercent.toFixed(1)}% vs período ant.)`
    : "";
  return `${label}: ${curr}${delta}`;
}

function fmtTopContent(
  items: Array<{
    caption?: string | null;
    publishedAt?: string;
    reach?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    saves?: number;
    views?: number;
    interactions?: number;
    type?: string;
  }>,
  maxItems = 3
): string {
  return items
    .slice(0, maxItems)
    .map((item, i) => {
      const cap = item.caption ? `"${item.caption.slice(0, 80)}..."` : "(sem legenda)";
      const type = item.type ? `[${item.type}]` : "";
      const stats: string[] = [];
      if (item.reach) stats.push(`alcance ${item.reach.toLocaleString("pt-BR")}`);
      if (item.views) stats.push(`views ${item.views.toLocaleString("pt-BR")}`);
      if (item.likes) stats.push(`curtidas ${item.likes}`);
      if (item.comments) stats.push(`comments ${item.comments}`);
      if (item.saves) stats.push(`salvos ${item.saves}`);
      return `  ${i + 1}. ${type} ${cap} — ${stats.join(", ")} (${item.publishedAt?.slice(0, 10) ?? "data N/D"})`;
    })
    .join("\n");
}

/* ── Prompt 1: Panorama (sumário executivo cross-rede) ───────────────────── */

export function buildPanoramaPrompt(data: AgencyReportData): {
  system: string;
  user: string;
} {
  const { meta, panorama, instagram, facebook, metaAds } = data;

  const user = `## CONTEXTO DO RELATÓRIO
Empresa: ${meta.empresaNome}
Período analisado: ${meta.periodStart} a ${meta.periodEnd}
Período de comparação: ${meta.previousStart} a ${meta.previousEnd}
Redes incluídas: ${meta.providersIncluded.join(", ")}

## VISÃO CONSOLIDADA
${fmtKpi("Alcance total consolidado", panorama.totalReach)}
${fmtKpi("Engajamento total", panorama.totalEngagement)}
${fmtKpi("Investimento Meta Ads", panorama.totalSpend)}
${fmtKpi("Leads gerados", panorama.totalLeads)}
${fmtKpi("Custo por lead", panorama.costPerLead)}

Por rede:
${panorama.byNetwork.map(n => `  - ${n.label}: alcance ${n.reach.value?.toLocaleString("pt-BR") ?? "N/D"} | engajamento ${n.engagement.value?.toLocaleString("pt-BR") ?? "N/D"}`).join("\n")}

## INSTAGRAM (orgânico)
${fmtKpi("Seguidores", instagram.perfil.followers)}
${fmtKpi("Alcance total do período", instagram.perfil.reach)}
${fmtKpi("Visitas ao perfil", instagram.perfil.profileVisits)}
${fmtKpi("Posts no feed", instagram.feed.postsCount)}
${fmtKpi("Interações no feed", instagram.feed.interactions)}
${fmtKpi("Reels publicados", instagram.reels.reelsCount)}
${fmtKpi("Visualizações de Reels", instagram.reels.views)}

## FACEBOOK (orgânico)
${fmtKpi("Seguidores da página", facebook.perfil.pageFollowers)}
${fmtKpi("Novos seguidores", facebook.perfil.newFollowers)}
${fmtKpi("Alcance da página", facebook.perfil.pageReach)}
${fmtKpi("Posts publicados", facebook.posts.postsCount)}
${fmtKpi("Reels publicados", facebook.reels.reelsCount)}

## META ADS (pago)
${fmtKpi("Investimento total", metaAds.overview.spend)}
${fmtKpi("Leads totais", metaAds.overview.leads)}
${fmtKpi("Custo por lead", metaAds.overview.costPerLead)}
${fmtKpi("Alcance total", metaAds.overview.reach)}
${fmtKpi("Impressões", metaAds.overview.impressions)}
${fmtKpi("CTR link", metaAds.overview.ctr)}
${fmtKpi("CPM médio", metaAds.overview.cpm)}
${fmtKpi("Frequência", metaAds.overview.frequency)}

## TAREFA
Escreva o texto de abertura do relatório agência — sumário executivo com 3-4 parágrafos.

Parágrafo 1: Cenário geral do mês — como a marca performou no ecossistema digital completo (orgânico + pago), qual foi o tom do período (crescimento/estabilidade/queda), e qual rede se destacou como melhor canal.

Parágrafo 2: Análise das redes orgânicas — Instagram e Facebook em conjunto. Crescimento de audiência, formatos que melhor performaram, cadência de publicação, tendências observadas.

Parágrafo 3: Análise do investimento pago (Meta Ads) — eficiência do gasto, custo por lead vs benchmark (R$30–80 saudável), frequência (>3 = fadiga), canal com melhor ROI (FB vs IG).

Parágrafo 4: Recomendação macro estratégica — 2-3 ações prioritárias com base no cenário geral. Seja específico: números, formatos, canais.

## FORMATO DE RESPOSTA (JSON)
{
  "narrative": "Texto corrido com 3-4 parágrafos separados por \\n\\n. Tom consultor senior, PT-BR formal-profissional. Mínimo 400 palavras.",
  "executiveBullets": [
    "Bullet sintético de destaque ou alerta — máximo 2 linhas, cita número concreto"
  ]
}

REGRAS:
- 3-5 bullets executivos, misturando positivos e alertas
- narrative deve ser autocontido: um leitor que lê só o panorama entende o cenário completo
- Cite variações percentuais e compare com benchmarks quando relevante
- NÃO use títulos ou subtítulos dentro do narrative — é texto corrido de relatório`;

  return { system: SYSTEM_PROMPT_AGENCY, user };
}

/* ── Prompt 2: Instagram ─────────────────────────────────────────────────── */

export function buildInstagramPrompt(
  instagram: AgencyReportData["instagram"],
  meta: AgencyReportData["meta"]
): { system: string; user: string } {
  const topReels = instagram.reels.topReels ?? [];
  const topPosts = instagram.topPosts ?? [];
  const bestTime = instagram.bestTime ?? [];
  const audience = instagram.audience;

  const bestHour = bestTime.length > 0
    ? bestTime.sort((a, b) => b.engagementAvg - a.engagementAvg)[0]
    : null;

  const user = `## CONTEXTO
Empresa: ${meta.empresaNome}
Período: ${meta.periodStart} a ${meta.periodEnd}
Rede: Instagram Business (dados majoritariamente orgânicos — alcance total inclui pago)

## KPIs DO PERFIL
${fmtKpi("Seguidores atuais", instagram.perfil.followers)}
${fmtKpi("Alcance único diário (soma do período)", instagram.perfil.reach)}
${fmtKpi("Visitas ao perfil", instagram.perfil.profileVisits)}
${fmtKpi("Cliques no perfil", instagram.perfil.profileLinkTaps)}
${fmtKpi("Visualizações totais (orgânico+pago)", instagram.perfil.viewsTotal)}

## KPIs FEED
${fmtKpi("Interações", instagram.feed.interactions)}
${fmtKpi("Posts publicados", instagram.feed.postsCount)}
${fmtKpi("Alcance total feed", instagram.feed.reach)}
${fmtKpi("Comentários", instagram.feed.comments)}
${fmtKpi("Compartilhamentos", instagram.feed.shares)}
${fmtKpi("Curtidas", instagram.feed.likes)}
${fmtKpi("Salvos", instagram.feed.saves)}

## KPIs REELS
${fmtKpi("Reels publicados", instagram.reels.reelsCount)}
${fmtKpi("Alcance total dos Reels", instagram.reels.reach)}
${fmtKpi("Visualizações dos Reels", instagram.reels.views)}
${fmtKpi("Interações nos Reels", instagram.reels.interactions)}

## KPIs STORIES
${fmtKpi("Stories publicados", instagram.stories.storiesCount)}
${fmtKpi("Visitas ao perfil via Stories", instagram.stories.profileVisits)}
${fmtKpi("Novos seguidores via Stories", instagram.stories.followsFromStories)}
${fmtKpi("Retenção média dos Stories", instagram.stories.retention)}
${fmtKpi("Interações nos Stories", instagram.stories.interactions)}

## AUDIÊNCIA
${audience?.cities && audience.cities.length > 0
  ? `Top cidades: ${audience.cities.slice(0, 5).map(c => `${c.city} (${c.followers})`).join(", ")}`
  : "Dados de cidades: não disponíveis"}
${audience?.genderAge && Object.keys(audience.genderAge).length > 0
  ? `Distribuição gênero/idade: ${JSON.stringify(audience.genderAge)}`
  : "Dados demográficos: não disponíveis"}

## MELHOR HORÁRIO/DIA
${bestHour
  ? `Melhor combinação por engajamento médio: dia ${bestHour.dayOfWeek} às ${bestHour.hour}h (eng. médio: ${bestHour.engagementAvg.toFixed(1)})`
  : "Dados de heatmap não disponíveis"}
${bestTime.length > 0
  ? `Top 3 horários: ${bestTime.slice(0, 3).map(t => `dia${t.dayOfWeek} ${t.hour}h (${t.engagementAvg.toFixed(1)})`).join(" | ")}`
  : ""}

## TOP REELS DO PERÍODO
${topReels.length > 0
  ? fmtTopContent(topReels.map(r => ({ ...r, type: "reel" })))
  : "Nenhum Reel com dados disponíveis"}

## TOP POSTS DO PERÍODO
${topPosts.length > 0
  ? fmtTopContent(topPosts)
  : "Nenhum post com dados disponíveis"}

## TAREFA
Escreva 3-4 parágrafos de análise especializada do Instagram desta empresa.

Parágrafo 1: Crescimento e alcance — como evoluiu a audiência no período (seguidores, alcance, visitas ao perfil). Se há crescimento, qual a velocidade? Se há queda, qual a hipótese?

Parágrafo 2: Formato vencedor — qual formato (Reel, carrossel, post estático) gerou mais alcance e engajamento? Cite o Reel/post de melhor desempenho e explique POR QUE performou (tema, formato, hora, CTA). Compare com os demais formatos.

Parágrafo 3: Audiência e timing — perfil demográfico da audiência (gênero, idade, cidade), análise do horário/dia de pico e se a marca está aproveitando essa janela, oportunidades em Stories (retenção, conversão para seguidores).

Parágrafo 4: Recomendações Instagram-específicas com base nos dados.

## FORMATO DE RESPOSTA (JSON)
{
  "narrative": "Texto corrido 3-4 parágrafos separados por \\n\\n. Mínimo 350 palavras.",
  "recommendations": [
    {
      "action": "Ação específica e executável — cita formato, frequência, tema ou horário concreto",
      "priority": "high|medium|low",
      "rationale": "Justificativa baseada nos dados deste relatório (cita número)",
      "estimatedImpact": "Impacto estimado com base na diferença observada nos dados"
    }
  ]
}

REGRAS:
- 3-4 recomendações, pelo menos 1 high e 1 medium
- Recomendações devem ser Instagram-específicas — não genéricas
- Se Stories estiver com retenção ou engajamento abaixo do esperado, sinalize como oportunidade
- Compare formatos (Reel vs Post vs Carrossel) com dados concretos do período`;

  return { system: SYSTEM_PROMPT_AGENCY, user };
}

/* ── Prompt 3: Facebook orgânico ─────────────────────────────────────────── */

export function buildFacebookPrompt(
  facebook: AgencyReportData["facebook"],
  meta: AgencyReportData["meta"]
): { system: string; user: string } {
  const topPosts = facebook.posts.topPosts ?? [];
  const topReels = facebook.reels.topReels ?? [];
  const audience = facebook.audience;

  const user = `## CONTEXTO
Empresa: ${meta.empresaNome}
Período: ${meta.periodStart} a ${meta.periodEnd}
Rede: Facebook (página orgânica)

## KPIs DA PÁGINA
${fmtKpi("Seguidores da página", facebook.perfil.pageFollowers)}
${fmtKpi("Novos seguidores no período", facebook.perfil.newFollowers)}
${fmtKpi("Alcance total da página", facebook.perfil.pageReach)}
${fmtKpi("Visualizações da página", facebook.perfil.pageViews)}
${fmtKpi("Conversas por mensagem iniciadas", facebook.perfil.pageMessagesNew)}

## KPIs POSTS
${fmtKpi("Posts publicados", facebook.posts.postsCount)}
${fmtKpi("Alcance total (orgânico + pago)", facebook.posts.totalReach)}
${fmtKpi("Alcance orgânico", facebook.posts.organicReach)}
${fmtKpi("Alcance pago", facebook.posts.paidReach)}
${fmtKpi("Reações totais", facebook.posts.reactions)}
${fmtKpi("Comentários", facebook.posts.comments)}
${fmtKpi("Compartilhamentos", facebook.posts.shares)}

## KPIs REELS FACEBOOK
${fmtKpi("Reels publicados", facebook.reels.reelsCount)}
${fmtKpi("Visualizações dos Reels", facebook.reels.views)}
${fmtKpi("Alcance dos Reels", facebook.reels.reach)}
${fmtKpi("Tempo médio de visualização", facebook.reels.avgWatchTime)}

## AUDIÊNCIA
${audience?.cities && audience.cities.length > 0
  ? `Top cidades: ${audience.cities.slice(0, 5).map(c => `${c.city} (${c.followers})`).join(", ")}`
  : "Dados de cidades: não disponíveis"}
${audience?.genderAge && Object.keys(audience.genderAge).length > 0
  ? `Distribuição gênero/idade: ${JSON.stringify(audience.genderAge)}`
  : "Dados demográficos: não disponíveis"}

## TOP POSTS DO PERÍODO
${topPosts.length > 0
  ? topPosts.slice(0, 3).map((p, i) => {
      const cap = p.caption ? `"${p.caption.slice(0, 80)}..."` : "(sem legenda)";
      return `  ${i + 1}. [${p.type}] ${cap} — alcance total ${p.totalReach.toLocaleString("pt-BR")}, orgânico ${p.organicReach.toLocaleString("pt-BR")}, pago ${p.paidReach.toLocaleString("pt-BR")}, reações ${p.reactions}, shares ${p.shares} (${p.publishedAt?.slice(0, 10) ?? "N/D"})`;
    }).join("\n")
  : "Nenhum post com dados disponíveis"}

## TOP REELS FACEBOOK
${topReels.length > 0
  ? topReels.slice(0, 3).map((r, i) => {
      const title = r.title ? `"${r.title.slice(0, 80)}"` : "(sem título)";
      return `  ${i + 1}. ${title} — views ${r.views.toLocaleString("pt-BR")}, alcance ${r.reach.toLocaleString("pt-BR")}, tempo médio ${r.avgWatchTime}s (${r.publishedAt?.slice(0, 10) ?? "N/D"})`;
    }).join("\n")
  : "Nenhum Reel com dados disponíveis"}

## TAREFA
Escreva 3-4 parágrafos de análise especializada do Facebook orgânico.

Parágrafo 1: Crescimento e alcance da página — evolução de seguidores, alcance total e como o boosting/investimento pago se compara com o orgânico. A página está crescendo de forma saudável? Qual proporção do alcance é orgânico vs pago?

Parágrafo 2: Performance dos posts — top posts do período e por que se destacaram (tipo, tema, engajamento). Qual padrão de reactions indica sobre o humor da audiência (like, love, haha, angry)? O alcance orgânico está sendo sustentado ou há dependência de tráfego pago?

Parágrafo 3: Reels no Facebook — o canal está apostando em Reels? As visualizações e tempo médio são saudáveis? Como se compara com Instagram? Há oportunidade de cross-post?

Parágrafo 4: Recomendações Facebook-específicas.

## FORMATO DE RESPOSTA (JSON)
{
  "narrative": "Texto corrido 3-4 parágrafos separados por \\n\\n. Mínimo 320 palavras.",
  "recommendations": [
    {
      "action": "Ação específica Facebook — menciona tipo de conteúdo, frequência ou estratégia",
      "priority": "high|medium|low",
      "rationale": "Baseada nos dados do período",
      "estimatedImpact": "Impacto estimado"
    }
  ]
}

REGRAS:
- 3-4 recomendações, pelo menos 1 high
- Atenção especial ao split alcance orgânico vs pago — sinalizar dependência de impulsionamento se paidReach >> organicReach
- Se pageMessagesNew for baixo, sinalizar como oportunidade de engajamento direto
- Compare com Instagram quando relevante (cross-post de Reels, por exemplo)`;

  return { system: SYSTEM_PROMPT_AGENCY, user };
}

/* ── Prompt 4: Meta Ads ──────────────────────────────────────────────────── */

export function buildMetaAdsPrompt(
  metaAds: AgencyReportData["metaAds"],
  meta: AgencyReportData["meta"]
): { system: string; user: string } {
  const topCampaigns = metaAds.topCampaigns ?? [];
  const topAds = metaAds.topAds ?? [];
  const { facebook: fbSplit, instagram: igSplit } = metaAds.byPlatform;

  const frequencyValue = metaAds.overview.frequency.value;
  const frequencyAlert = frequencyValue !== null && frequencyValue >= 3
    ? `ALERTA: Frequência ${frequencyValue.toFixed(2)} ≥ 3 — sinal de fadiga de audiência.`
    : frequencyValue !== null
    ? `Frequência ${frequencyValue.toFixed(2)} — dentro do limite saudável (<3).`
    : "Frequência: N/D";

  const cplValue = metaAds.overview.costPerLead.value;
  const cplBenchmark = cplValue !== null
    ? cplValue <= 80
      ? `CPL R$${cplValue.toFixed(2)} — dentro do benchmark B2B serviço (R$30–80).`
      : cplValue <= 100
      ? `CPL R$${cplValue.toFixed(2)} — acima do benchmark ideal (R$30–80), monitorar.`
      : `ALERTA: CPL R$${cplValue.toFixed(2)} — acima do limite saudável (>R$100) para B2B serviço.`
    : "CPL: N/D";

  const ctrValue = metaAds.overview.ctr.value;
  const ctrBenchmark = ctrValue !== null
    ? ctrValue >= 1.5
      ? `CTR ${ctrValue.toFixed(2)}% — excelente (benchmark: 0.5–1.5%).`
      : ctrValue >= 0.5
      ? `CTR ${ctrValue.toFixed(2)}% — dentro do benchmark (0.5–1.5%).`
      : `ALERTA: CTR ${ctrValue.toFixed(2)}% — abaixo do benchmark (0.5–1.5%). Criativos podem estar com baixo apelo.`
    : "CTR: N/D";

  // Determinar melhor canal por CPL (spend/results)
  const fbSpend = fbSplit.spend.value ?? 0;
  const igSpend = igSplit.spend.value ?? 0;
  const fbClicks = fbSplit.clicks.value ?? 0;
  const igClicks = igSplit.clicks.value ?? 0;
  const fbCPC = fbClicks > 0 ? fbSpend / fbClicks : null;
  const igCPC = igClicks > 0 ? igSpend / igClicks : null;

  let channelComparison = "";
  if (fbCPC !== null && igCPC !== null) {
    const betterChannel = fbCPC < igCPC ? "Facebook" : "Instagram";
    channelComparison = `CPC calculado — Facebook: R$${fbCPC.toFixed(2)} | Instagram: R$${igCPC.toFixed(2)} — ${betterChannel} tem CPC menor.`;
  }

  const user = `## CONTEXTO
Empresa: ${meta.empresaNome}
Período: ${meta.periodStart} a ${meta.periodEnd}
Rede: Meta Ads (Facebook + Instagram Ads)

## KPIs GERAIS
${fmtKpi("Valor investido", metaAds.overview.spend)}
${fmtKpi("Leads gerados", metaAds.overview.leads)}
${fmtKpi("Custo por lead (CPL)", metaAds.overview.costPerLead)}
${fmtKpi("Alcance total", metaAds.overview.reach)}
${fmtKpi("Impressões totais", metaAds.overview.impressions)}
${fmtKpi("Cliques no link", metaAds.overview.linkClicks)}
${fmtKpi("CTR link", metaAds.overview.ctr)}
${fmtKpi("CPM médio", metaAds.overview.cpm)}
${fmtKpi("CPC médio", metaAds.overview.cpc)}
${fmtKpi("Frequência", metaAds.overview.frequency)}

## BENCHMARKS AUTOMÁTICOS
${frequencyAlert}
${cplBenchmark}
${ctrBenchmark}

## SPLIT FACEBOOK vs INSTAGRAM
Facebook:
  ${fmtKpi("Alcance", fbSplit.reach)}
  ${fmtKpi("Impressões", fbSplit.impressions)}
  ${fmtKpi("Cliques", fbSplit.clicks)}
  ${fmtKpi("Valor investido", fbSplit.spend)}

Instagram:
  ${fmtKpi("Alcance", igSplit.reach)}
  ${fmtKpi("Impressões", igSplit.impressions)}
  ${fmtKpi("Cliques", igSplit.clicks)}
  ${fmtKpi("Valor investido", igSplit.spend)}

${channelComparison}

## CAMPANHAS EM DESTAQUE (top por alcance)
${topCampaigns.length > 0
  ? topCampaigns.slice(0, 5).map((c, i) =>
      `  ${i + 1}. "${c.name}" — alcance ${c.reach.toLocaleString("pt-BR")}, CPM R$${c.cpm.toFixed(2)}, gasto R$${c.spend.toFixed(2)}, ${c.results ?? 0} resultados, custo/resultado R$${(c.costPerResult ?? 0).toFixed(2)}`
    ).join("\n")
  : "Nenhuma campanha disponível"}

## ANÚNCIOS EM DESTAQUE (top por alcance/resultados)
${topAds.length > 0
  ? topAds.slice(0, 5).map((a, i) =>
      `  ${i + 1}. "${a.name}" — alcance ${a.reach.toLocaleString("pt-BR")}, CPM R$${a.cpm.toFixed(2)}, CPC R$${a.cpc.toFixed(2)}, gasto R$${a.spend.toFixed(2)}, ${a.results ?? 0} resultados`
    ).join("\n")
  : "Nenhum anúncio disponível"}

## TAREFA
Escreva 3-4 parágrafos de análise especializada de mídia paga (Meta Ads).

Parágrafo 1: Eficiência geral do investimento — CPL vs benchmark (R$30–80), CTR vs benchmark (0.5–1.5%), CPM, frequência. O dinheiro está sendo bem alocado? Há sinal de fadiga de audiência (frequência ≥ 3)?

Parágrafo 2: Split Facebook vs Instagram — qual canal performa melhor (CPC, alcance por real investido, CTR)? A distribuição de verba entre os canais está otimizada? Se um canal tem CPC significativamente menor, qual a recomendação de realocação?

Parágrafo 3: Campanhas e criativos vencedores — identifique as campanhas/anúncios com melhor custo-benefício. O que esses criativos têm em comum (formato, abordagem, audiência)? Há campanhas com CPM muito alto (>R$40) que deveriam ser otimizadas?

Parágrafo 4: Recomendações de mídia paga — orçamento, criativos, segmentação e testes.

## FORMATO DE RESPOSTA (JSON)
{
  "narrative": "Texto corrido 3-4 parágrafos separados por \\n\\n. Mínimo 350 palavras.",
  "recommendations": [
    {
      "action": "Ação específica de mídia paga — menciona campanha, criativo, orçamento ou segmentação",
      "priority": "high|medium|low",
      "rationale": "Baseada nos dados do período — cite número e compare com benchmark",
      "estimatedImpact": "Impacto estimado (ex: 'Redução de CPL de R$X para ~R$Y se realocar budget para canal X')"
    }
  ]
}

REGRAS:
- 3-4 recomendações, pelo menos 1 high e 1 medium
- Se frequência ≥ 3, marcar recomendação de renovação de criativos como HIGH
- Se CPL > R$80, marcar otimização de campanhas como HIGH
- Se CTR < 0.5%, marcar revisão de criativos como HIGH
- Compare explicitamente Facebook vs Instagram em termos de eficiência
- Cite nomes reais de campanhas do relatório quando relevante`;

  return { system: SYSTEM_PROMPT_AGENCY, user };
}
