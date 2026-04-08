import { EmpresaContext, ContentTone, ContentFormat } from "@/types/ai";

// ═══════════════════════════════════════════════════════════════════════
// PLATFORM CONSTRAINTS — limites reais de cada rede social
// ═══════════════════════════════════════════════════════════════════════

const PLATFORM_CONSTRAINTS: Record<string, {
  maxChars: number;
  hashtags: string;
  emojis: boolean;
  style: string;
}> = {
  instagram: {
    maxChars: 2200,
    hashtags: "5-10 tags, mix de populares (500k+) e nicho (<50k)",
    emojis: true,
    style: "Visual, storytelling curto, CTA no final, quebras de linha para escaneabilidade",
  },
  facebook: {
    maxChars: 63206,
    hashtags: "3-5 tags relevantes",
    emojis: true,
    style: "Conversacional, perguntas que geram comentários, conteúdo compartilhável",
  },
  linkedin: {
    maxChars: 3000,
    hashtags: "3-5 tags profissionais do setor",
    emojis: false,
    style: "Profissional, dados concretos, insights de mercado, storytelling corporativo",
  },
  twitter: {
    maxChars: 280,
    hashtags: "1-2 tags no máximo",
    emojis: true,
    style: "Direto ao ponto, impactante, provocativo, thread-friendly",
  },
  tiktok: {
    maxChars: 2200,
    hashtags: "3-5 trending tags + nicho",
    emojis: true,
    style: "Trend-driven, hook nos primeiros 3 segundos, linguagem jovem e dinâmica",
  },
  youtube: {
    maxChars: 5000,
    hashtags: "3-5 tags SEO",
    emojis: true,
    style: "SEO-friendly, descritivo, com timestamps e seções claras",
  },
};

// ═══════════════════════════════════════════════════════════════════════
// TONE DESCRIPTIONS — detalhadas para guiar a geração com precisão
// ═══════════════════════════════════════════════════════════════════════

const TONE_DESCRIPTIONS: Record<ContentTone, string> = {
  formal:
    "Profissional e respeitoso. Use linguagem corporativa, dados e fatos concretos. Sem gírias, sem emojis excessivos. Tom de autoridade e credibilidade. Frases bem estruturadas, vocabulário rico. Ideal para comunicados e conteúdo B2B.",
  casual:
    "Próximo e descontraído. Use linguagem do dia a dia brasileiro, emojis moderados, perguntas diretas ao leitor. Como uma conversa com um amigo que manja do assunto. Pode usar expressões coloquiais (tipo, né, bora) mas sem exagero.",
  tecnico:
    "Educacional e preciso. Use termos técnicos com explicações acessíveis entre parênteses. Traga dados, estatísticas, comparações e fontes sempre que possível. Tom de professor especialista que simplifica o complexo sem perder profundidade.",
  divertido:
    "Leve e criativo. Use humor inteligente, trocadilhos, referências pop brasileiras. Emojis expressivos e bem colocados. Tom de marca que não se leva a sério mas entrega valor real. Pode brincar com memes e trends atuais.",
  inspirador:
    "Motivacional e empoderador. Use storytelling pessoal, metáforas visuais, frases de impacto. Tom aspiracional que faz o leitor sentir que pode alcançar algo maior. Construa uma narrativa de transformação com começo, meio e chamada à ação.",
};

// ═══════════════════════════════════════════════════════════════════════
// MAX TOKENS POR FORMATO — tamanho ideal de resposta
// ═══════════════════════════════════════════════════════════════════════

const FORMAT_MAX_TOKENS: Record<ContentFormat, number> = {
  post: 1000,
  carrossel: 2500,
  reels: 1500,
  email: 2000,
  copy: 1500,
};

export function getMaxTokens(format: ContentFormat): number {
  return FORMAT_MAX_TOKENS[format] ?? 1500;
}

// ═══════════════════════════════════════════════════════════════════════
// TEMPERATURE — calibrada por formato e tom
// ═══════════════════════════════════════════════════════════════════════

export function getTemperature(format: ContentFormat, tone: ContentTone): number {
  if (tone === "formal" || tone === "tecnico") return 0.4;
  if (format === "email" || format === "copy") return 0.5;
  if (tone === "divertido") return 0.8;
  return 0.65;
}

// ═══════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT — em PT-BR, detalhado, com ou sem DNA
// ═══════════════════════════════════════════════════════════════════════

