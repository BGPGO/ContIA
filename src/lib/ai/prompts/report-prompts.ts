/**
 * Templates de prompts para geracao de relatorios IA.
 * Cada funcao retorna { system, user } para a chamada OpenAI.
 *
 * v2 — enriquecido com metricas pre-calculadas de marketing digital:
 * performance por tipo, CTAs, hashtags, frequencia, engagement breakdown.
 */

import type { ProviderKey } from "@/types/providers";
import type { Comparison, ReportType } from "@/types/reports";
import type {
  ContentPerformance,
  CaptionAnalysis,
  EngagementBreakdown,
  PostingFrequency,
  GrowthMetrics,
} from "../report-aggregator";
import type {
  AttributionTotals,
  ChannelROI,
  CampaignAttribution,
  FunnelEndToEndStage,
} from "@/types/attribution";

/* ── Types internos ──────────────────────────────────────────────────────── */

export interface PromptDataInput {
  empresaName: string;
  reportType: ReportType;
  periodLabel: string;
  providers: ProviderKey[];
  aggregated: Record<
    string,
    {
      totalEngagement: number;
      avgEngagement: number;
      contentCount: number;
      followers?: number;
      topMetrics: Record<string, number>;
    }
  >;
  topContent: Array<{
    provider: string;
    title: string | null;
    caption: string | null;
    type: string;
    engagement: number;
    metrics: Record<string, number>;
  }>;
  outliers: {
    high: Array<{ provider: string; title: string | null; engagement: number }>;
    low: Array<{ provider: string; title: string | null; engagement: number }>;
  };
  empresaDna?: Record<string, unknown>;

  // Enriched analysis data (v2)
  contentPerformance?: ContentPerformance;
  captionAnalysis?: CaptionAnalysis;
  engagementBreakdown?: EngagementBreakdown;
  postingFrequency?: PostingFrequency;
  growthMetrics?: GrowthMetrics;

  // Attribution cross-channel (v3)
  attributionTotals?: AttributionTotals;
  channelROI?: ChannelROI[];
  campaignAttribution?: CampaignAttribution[];
  funnelEndToEnd?: FunnelEndToEndStage[];
}

/* ── System prompt compartilhado ─────────────────────────────────────────── */

const SYSTEM_PROMPT = `Voce e um analista senior de marketing digital com 10+ anos de experiencia em social media, especializado em analise de performance de conteudo, estrategia de engajamento e growth hacking para Instagram, Facebook, LinkedIn e YouTube.

Seu estilo e o de um consultor premium: claro, direto, baseado em dados, com recomendacoes acionaveis e exemplos concretos. Voce nao repete numeros — voce INTERPRETA o que eles significam para o negocio.

REGRAS:
- Escreva em portugues brasileiro formal-profissional (sem marketez cliche, sem exageros)
- Tom de analista consultor, nao hypeman — seja honesto sobre problemas
- Cite numeros concretos dos dados fornecidos e INTERPRETE o que significam
- Recomendacoes devem ser especificas e executaveis com EXEMPLOS concretos
- Compare metricas com benchmarks do setor quando relevante (B2B: 1-3%, B2C: 3-6% engagement rate)
- Responda APENAS com JSON valido, sem markdown, sem code blocks`;

/* ── Helpers para formatar dados enriquecidos ────────────────────────────── */

