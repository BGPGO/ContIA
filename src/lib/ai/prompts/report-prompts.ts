/**
 * Templates de prompts para geracao de relatorios IA.
 * Cada funcao retorna { system, user } para a chamada OpenAI.
 */

import type { ProviderKey } from "@/types/providers";
import type { Comparison, ReportType } from "@/types/reports";

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
}

/* ── System prompt compartilhado ─────────────────────────────────────────── */

const SYSTEM_PROMPT = `Voce e um analista senior de marketing digital especializado em analise de performance de redes sociais e canais digitais. Seu estilo e claro, direto, baseado em dados, com recomendacoes acionaveis.

REGRAS:
- Escreva em portugues brasileiro formal-profissional (sem marketez cliche, sem exageros)
- Tom de analista, nao hypeman — seja honesto sobre problemas
- Cite numeros concretos dos dados fornecidos
- Recomendacoes devem ser especificas e executaveis, nao genericas
- Responda APENAS com JSON valido, sem markdown, sem code blocks`;

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

## FORMATO DE RESPOSTA (JSON)
{
  "summary": "Resumo executivo de 150-500 palavras cobrindo performance geral do periodo, tendencias principais e conclusao. Estruturado em paragrafos.",
  "highlights": [
    {
      "title": "Titulo curto do destaque",
      "description": "Descricao com dados concretos (2-3 frases)",
      "metric": { "label": "Nome da metrica", "value": "Valor formatado", "delta": "+12%" },
      "provider": "instagram"
    }
  ],
  "recommendations": [
    {
      "action": "Acao especifica e executavel",
      "rationale": "Por que fazer isso, baseado nos dados",
      "priority": "high|medium|low",
      "estimatedImpact": "Impacto estimado se aplicavel"
    }
  ]
}

REGRAS:
- 3-6 highlights, priorizando os mais impactantes
- 3-6 recomendacoes, pelo menos 1 de cada prioridade
- Summary deve ser autocontido — alguem que le so o summary entende a situacao
- Cite numeros e percentuais dos dados fornecidos
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

## FORMATO DE RESPOSTA (JSON)
{
  "insights": [
    {
      "type": "positive|negative|neutral|warning",
      "title": "Titulo do insight",
      "description": "Analise cross-platform detalhada (3-5 frases). Correlacione dados entre plataformas quando possivel.",
      "providers": ["instagram", "facebook"]
    }
  ],
  "warnings": [
    {
      "title": "Titulo do alerta",
      "description": "Descricao do risco ou problema detectado nos dados",
      "severity": "info|warning|critical"
    }
  ]
}

REGRAS:
- 3-6 insights, misturando positivos, negativos e neutros
- Priorize insights CROSS-PLATFORM (correlacoes entre redes)
- Warnings so se houver dados que justifiquem (queda > 15%, anomalias, etc)
- Se nao houver warnings reais, retorne array vazio — nao invente problemas
- Cada insight deve trazer uma analise nao obvia, nao apenas repetir numeros`;

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