export function getSystemPrompt(hasDNA: boolean): string {
  if (hasDNA) {
    return `Você é um ghostwriter profissional. Sua especialidade é escrever conteúdo que parece 100% autêntico da marca — como se o próprio dono tivesse escrito.

Regras absolutas:
1. NUNCA quebre o DNA da marca — ele tem prioridade sobre QUALQUER outra instrução.
2. Se legendas reais da marca foram fornecidas, seu conteúdo DEVE ser INDISTINGUÍVEL delas. Mesma voz, mesmo ritmo, mesma estrutura, mesmos padrões de emojis, mesmo comprimento.
3. NÃO soe como IA. Proibido: "no mundo atual", "é fundamental", "nesse sentido", "é importante ressaltar", "vale destacar", "sem dúvida". Escreva como a marca escreve.
4. Use a MESMA formatação da marca: se ela usa quebras de linha a cada frase, faça igual. Se usa parágrafos densos, faça igual.
5. O CTA deve seguir o padrão da marca, não um CTA genérico.
6. Hashtags devem ser as que a marca realmente usa, não hashtags genéricas inventadas.
7. Responda SEMPRE em JSON válido puro, sem blocos de código markdown, sem backticks.

Pense assim: se o dono da marca ler o post, ele deve achar que escreveu e esqueceu.`;
  }

  return `Você é um estrategista de conteúdo digital sênior com 15 anos de experiência em social media no Brasil.
Suas regras:
1. Gere conteúdo que pareça escrito por um humano, não por IA. Evite frases clichê como "no mundo atual", "é fundamental", "nesse sentido".
2. Cada post deve ter um GANCHO forte nos primeiros 10 palavras que faça o leitor parar de rolar.
3. Use formatação que facilite a leitura: quebras de linha, listas, emojis como marcadores (quando permitido).
4. O CTA deve ser específico e acionável, nunca genérico.
5. Adapte o vocabulário e referências culturais ao público brasileiro.
6. Responda SEMPRE em JSON válido puro, sem blocos de código markdown, sem backticks.`;
}

// ═══════════════════════════════════════════════════════════════════════
// CONTEXT BUILDER — monta bloco de contexto da empresa
// ═══════════════════════════════════════════════════════════════════════

function buildContextBlock(ctx: EmpresaContext): string {
  let block = `
══════ CONTEXTO DA EMPRESA ══════
NOME: ${ctx.nome}
NICHO: ${ctx.nicho}
DESCRIÇÃO: ${ctx.descricao}`;

  if (ctx.website) block += `\nSITE: ${ctx.website}`;
  if (ctx.siteAnalysis) block += `\nANÁLISE DO SITE:\n${ctx.siteAnalysis}`;

  // Inject real Instagram captions if available
  if (ctx.instagramAnalysis) {
    try {
      const igData = JSON.parse(ctx.instagramAnalysis);
      if (igData._realCaptions?.length) {
        block += `\n\n🔥 LEGENDAS REAIS DO INSTAGRAM DA MARCA (estas são as legendas REAIS publicadas — seu conteúdo DEVE seguir este mesmo estilo):`;
        igData._realCaptions.forEach((cap: string, i: number) => {
          block += `\n\n═══ Legenda Real ${i + 1} ═══\n${cap}`;
        });
        block += `\n\n⛔ INSTRUÇÃO CRÍTICA: Analise as legendas acima com atenção. Observe:
- O comprimento médio das legendas
- Como começam (gancho, pergunta, afirmação?)
- O uso de emojis (quais, onde, frequência)
- Quebras de linha e espaçamento
- O tom (formal? casual? técnico? descontraído?)
- Como terminam (CTA, pergunta, hashtags?)
- O vocabulário e expressões usadas
- A estrutura (hook → corpo → CTA? lista? storytelling?)
Seu conteúdo gerado DEVE ser INDISTINGUÍVEL das legendas acima. Se alguém colocar seu texto ao lado dessas legendas, deve parecer que foi escrito pela MESMA pessoa.`;
      } else {
        block += `\nANÁLISE DO INSTAGRAM:\n${ctx.instagramAnalysis}`;
      }
    } catch {
      block += `\nANÁLISE DO INSTAGRAM:\n${ctx.instagramAnalysis}`;
    }
  }

  return block;
}

// ═══════════════════════════════════════════════════════════════════════
// DNA ENFORCEMENT — regras absolutas quando DNA da marca existe
// ═══════════════════════════════════════════════════════════════════════