function formatCrossChannelAttribution(
  totals?: AttributionTotals,
  channelROI?: ChannelROI[],
  campaigns?: CampaignAttribution[],
  funnel?: FunnelEndToEndStage[]
): string {
  if (!totals && !channelROI && !campaigns && !funnel) return "";

  const lines: string[] = ["\n## ATRIBUICAO CROSS-CHANNEL (CRM + Meta Ads)"];

  if (totals) {
    const roasStr = totals.roas !== null ? `${totals.roas.toFixed(2)}x` : "N/D";
    const cacStr = totals.cac !== null ? `R$${totals.cac.toFixed(0)}` : "N/D";
    const ticketStr = totals.avgTicket !== null ? `R$${totals.avgTicket.toFixed(0)}` : "N/D";
    const matchPct = (totals.matchRate * 100).toFixed(0);
    const funnelRate =
      totals.leads > 0
        ? ((totals.dealsWon / totals.leads) * 100).toFixed(1)
        : "0.0";

    lines.push("### Totais do Periodo");
    lines.push(`  - Investimento Meta Ads: R$${totals.spend.toFixed(0)}`);
    lines.push(`  - Leads CRM: ${totals.leads}`);
    lines.push(`  - Vendas: ${totals.dealsWon}`);
    lines.push(`  - Receita gerada: R$${totals.revenue.toFixed(0)}`);
    lines.push(`  - ROAS real: ${roasStr}`);
    lines.push(`  - CAC: ${cacStr}`);
    lines.push(`  - Ticket medio: ${ticketStr}`);
    lines.push(`  - Taxa lead→fechamento: ${funnelRate}% (${totals.dealsWon}/${totals.leads})`);
    lines.push(`  - Match rate leads rastreados: ${matchPct}% dos leads com UTM cruzam com campanha Meta`);
    lines.push(`  - Ciclo medio lead→venda: ${totals.avgLeadToWon_days.toFixed(0)} dias`);
  }

  if (channelROI && channelROI.length > 0) {
    lines.push("### ROI por Canal");
    const sorted = [...channelROI].sort((a, b) => b.leads - a.leads).slice(0, 6);
    for (const ch of sorted) {
      const roasTxt = ch.roas !== null ? ` ROAS ${ch.roas.toFixed(2)}x` : "";
      const convTxt = `conv ${(ch.conversionRate * 100).toFixed(1)}%`;
      lines.push(
        `  - ${ch.source}: ${ch.leads} leads, ${ch.dealsWon} vendas, R$${ch.revenue.toFixed(0)} receita,${roasTxt} ${convTxt}`
      );
    }
  }

  if (campaigns && campaigns.length > 0) {
    const top = campaigns
      .filter((c) => c.matched)
      .sort((a, b) => (b.roas ?? -1) - (a.roas ?? -1))
      .slice(0, 5);
    if (top.length > 0) {
      lines.push("### Top Campanhas por ROAS");
      for (const c of top) {
        const roasTxt = c.roas !== null ? `ROAS ${c.roas.toFixed(2)}x` : "sem receita";
        lines.push(
          `  - ${c.campaignName}: ${c.crmLeads} leads, ${c.crmDealsWon} vendas, R$${c.spend.toFixed(0)} gasto, ${roasTxt}`
        );
      }
    }
  }

  if (funnel && funnel.length > 0) {
    lines.push("### Funil Cumulativo");
    for (const stage of funnel) {
      const convTopTxt =
        stage.conversionFromTop !== undefined
          ? ` (${(stage.conversionFromTop * 100).toFixed(1)}% do topo)`
          : "";
      const lostTxt = stage.isLost ? " [PERDIDOS — nao cumulativo]" : "";
      lines.push(`  - ${stage.label}: ${stage.count}${convTopTxt}${lostTxt}`);
    }
  }

  return lines.join("\n");
}

function formatContentPerformance(perf: ContentPerformance | undefined): string {
  if (!perf) return "";

  const typeTable = perf.byType
    .map((t) => `  - ${t.type}: ${t.count} posts, eng medio ${t.avgEngagement}${t.bestPost ? `, melhor: "${t.bestPost}"` : ""}`)
    .join("\n");

  const bestDays = perf.byDayOfWeek
    .filter((d) => d.postCount > 0)
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, 3)
    .map((d) => `  - ${d.day}: eng medio ${d.avgEngagement} (${d.postCount} posts)`)
    .join("\n");

  const bestHours = perf.byHour
    .slice(0, 5)
    .map((h) => `  - ${h.hour}h: eng medio ${h.avgEngagement} (${h.postCount} posts)`)
    .join("\n");

  return `
## PERFORMANCE POR TIPO DE CONTEUDO
${typeTable}

## MELHORES DIAS DA SEMANA (por engajamento medio)
${bestDays}

## MELHORES HORARIOS (por engajamento medio)
${bestHours}`;
}

function formatCaptionAnalysis(ca: CaptionAnalysis | undefined): string {
  if (!ca) return "";

  const ctaDiff =
    ca.ctaEngagementAvg > 0 && ca.noCtaEngagementAvg > 0
      ? Math.round(((ca.ctaEngagementAvg - ca.noCtaEngagementAvg) / ca.noCtaEngagementAvg) * 100)
      : 0;
  const ctaEffect = ctaDiff > 0 ? `+${ctaDiff}%` : `${ctaDiff}%`;

  const topTags = ca.topHashtags
    .slice(0, 10)
    .map((h) => `  - ${h.tag}: ${h.count}x usado, eng medio ${h.avgEngagement}`)
    .join("\n");

  return `
## ANALISE DE CAPTIONS E CTAs
- Tamanho medio dos captions: ${ca.avgLength} caracteres
- Posts com CTA: ${ca.withCTA} (eng medio: ${ca.ctaEngagementAvg})
- Posts sem CTA: ${ca.withoutCTA} (eng medio: ${ca.noCtaEngagementAvg})
- Impacto dos CTAs no engajamento: ${ctaEffect}
- Posts com hashtags: ${ca.withHashtags} (media de ${ca.avgHashtagCount} hashtags/post)

## TOP HASHTAGS (por engajamento medio)
${topTags || "  Nenhuma hashtag encontrada"}`;
}

