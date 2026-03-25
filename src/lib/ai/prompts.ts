import { EmpresaContext, ContentTone, ContentFormat } from "@/types/ai";

function buildContextBlock(ctx: EmpresaContext): string {
  let block = `
EMPRESA: ${ctx.nome}
NICHO: ${ctx.nicho}
DESCRIÇÃO: ${ctx.descricao}`;
  if (ctx.website) block += `\nSITE: ${ctx.website}`;
  if (ctx.siteAnalysis) block += `\nANÁLISE DO SITE:\n${ctx.siteAnalysis}`;
  if (ctx.instagramAnalysis) block += `\nANÁLISE DO INSTAGRAM:\n${ctx.instagramAnalysis}`;
  return block;
}

const toneMap: Record<ContentTone, string> = {
  formal: "Profissional, corporativo, usando linguagem formal e técnica",
  casual: "Descontraído, próximo, usando linguagem do dia a dia brasileiro",
  tecnico: "Técnico e educativo, com dados e termos específicos do setor",
  divertido: "Leve, com humor, usando gírias e memes quando apropriado",
  inspirador: "Motivacional, positivo, com frases de impacto",
};

export function buildPostPrompt(ctx: EmpresaContext, topic: string, tone: ContentTone, plataformas: string[]): string {
  return `Você é um social media expert brasileiro, especialista em criação de conteúdo para redes sociais.

${buildContextBlock(ctx)}

TOM DE VOZ: ${toneMap[tone]}
PLATAFORMAS: ${plataformas.join(", ")}

Gere um post completo sobre o tema: "${topic}"

Responda APENAS em JSON válido, sem markdown, neste formato exato:
{
  "titulo": "título chamativo do post",
  "conteudo": "texto completo do post com emojis e formatação adequada para as plataformas",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"],
  "cta": "call to action final",
  "imagePrompt": "prompt em inglês para gerar uma imagem que acompanhe este post, estilo profissional, cores da marca"
}`;
}

export function buildCarouselPrompt(ctx: EmpresaContext, topic: string, tone: ContentTone, numSlides: number): string {
  return `Você é um especialista brasileiro em carrosséis de Instagram que viralizam.

${buildContextBlock(ctx)}

TOM DE VOZ: ${toneMap[tone]}

Crie um carrossel de ${numSlides} slides sobre: "${topic}"

Estrutura obrigatória:
- Slide 1: GANCHO (frase de impacto que faz parar de rolar)
- Slides do meio: CONTEÚDO (informação valiosa, uma ideia por slide)
- Penúltimo slide: RESUMO/CONCLUSÃO
- Último slide: CTA (convite para ação)

Responda APENAS em JSON válido, sem markdown:
{
  "titulo": "título do carrossel",
  "conteudo": "descrição/legenda do post",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"],
  "cta": "call to action da legenda",
  "slides": [
    {
      "slideNumber": 1,
      "titulo": "texto principal do slide (curto, impactante)",
      "conteudo": "texto complementar se necessário",
      "imagePrompt": "prompt em inglês para a imagem de fundo deste slide"
    }
  ],
  "imagePrompt": "prompt em inglês para a capa/thumbnail do carrossel"
}`;
}

export function buildReelsPrompt(ctx: EmpresaContext, topic: string, tone: ContentTone): string {
  return `Você é um roteirista brasileiro expert em Reels virais de Instagram e TikTok.

${buildContextBlock(ctx)}

TOM DE VOZ: ${toneMap[tone]}

Crie um roteiro de Reels sobre: "${topic}"

O roteiro deve ter:
- HOOK nos primeiros 3 segundos (frase/ação que prende atenção)
- CORPO com 3-5 pontos rápidos
- CTA no final
- Duração entre 30-60 segundos

Responda APENAS em JSON válido, sem markdown:
{
  "titulo": "título/conceito do reel",
  "conteudo": "legenda completa do post",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"],
  "cta": "call to action da legenda",
  "reelsScript": {
    "hook": "frase/ação de abertura (3 segundos)",
    "corpo": ["ponto 1", "ponto 2", "ponto 3"],
    "cta": "chamada final no vídeo",
    "duracao": "30-45s",
    "musica_sugerida": "sugestão de estilo de música ou trending audio"
  },
  "imagePrompt": "prompt em inglês para thumbnail do reel"
}`;
}

export function buildEmailPrompt(ctx: EmpresaContext, topic: string, tone: ContentTone): string {
  return `Você é um copywriter brasileiro especialista em email marketing que converte.

${buildContextBlock(ctx)}

TOM DE VOZ: ${toneMap[tone]}

Crie um email marketing sobre: "${topic}"

O email deve ter:
- Subject line irresistível (max 60 caracteres)
- Preview text
- Corpo com storytelling
- CTA claro

Responda APENAS em JSON válido, sem markdown:
{
  "titulo": "subject line do email",
  "conteudo": "preview text (primeira linha visível na caixa de entrada)",
  "emailSubject": "subject line do email",
  "emailBody": "corpo completo do email em HTML simples (use <p>, <strong>, <br>, <a>)",
  "cta": "texto do botão CTA",
  "hashtags": [],
  "imagePrompt": "prompt em inglês para header image do email"
}`;
}

export function buildCopyPrompt(ctx: EmpresaContext, topic: string, tone: ContentTone): string {
  return `Você é um copywriter brasileiro expert em textos persuasivos para marketing digital.

${buildContextBlock(ctx)}

TOM DE VOZ: ${toneMap[tone]}

Crie uma copy de marketing sobre: "${topic}"

Gere variações para diferentes usos:
- Headline principal
- Subheadline
- Texto para anúncio (curto, 125 chars)
- Texto para landing page (parágrafo)
- CTA

Responda APENAS em JSON válido, sem markdown:
{
  "titulo": "headline principal",
  "conteudo": "subheadline + texto para landing page completo",
  "hashtags": [],
  "cta": "texto do CTA principal",
  "imagePrompt": "prompt em inglês para visual que acompanhe esta copy"
}`;
}

export function getPromptForFormat(format: ContentFormat, ctx: EmpresaContext, topic: string, tone: ContentTone, plataformas: string[]): string {
  switch (format) {
    case "post": return buildPostPrompt(ctx, topic, tone, plataformas);
    case "carrossel": return buildCarouselPrompt(ctx, topic, tone, 7);
    case "reels": return buildReelsPrompt(ctx, topic, tone);
    case "email": return buildEmailPrompt(ctx, topic, tone);
    case "copy": return buildCopyPrompt(ctx, topic, tone);
  }
}