function buildDNABlock(ctx: EmpresaContext): string {
  if (!ctx.dnaMarca) return "";

  try {
    const dna = JSON.parse(ctx.dnaMarca);
    let block = `\n\n⚠️ REGRAS ABSOLUTAS DO DNA DA MARCA (violar qualquer uma = conteúdo rejeitado):`;

    if (dna.tom_de_voz) {
      block += `\n• Tom de voz EXATO a seguir: "${dna.tom_de_voz}"`;
    }
    if (dna.personalidade_marca) {
      block += `\n• Personalidade da marca: "${dna.personalidade_marca}"`;
    }
    if (dna.proposta_valor) {
      block += `\n• Proposta de valor (reforçar sempre): "${dna.proposta_valor}"`;
    }
    if (dna.publico_alvo) {
      block += `\n• Público-alvo (adaptar linguagem para): "${dna.publico_alvo}"`;
    }
    if (dna.pilares_conteudo?.length) {
      block += `\n• Pilares de conteúdo (tema DEVE se encaixar em um): ${dna.pilares_conteudo.join(" | ")}`;
    }
    if (dna.palavras_usar?.length) {
      block += `\n• USAR estas palavras/expressões: ${dna.palavras_usar.join(", ")}`;
    }
    if (dna.palavras_evitar?.length) {
      block += `\n• PROIBIDO usar estas palavras: ${dna.palavras_evitar.join(", ")}`;
    }
    if (dna.hashtags_recomendadas?.length) {
      block += `\n• Hashtags OBRIGATÓRIAS (incluir pelo menos 3): ${dna.hashtags_recomendadas.slice(0, 5).join(" ")}`;
    }
    if (dna.diferenciais_vs_concorrentes?.length) {
      block += `\n• Diferenciais a destacar: ${dna.diferenciais_vs_concorrentes.join(" | ")}`;
    }
    if (dna.estilo_visual) {
      block += `\n• Estilo visual para imagePrompt: ${dna.estilo_visual}`;
    }
    if (dna.exemplos_legenda?.length) {
      block += `\n• Exemplos de tom (use como referência de estilo, NÃO copie):`;
      dna.exemplos_legenda.forEach((e: string, i: number) => {
        block += `\n  ${i + 1}. "${e}"`;
      });
    }

    return block;
  } catch {
    return "";
  }
}

// ═══════════════════════════════════════════════════════════════════════
// STYLE PROFILE BLOCK — padrões extraídos dos posts reais da marca
// ═══════════════════════════════════════════════════════════════════════

function buildStyleProfileBlock(ctx: EmpresaContext): string {
  if (!ctx.styleProfile) return "";

  try {
    const sp = JSON.parse(ctx.styleProfile);
    let block = `\n\n══════ ANÁLISE DE ESTILO DA MARCA (${sp.analyzed_posts_count || "?"} posts analisados) ══════`;
    block += `\nEstas são as REGRAS DE ESTILO extraídas dos posts REAIS. Siga-as à risca:`;

    if (sp.tone_description) {
      block += `\n\n📌 TOM DE VOZ REAL: ${sp.tone_description}`;
    }
    if (sp.caption_structure) {
      block += `\n📌 ESTRUTURA DAS LEGENDAS: ${sp.caption_structure}`;
      block += `\n   → Siga EXATAMENTE esta estrutura no conteúdo gerado.`;
    }
    if (sp.caption_avg_length) {
      block += `\n📌 COMPRIMENTO: A legenda média tem ${sp.caption_avg_length} caracteres. Gere com comprimento SIMILAR.`;
    }
    if (sp.emoji_usage) {
      block += `\n📌 EMOJIS: Uso "${sp.emoji_usage}"`;
      if (sp.emoji_usage === "heavy") block += ` — use emojis em quase toda frase, como a marca faz.`;
      else if (sp.emoji_usage === "moderate") block += ` — use emojis com moderação, nos pontos de destaque.`;
      else if (sp.emoji_usage === "minimal") block += ` — use pouquíssimos emojis, apenas onde essencial.`;
      else block += ` — NÃO use emojis, a marca não usa.`;
      if (sp.emoji_examples?.length) {
        block += `\n   Emojis preferidos da marca: ${sp.emoji_examples.join(" ")}`;
      }
    }
    if (sp.line_break_style) {
      block += `\n📌 FORMATAÇÃO: ${sp.line_break_style}`;
    }
    if (sp.opening_patterns?.length) {
      block += `\n📌 ABERTURAS DA MARCA (use uma variação desses padrões):`;
      sp.opening_patterns.forEach((p: string) => { block += `\n   → "${p}"`; });
    }
    if (sp.cta_patterns?.length) {
      block += `\n📌 CTAs DA MARCA (use o estilo destes):`;
      sp.cta_patterns.forEach((p: string) => { block += `\n   → "${p}"`; });
    }
    if (sp.vocabulary_signature?.length) {
      block += `\n📌 VOCABULÁRIO CARACTERÍSTICO (incorpore estas palavras/expressões): ${sp.vocabulary_signature.join(", ")}`;
    }
    if (sp.top_hashtags?.length) {
      block += `\n📌 HASHTAGS REAIS (use pelo menos 4 destas): ${sp.top_hashtags.slice(0, 12).join(" ")}`;
    }

    if (sp.example_captions?.length) {
      block += `\n\n══════ LEGENDAS DE REFERÊNCIA (copie o ESTILO, não o conteúdo) ══════`;
      sp.example_captions.forEach((cap: string, i: number) => {
        block += `\n\n--- Referência ${i + 1} ---\n${cap.slice(0, 600)}`;
      });
    }

    block += `\n\n⛔ REGRA INVIOLÁVEL: O conteúdo gerado deve ser INDISTINGUÍVEL de um post real da marca.`;
    block += `\nSe a marca usa frases curtas, use frases curtas. Se usa parágrafos longos, use parágrafos longos.`;
    block += `\nSe começa com emoji, comece com emoji. Se nunca usa emoji no início, não use.`;
    block += `\nVocê está IMITANDO a voz desta marca, não criando um estilo novo.`;

    return block;
  } catch {
    return "";
  }
}