function formatEngagementBreakdown(eb: EngagementBreakdown | undefined): string {
  if (!eb) return "";

  return `
## ENGAGEMENT DETALHADO
- Likes medio: ${eb.avgLikes}
- Comments medio: ${eb.avgComments}
- Saves medio: ${eb.avgSaves}
- Shares medio: ${eb.avgShares}
- Engagement rate: ${eb.engagementRate}%
- Ratio likes/comments: ${eb.likesToCommentsRatio} ${eb.likesToCommentsRatio > 50 ? "(ALTO — audiencia passiva, pouca interacao)" : eb.likesToCommentsRatio > 20 ? "(moderado)" : "(saudavel — boa interacao)"}`;
}

function formatPostingFrequency(pf: PostingFrequency | undefined): string {
  if (!pf) return "";

  const gapText = pf.longestGap
    ? `${pf.longestGap.days} dias (de ${pf.longestGap.from} a ${pf.longestGap.to})`
    : "N/A";

  return `
## FREQUENCIA DE POSTAGEM
- Posts/semana: ${pf.postsPerWeek}
- Maior gap sem postar: ${gapText}
- Dia mais ativo: ${pf.mostActiveDay}
- Dia menos ativo: ${pf.leastActiveDay}`;
}

function formatGrowthMetrics(gm: GrowthMetrics | undefined): string {
  if (!gm || (gm.followerGrowthRate === 0 && gm.projectedFollowers30d === 0)) return "";

  return `
## CRESCIMENTO
- Taxa de crescimento de seguidores no periodo: ${gm.followerGrowthRate}%
- Projecao de seguidores em 30 dias: ${gm.projectedFollowers30d}`;
}

/* ── Prompt 1: Summary + Highlights + Recommendations ───────────────────── */