// ═══════════════════════════════════════════════════════════════════════
// PLATFORM CONSTRAINTS BUILDER — restrições numéricas por plataforma
// ═══════════════════════════════════════════════════════════════════════

function buildPlatformConstraints(plataformas: string[]): string {
  if (!plataformas.length) return "";

  const primary = plataformas[0].toLowerCase();
  const constraints = PLATFORM_CONSTRAINTS[primary];

  let block = `\n\n══════ RESTRIÇÕES DE PLATAFORMA ══════`;
  block += `\nPLATAFORMA PRINCIPAL: ${primary.toUpperCase()}`;

  if (constraints) {
    block += `\n• Máximo de caracteres: ${constraints.maxChars}`;
    block += `\n• Hashtags: ${constraints.hashtags}`;
    block += `\n• Emojis: ${constraints.emojis ? "Sim, usar estrategicamente" : "Não usar ou usar com muita moderação"}`;
    block += `\n• Estilo: ${constraints.style}`;
  }

  if (plataformas.length > 1) {
    block += `\nPLATAFORMAS SECUNDÁRIAS: ${plataformas.slice(1).join(", ")}`;
    block += `\n(Priorize as regras da plataforma principal, mas mantenha o conteúdo adaptável)`;
  }

  return block;
}

// ═══════════════════════════════════════════════════════════════════════
// FEW-SHOT EXAMPLES — exemplos reais de alta performance por formato
// ═══════════════════════════════════════════════════════════════════════

const FEW_SHOT_POST = `
EXEMPLOS DE POSTS BEM-SUCEDIDOS (use como referência de qualidade, NÃO copie):
---
Exemplo 1 (tom casual, Instagram):
🔥 3 erros que fazem sua empresa perder clientes todo dia:

1️⃣ Responder leads depois de 1h (o ideal é <5min)
2️⃣ Não ter follow-up automatizado
3️⃣ Ignorar quem abriu seu email e não respondeu

Qual desses você ainda comete? 👇

#vendas #crm #marketingdigital #leads #conversão
---
Exemplo 2 (tom inspirador, LinkedIn):
Em 2019 eu tinha 3 clientes e trabalhava 14h por dia.

Hoje atendo 47 empresas com a mesma equipe de 4 pessoas.

O que mudou? Não foi trabalhar mais. Foi parar de fazer manual o que a tecnologia resolve em segundos.

Automação não substitui pessoas. Liberta elas para fazer o que realmente importa.

Se você ainda faz tarefas repetitivas todo dia, reflita: quanto vale 1 hora do seu tempo?

#gestão #produtividade #automação #liderança
---`;

const FEW_SHOT_CAROUSEL = `
EXEMPLO DE CARROSSEL BEM-SUCEDIDO (use como referência de estrutura):
---
Slide 1 (GANCHO): "5 MÉTRICAS que todo dono de negócio IGNORA (e perde dinheiro por isso)"
Slide 2: "1. CAC — Custo de Aquisição de Cliente → Quanto você gasta para conquistar cada novo cliente?"
Slide 3: "2. LTV — Lifetime Value → Quanto cada cliente gera de receita ao longo do tempo?"
Slide 4: "3. Churn Rate → Quantos clientes você perde por mês?"
Slide 5: "4. NPS — Net Promoter Score → Seus clientes indicam você?"
Slide 6: "5. Ticket Médio → Você sabe quanto cada venda rende em média?"
Slide 7 (RESUMO): "Quem não mede, não melhora. Comece por UMA métrica hoje."
Slide 8 (CTA): "Salva esse post e manda pra quem precisa ver 📌"

Legenda: "Qual dessas métricas você já acompanha? Me conta nos comentários 👇"
---`;

const FEW_SHOT_REELS = `
EXEMPLO DE ROTEIRO DE REELS BEM-SUCEDIDO (use como referência):
---
HOOK (0-3s): "Você tá jogando dinheiro fora e nem sabe." [olhar direto na câmera, corte rápido]
CORPO:
- (4-10s) "Toda vez que um lead entra no seu site e ninguém responde em menos de 5 minutos..."
- (10-18s) "...a chance de conversão cai 80%. Oitenta por cento."
- (18-28s) "A solução? Um CRM com automação de first-response. O lead entra, recebe mensagem em 30 segundos."
CTA (28-35s): "Link na bio pra testar grátis. Para de perder venda."
Duração: 35s
Música: batida lo-fi motivacional
---`;

const FEW_SHOT_EMAIL = `
EXEMPLO DE EMAIL BEM-SUCEDIDO (use como referência):
---
Subject: Você perdeu 3 vendas essa semana (sem saber)
Preview: Descubra o erro invisível que custa caro

Oi {{nome}},

Semana passada analisei os dados de 23 empresas que usam nosso sistema.

Sabe o que encontrei?

Em média, cada uma perdeu 3 vendas por semana simplesmente porque demorou mais de 1 hora para responder um lead.

Não é falta de produto. Não é preço alto. É TEMPO DE RESPOSTA.

A boa notícia: isso tem solução simples.

[CTA: Quero responder leads em <5 minutos →]

Abs,
Equipe {{empresa}}
---`;

const FEW_SHOT_COPY = `
EXEMPLO DE COPY BEM-SUCEDIDA (use como referência):
---
Headline: "Pare de perder vendas por lentidão"
Subheadline: "Responda cada lead em menos de 5 minutos — automaticamente"
Anúncio (125 chars): "Seus leads esperam. Seus concorrentes não. Automatize o primeiro contato e converta 3x mais."
Landing page: "Toda empresa perde vendas por um motivo simples: demora. O lead preenche o formulário às 14h e recebe resposta às 18h — quando já fechou com outra empresa. Com nossa automação, cada lead recebe uma mensagem personalizada em menos de 30 segundos. Sem robô genérico. Sem 'em breve entraremos em contato'. Uma resposta real, no momento certo."
CTA: "Testar grátis por 14 dias"
---`;

// ═══════════════════════════════════════════════════════════════════════
// VISUAL POST GUIDELINES — regras para gerar texto que vai NA IMAGEM
// ═══════════════════════════════════════════════════════════════════════

const VISUAL_POST_GUIDELINES = `
## REGRAS PARA O VISUAL POST (texto que aparece NA IMAGEM do post):

O "visualPost" é o texto que será renderizado DENTRO da imagem do post. É diferente da legenda.
É o que faz a pessoa PARAR de scrollar. Pense como um designer de social media:

1. **headline** — Frase de IMPACTO. Curta, direta, impossível de ignorar. MAX 60 caracteres.
   - BOM: "5x mais vendas em 30 dias"
   - BOM: "O erro que 90% dos donos de negócio cometem"
   - RUIM: "Descubra como melhorar suas vendas usando essas técnicas incríveis"

2. **subheadline** — Complemento. Dá contexto ao headline. MAX 100 caracteres.
   - BOM: "A estratégia que mudou tudo para a empresa X"
   - RUIM: Repetir o headline com outras palavras

3. **body** — Texto explicativo curto. Aparece em fonte menor. MAX 200 caracteres.
   - Bullets curtos ou parágrafo breve
   - Sem floreios — cada palavra conta

4. **accentText** — O DESTAQUE. Um número, estatística, ou frase-chave.
   - BOM: "R$ 50 mil/mês", "Em apenas 7 dias", "97% aprovam"
   - Aparece em cor de destaque na imagem

5. **cta** — Ação direta. MAX 40 caracteres.
   - BOM: "Salve este post", "Link na bio", "Comenta SIM"
   - RUIM: "Clique no link da bio para saber mais sobre nossos serviços"

6. **suggestedTemplate** — Escolha o template visual mais adequado:
   - "bold-statement" — Para frases de impacto, provocações
   - "gradient-wave" — Para conteúdo lifestyle, inspiracional
   - "minimal-clean" — Para conteúdo educativo, profissional
   - "quote-card" — Para citações, depoimentos
   - "tip-numbered" — Para dicas numeradas, how-to
   - "stats-highlight" — Para dados, números, resultados
   - "split-content" — Para antes/depois, comparações
`;

const VISUAL_POST_GUIDELINES_CAROUSEL = `
## REGRAS PARA O VISUAL POST DE CADA SLIDE (texto que aparece NA IMAGEM de cada slide):

Cada slide do carrossel tem um "visualPost" — o texto curto e impactante que aparece NA IMAGEM.
Diferente do "conteudo" do slide (que é a legenda), o visualPost é o que o usuário LÊ na imagem.

1. **headline** — Frase principal do slide. MAX 50 caracteres. Legível em tela pequena.
2. **body** — Texto complementar curto. MAX 150 caracteres. Fonte menor na imagem.

Cada slide deve ter texto que funcione SOZINHO visualmente — sem depender do anterior.
`;