export function buildSummaryHighlightsRecommendationsPrompt(input: PromptDataInput) {
  const user = `## CONTEXTO
Empresa: ${input.empresaName}
Relatorio: ${REPORT_TYPE_LABELS[input.reportType]}
Periodo: ${input.periodLabel}
Plataformas: ${input.providers.join(", ")}
${input.empresaDna ? `DNA da Marca: ${JSON.stringify(input.empresaDna).slice(0, 500)}` : ""}

## DADOS AGREGADOS POR PLATAFORMA
${JSON.stringify(input.aggregated, null, 2)}

## TOP CONTEUDOS (por engajamento)
${JSON.stringify(input.topContent, null, 2)}

## OUTLIERS
Posts acima da media: ${JSON.stringify(input.outliers.high)}
Posts abaixo da media: ${JSON.stringify(input.outliers.low)}
${formatContentPerformance(input.contentPerformance)}
${formatCaptionAnalysis(input.captionAnalysis)}
${formatEngagementBreakdown(input.engagementBreakdown)}
${formatPostingFrequency(input.postingFrequency)}
${formatGrowthMetrics(input.growthMetrics)}
${formatCrossChannelAttribution(input.attributionTotals, input.channelROI, input.campaignAttribution, input.funnelEndToEnd)}

## REGRAS DE ANALISE (nivel especialista em marketing digital)

1. TOP 3 POSTS: Para cada um dos melhores posts, explique POR QUE performou bem — analise formato, horario de publicacao, uso de CTA, hashtags, tom do caption, apelo visual.

2. ESTRATEGIA DE CTAs: Os CTAs estao sendo efetivos? Quais patterns funcionam melhor? Se posts com CTA tem engajamento maior/menor, explique por que e sugira melhorias.

3. MIX DE FORMATOS: Avalie a proporcao entre Reels/Carrossel/Post estatico. Qual formato esta gerando mais engajamento? Sugira a proporcao ideal baseada nos dados.

4. FREQUENCIA: A frequencia de postagem esta otima, baixa ou excessiva? Compare com benchmarks (3-5 posts/semana para crescimento, 1-2/dia para manutencao).

5. HORARIOS: Avalie se esta postando nos melhores horarios segundo os dados. Sugira ajustes especificos.

6. HASHTAGS: Avalie a estrategia — mix de nicho, trending e branded. Hashtags com melhor ROI de engajamento.

7. ENGAGEMENT RATE: Compare com benchmark do setor. Se < 1%, WARNING. Se > 5%, destaque positivo.

8. RATIO LIKES/COMMENTS: Se > 50, audiencia passiva — sugerir mais CTAs conversacionais, perguntas, enquetes.

9. RECOMENDACOES CONCRETAS: Cada recomendacao deve ter EXEMPLO pratico. Ex: "Poste 3 Reels/semana sobre [tema do melhor post] as 18h com CTA de pergunta no caption"

10. ATRIBUICAO CROSS-CHANNEL (se dados disponiveis): Relate qual canal gerou mais leads, qual campanha teve melhor ROAS, como o funil se comportou (lead→contato→proposta→venda) e o que o match rate indica sobre a qualidade do tracking UTM. Fraseie como gestor: "Voce investiu R$X em Meta Ads e gerou Y leads, dos quais Z viraram vendas (ROAS Wx)."

## FORMATO DE RESPOSTA (JSON)
{
  "summary": "Resumo executivo de 300-800 palavras cobrindo: performance geral do periodo, analise dos melhores posts (por que funcionaram), avaliacao de estrategia de CTAs e formatos, frequencia e consistencia, engagement rate vs benchmark, tendencias de crescimento, e conclusao com visao estrategica.",
  "highlights": [
    {
      "title": "Titulo curto do destaque",
      "description": "Descricao com dados concretos e INTERPRETACAO (2-4 frases). Nao apenas cite o numero — explique o que significa para o negocio.",
      "metric": { "label": "Nome da metrica", "value": "Valor formatado", "delta": "+12%" },
      "provider": "instagram"
    }
  ],
  "recommendations": [
    {
      "action": "Acao especifica e executavel COM EXEMPLO CONCRETO",
      "rationale": "Por que fazer isso, baseado nos dados especificos deste relatorio",
      "priority": "high|medium|low",
      "estimatedImpact": "Impacto estimado baseado nos dados (ex: 'Pode aumentar engagement em ~20% baseado na diferenca entre posts com e sem CTA')"
    }
  ]
}

REGRAS:
- 4-6 highlights, priorizando os mais impactantes e acionaveis
- 4-6 recomendacoes, pelo menos 1 high, 2 medium
- Summary deve ser autocontido e estrategico — alguem que le so o summary entende a situacao completa
- Cite numeros E interprete: "Engagement rate de 2.3% esta dentro da media para B2C (3-6%), mas abaixo do potencial considerando o nicho"
- Se DNA da marca estiver presente, ajuste tom e recomendacoes ao posicionamento`;

  return { system: SYSTEM_PROMPT, user };
}

/* ── Prompt 2: Insights + Warnings ───────────────────────────────────────── */