// ═══════════════════════════════════════════════════════════════════════
// BUILDER FUNCTIONS — cada uma retorna o prompt completo do formato
// ═══════════════════════════════════════════════════════════════════════

export function buildPostPrompt(
  ctx: EmpresaContext,
  topic: string,
  tone: ContentTone,
  plataformas: string[]
): string {
  return `Você é um social media estrategista brasileiro de alto nível, especialista em criação de conteúdo que gera engajamento real.

${buildContextBlock(ctx)}
${buildDNABlock(ctx)}
${buildStyleProfileBlock(ctx)}
${buildPlatformConstraints(plataformas)}

══════ DIRETRIZES DE TOM ══════
TOM ESCOLHIDO: ${tone.toUpperCase()}
${TONE_DESCRIPTIONS[tone]}

${FEW_SHOT_POST}

══════ TAREFA ══════
Gere um post completo sobre o tema: "${topic}"

REGRAS DE QUALIDADE:
1. O título deve ser um GANCHO — algo que faça o leitor parar de rolar o feed.
2. O conteúdo deve ter quebras de linha estratégicas, listas numeradas ou emojis como bullets quando apropriado.
3. Não comece com "Você sabia que..." nem "No mundo atual..." — seja original.
4. O CTA deve ser específico: diga EXATAMENTE o que o leitor deve fazer (comentar, salvar, clicar, marcar alguém).
5. As hashtags devem ser um mix: 2-3 populares do nicho + 2-3 específicas do tema + 2-3 da marca (se houver DNA).
6. O imagePrompt deve ser detalhado e em inglês, descrevendo uma imagem profissional e atraente que complementa o post.
7. Máximo de caracteres no conteúdo: ${PLATFORM_CONSTRAINTS[plataformas[0]?.toLowerCase()]?.maxChars || 2200}.

${VISUAL_POST_GUIDELINES}

IMPORTANTE: O "conteudo" é a LEGENDA do post (texto abaixo da imagem). O "visualPost" é o texto curto e impactante que aparece DENTRO da imagem. São textos DIFERENTES — o visualPost é muito mais curto e direto.

Responda APENAS em JSON válido puro (sem markdown, sem backticks), neste formato exato:
{
  "titulo": "título/gancho chamativo do post",
  "conteudo": "texto completo do post com formatação, emojis e quebras de linha adequadas para as plataformas",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"],
  "cta": "call to action específico e acionável",
  "imagePrompt": "prompt detalhado em inglês para gerar imagem profissional que acompanhe este post",
  "visualPost": {
    "headline": "Headline impactante (MAX 60 caracteres) — a frase principal que vai aparecer grande no post visual",
    "subheadline": "Linha de apoio (MAX 100 caracteres) — complementa o headline",
    "body": "Texto corpo (MAX 200 caracteres) — explicação curta que aparece em fonte menor",
    "accentText": "Texto destaque — um número, estatística ou frase-chave que aparece em cor de destaque",
    "cta": "CTA curto (MAX 40 caracteres) — chamada pra ação direta",
    "suggestedTemplate": "bold-statement"
  }
}`;
}

export function buildCarouselPrompt(
  ctx: EmpresaContext,
  topic: string,
  tone: ContentTone,
  numSlides: number
): string {
  return `Você é um especialista brasileiro em carrosséis de Instagram que viralizam, com profundo conhecimento de design de informação e storytelling visual.

${buildContextBlock(ctx)}
${buildDNABlock(ctx)}
${buildStyleProfileBlock(ctx)}
${buildPlatformConstraints(["instagram"])}

══════ DIRETRIZES DE TOM ══════
TOM ESCOLHIDO: ${tone.toUpperCase()}
${TONE_DESCRIPTIONS[tone]}

${FEW_SHOT_CAROUSEL}

══════ TAREFA ══════
Crie um carrossel de ${numSlides} slides sobre: "${topic}"

ESTRUTURA OBRIGATÓRIA:
- Slide 1 → GANCHO: frase curta e impactante que faz parar de rolar. Máximo 10 palavras. Use números, perguntas provocativas ou afirmações ousadas.
- Slides 2 a ${numSlides - 2} → CONTEÚDO: UMA ideia por slide. Texto curto (máximo 3 linhas por slide). Dados concretos quando possível.
- Slide ${numSlides - 1} → RESUMO: sintetize o aprendizado em 1-2 frases memoráveis.
- Slide ${numSlides} → CTA: convite claro para ação (salvar, compartilhar, comentar, seguir).

REGRAS DE QUALIDADE:
1. Cada slide deve fazer sentido sozinho MAS criar curiosidade para o próximo.
2. Use linguagem direta — carrossel não é lugar para enrolação.
3. O título de cada slide deve ser legível em tela pequena (fonte grande = texto curto).
4. A legenda do post deve complementar o carrossel, não repetir.
5. Cada imagePrompt de slide deve descrever um visual clean e profissional, com espaço para texto sobreposto.

${VISUAL_POST_GUIDELINES_CAROUSEL}

Responda APENAS em JSON válido puro (sem markdown, sem backticks):
{
  "titulo": "título do carrossel para a legenda",
  "conteudo": "legenda completa do post (complementa os slides, não repete)",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"],
  "cta": "call to action da legenda",
  "slides": [
    {
      "slideNumber": 1,
      "titulo": "texto principal do slide (curto, impactante, máximo 10 palavras)",
      "conteudo": "texto complementar se necessário (máximo 2-3 linhas)",
      "imagePrompt": "prompt em inglês para background visual clean deste slide, com espaço para texto",
      "visualPost": {
        "headline": "Headline do slide (MAX 50 chars)",
        "body": "Texto do slide (MAX 150 chars)"
      }
    }
  ],
  "imagePrompt": "prompt em inglês para a capa/thumbnail do carrossel"
}`;
}

export function buildReelsPrompt(
  ctx: EmpresaContext,
  topic: string,
  tone: ContentTone
): string {
  return `Você é um roteirista brasileiro expert em Reels de Instagram e TikTok que viralizam, com domínio de ritmo, edição e trends.

${buildContextBlock(ctx)}
${buildDNABlock(ctx)}
${buildStyleProfileBlock(ctx)}
${buildPlatformConstraints(["instagram", "tiktok"])}

══════ DIRETRIZES DE TOM ══════
TOM ESCOLHIDO: ${tone.toUpperCase()}
${TONE_DESCRIPTIONS[tone]}

${FEW_SHOT_REELS}

══════ TAREFA ══════
Crie um roteiro de Reels/TikTok sobre: "${topic}"

ESTRUTURA OBRIGATÓRIA:
- HOOK (0-3 segundos): frase ou ação que PRENDE a atenção imediatamente. O usuário decide em 1.5s se continua ou passa. Seja impactante.
- CORPO (4-25 segundos): 3-5 pontos rápidos, ritmo acelerado, cortes a cada 3-5 segundos. Cada ponto deve ter instrução de visual/ação.
- CTA (últimos 5 segundos): chamada final clara e direta.

REGRAS DE QUALIDADE:
1. O hook NÃO pode ser uma pergunta genérica. Use: afirmação chocante, número surpreendente, ou "Para de fazer X" (confronto).
2. Cada ponto do corpo deve ter no máximo 2 frases faladas (para manter ritmo).
3. Sugira música/estilo de áudio que combine com o tom.
4. A legenda deve ser independente do roteiro — funciona mesmo sem assistir o vídeo.
5. Duração ideal: 30-45 segundos (sweet spot do algoritmo).

Responda APENAS em JSON válido puro (sem markdown, sem backticks):
{
  "titulo": "título/conceito do reel",
  "conteudo": "legenda completa do post (funciona independente do vídeo)",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"],
  "cta": "call to action da legenda",
  "reelsScript": {
    "hook": "frase/ação exata de abertura (máximo 3 segundos falados)",
    "corpo": ["ponto 1 com instrução de visual", "ponto 2 com instrução de visual", "ponto 3 com instrução de visual"],
    "cta": "chamada final no vídeo (últimos 5 segundos)",
    "duracao": "30-45s",
    "musica_sugerida": "nome ou estilo de música/áudio trending que combine"
  },
  "imagePrompt": "prompt detalhado em inglês para thumbnail atraente do reel (deve gerar curiosidade)"
}`;
}