export function buildInsightsWarningsPrompt(input: PromptDataInput) {
  const user = `## CONTEXTO
Empresa: ${input.empresaName}
Relatorio: ${REPORT_TYPE_LABELS[input.reportType]}
Periodo: ${input.periodLabel}
Plataformas: ${input.providers.join(", ")}

## DADOS AGREGADOS POR PLATAFORMA
${JSON.stringify(input.aggregated, null, 2)}

## TOP CONTEUDOS
${JSON.stringify(input.topContent, null, 2)}

## OUTLIERS
Posts acima da media: ${JSON.stringify(input.outliers.high)}
Posts abaixo da media: ${JSON.stringify(input.outliers.low)}
${formatContentPerformance(input.contentPerformance)}
${formatCaptionAnalysis(input.captionAnalysis)}
${formatEngagementBreakdown(input.engagementBreakdown)}
${formatPostingFrequency(input.postingFrequency)}
${formatGrowthMetrics(input.growthMetrics)}
${formatCrossChannelAttribution(input.attributionTotals, input.channelROI, input.campaignAttribution, input.funnelEndToEnd)}

## TIPO DE INSIGHTS ESPERADOS

Gere insights que um gestor de marketing vai achar UTEIS e NAO OBVIOS:

1. CORRELACOES: "Posts com pergunta no caption geram Xx mais comments que posts descritivos"
2. PATTERNS DE SUCESSO: "Seus melhores posts sao sempre [formato] sobre [tema] — isso indica que sua audiencia valoriza [X]"
3. GAPS DE CONTEUDO: "Voce nao postou [formato] nos ultimos X dias — esse formato tem Y% mais alcance nos seus dados"
4. TIMING: "Seu melhor horario e Xh mas voce so postou N vezes nesse horario no periodo"
5. CTA PATTERNS: "Posts com CTA '[tipo]' geram X% mais engajamento que CTAs '[outro tipo]'"
6. HASHTAG INSIGHTS: "A hashtag #X tem engagement medio Y — 3x acima da sua media geral"
7. AUDIENCIA: "Ratio likes/comments de X indica audiencia [passiva/engajada] — significa que [interpretacao]"

## WARNINGS CONCRETOS (so se justificados pelos dados)

- "Engagement rate de X% esta abaixo do benchmark de Y% para o setor [estimado]"
- "Gap de Z dias sem postar entre [data] e [data] — algoritmo penaliza inconsistencia"
- "X% dos posts sao formato [tipo] — falta diversificacao (Reels tem ate 3x mais alcance)"
- "Nenhum post com CTA no periodo — oportunidade perdida de direcionar trafego"
- "Media de X hashtags por post — acima de 15 pode parecer spam, abaixo de 5 perde descoberta"
- "Saves muito baixos (media X) — conteudo pode nao estar gerando valor percebido de 'guardar para depois'"
- "ROAS de X — abaixo de 1x significa que cada R$1 investido retorna menos que R$1 (prejuizo)" (se dados attribution disponiveis)
- "Match rate de X% — mais da metade dos leads chegam sem UTM rastreavel, prejudicando a atribuicao" (se matchRate < 50%)
- "Funil: X leads entraram mas apenas Y viraram vendas (Z%) — gargalo pode estar em [etapa com maior queda]" (se dados funil disponiveis)

## FORMATO DE RESPOSTA (JSON)
{
  "insights": [
    {
      "type": "positive|negative|neutral|warning",
      "title": "Titulo do insight (curto e impactante)",
      "description": "Analise detalhada (3-5 frases). Correlacione dados, cite numeros, e explique a IMPLICACAO PRATICA para a estrategia. Nao repita numeros sem contexto.",
      "providers": ["instagram"]
    }
  ],
  "warnings": [
    {
      "title": "Titulo do alerta",
      "description": "Descricao do risco ou problema com dados concretos e sugestao de correcao",
      "severity": "info|warning|critical"
    }
  ]
}

REGRAS:
- 4-6 insights, misturando positivos, negativos e neutros
- Priorize insights ACIONAVEIS — que o gestor pode usar para mudar a estrategia amanha
- Priorize insights CROSS-PLATFORM quando houver multiplas plataformas
- Warnings so se houver dados que justifiquem (queda > 15%, anomalias, gaps > 5 dias, eng rate < 1%)
- Se nao houver warnings reais, retorne array vazio — nao invente problemas
- Cada insight deve trazer uma analise NAO OBVIA — nao repita o que o summary ja diz`;

  return { system: SYSTEM_PROMPT, user };
}

/* ── Prompt 3: Comparisons Narrative ─────────────────────────────────────── */

export function buildComparisonsNarrativePrompt(comparisons: Comparison[]) {
  const user = `## COMPARACOES CALCULADAS (periodo atual vs anterior)
${JSON.stringify(comparisons, null, 2)}

## TAREFA
Enriqueca cada comparacao adicionando um campo "context" com uma frase curta (1-2 linhas) que contextualiza a variacao. Exemplos:
- "Crescimento consistente de seguidores, acima da media do setor"
- "Queda de engajamento possivelmente associada a menor frequencia de publicacoes"
- "Variacao dentro da normalidade para o periodo"

## FORMATO DE RESPOSTA (JSON)
{
  "comparisons": [
    {
      "metric": "followers",
      "current": 1500,
      "previous": 1200,
      "delta": 300,
      "deltaPercent": 25.0,
      "trend": "up",
      "context": "Frase contextual aqui"
    }
  ]
}

REGRAS:
- Mantenha TODOS os campos originais inalterados
- Apenas ADICIONE o campo "context" a cada item
- Context deve ser analitico, nao generico
- Se deltaPercent < 3%, considere "flat" e contextualize como estabilidade`;

  return { system: SYSTEM_PROMPT, user };
}

/* ── Labels ──────────────────────────────────────────────────────────────── */

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  weekly: "Semanal",
  monthly: "Mensal",
  quarterly: "Trimestral",
  custom: "Personalizado",
};