export function buildEmailPrompt(
  ctx: EmpresaContext,
  topic: string,
  tone: ContentTone
): string {
  return `Você é um copywriter brasileiro especialista em email marketing de alta conversão, com domínio de técnicas de persuasão e storytelling.

${buildContextBlock(ctx)}
${buildDNABlock(ctx)}
${buildStyleProfileBlock(ctx)}

══════ DIRETRIZES DE TOM ══════
TOM ESCOLHIDO: ${tone.toUpperCase()}
${TONE_DESCRIPTIONS[tone]}

${FEW_SHOT_EMAIL}

══════ TAREFA ══════
Crie um email marketing sobre: "${topic}"

ESTRUTURA OBRIGATÓRIA:
- Subject line: máximo 50 caracteres, gere curiosidade ou urgência. NUNCA use ALL CAPS no subject inteiro.
- Preview text: complementa o subject, máximo 90 caracteres. Não repita o subject.
- Corpo: abra com uma frase que conecta pessoalmente (nome, situação, dor). Desenvolva com storytelling curto (máximo 3 parágrafos). Use frases curtas e parágrafos de 1-3 linhas. Termine com benefício claro antes do CTA.
- CTA: botão com texto acionável de 2-5 palavras, verbos no imperativo.

REGRAS DE QUALIDADE:
1. O subject deve ter taxa de abertura alta — pense: "eu abriria esse email no meio de 50 outros?"
2. NÃO comece o corpo com "Prezado" ou "Olá, tudo bem?". Seja direto e envolvente.
3. Use HTML simples: <p>, <strong>, <br>, <a>. Nada de CSS inline complexo.
4. O email inteiro deve ser legível em 60 segundos ou menos.
5. Um único CTA principal (pode repetir, mas sempre o mesmo).
6. Tom pessoal — escreva como se fosse um email 1-para-1, não um broadcast.

Responda APENAS em JSON válido puro (sem markdown, sem backticks):
{
  "titulo": "subject line do email (máximo 50 chars)",
  "conteudo": "preview text (máximo 90 chars, complementa o subject)",
  "emailSubject": "mesmo subject line",
  "emailBody": "corpo completo do email em HTML simples (<p>, <strong>, <br>, <a href='#'>CTA</a>)",
  "cta": "texto do botão CTA (2-5 palavras, verbo imperativo)",
  "hashtags": [],
  "imagePrompt": "prompt em inglês para header image profissional do email"
}`;
}

export function buildCopyPrompt(
  ctx: EmpresaContext,
  topic: string,
  tone: ContentTone
): string {
  return `Você é um copywriter brasileiro de elite, expert em textos persuasivos para marketing digital, com domínio de frameworks como PAS (Problem-Agitate-Solve), AIDA e storytelling de conversão.

${buildContextBlock(ctx)}
${buildDNABlock(ctx)}
${buildStyleProfileBlock(ctx)}

══════ DIRETRIZES DE TOM ══════
TOM ESCOLHIDO: ${tone.toUpperCase()}
${TONE_DESCRIPTIONS[tone]}

${FEW_SHOT_COPY}

══════ TAREFA ══════
Crie uma copy de marketing completa sobre: "${topic}"

VARIAÇÕES OBRIGATÓRIAS:
1. Headline principal: frase de impacto que captura atenção em <3 segundos. Máximo 10 palavras. Use números, benefícios concretos ou provocações.
2. Subheadline: complementa a headline com uma promessa específica. Máximo 20 palavras.
3. Texto para anúncio: versão ultracompacta para Facebook/Instagram Ads. MÁXIMO 125 caracteres. Deve funcionar sozinho.
4. Texto para landing page: 1-2 parágrafos usando framework PAS (Problema → Agitação → Solução). Linguagem direta, benefícios tangíveis, prova social se possível.
5. CTA: verbo imperativo + benefício. Ex: "Comece a vender mais hoje", não "Clique aqui".

REGRAS DE QUALIDADE:
1. Toda copy gira em torno de UMA dor principal e UMA solução clara.
2. Use números específicos em vez de vagos ("3x mais" em vez de "muito mais").
3. O texto de anúncio deve ter gatilho emocional imediato.
4. A landing page deve ter progressão lógica: identificação → dor → agitação → solução → prova → CTA.
5. Evite superlativos vazios ("o melhor", "incrível", "revolucionário"). Prefira dados e resultados.

Responda APENAS em JSON válido puro (sem markdown, sem backticks):
{
  "titulo": "headline principal (máximo 10 palavras)",
  "conteudo": "subheadline + texto completo de landing page (use \\n\\n para separar seções)",
  "hashtags": [],
  "cta": "texto do CTA principal (verbo imperativo + benefício)",
  "imagePrompt": "prompt detalhado em inglês para visual profissional que reforce a mensagem da copy"
}`;
}

// ═══════════════════════════════════════════════════════════════════════
// ROUTER — seleciona o builder correto por formato
// ═══════════════════════════════════════════════════════════════════════

export function getPromptForFormat(
  format: ContentFormat,
  ctx: EmpresaContext,
  topic: string,
  tone: ContentTone,
  plataformas: string[]
): string {
  switch (format) {
    case "post":
      return buildPostPrompt(ctx, topic, tone, plataformas);
    case "carrossel":
      return buildCarouselPrompt(ctx, topic, tone, 7);
    case "reels":
      return buildReelsPrompt(ctx, topic, tone);
    case "email":
      return buildEmailPrompt(ctx, topic, tone);
    case "copy":
      return buildCopyPrompt(ctx, topic, tone);
  }
}
