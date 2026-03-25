import { EmpresaContext, ContentTone, ContentFormat } from "@/types/ai";

function buildContextBlock(ctx: EmpresaContext): string {
  let block = `
EMPRESA: ${ctx.nome}
NICHO: ${ctx.nicho}
DESCRIÇÃO: ${ctx.descricao}`;
  if (ctx.website) block += `\nSITE: ${ctx.website}`;
  if (ctx.siteAnalysis) block += `\nANÁLISE DO SITE:\n${ctx.siteAnalysis}`;
  if (ctx.instagramAnalysis) block += `\nANÁLISE DO INSTAGRAM:\n${ctx.instagramAnalysis}`;

  // DNA da Marca — structured brand intelligence
  if (ctx.dnaMarca) {
    try {
      const dna = JSON.parse(ctx.dnaMarca);
      block += `\n\n═══ DNA DA MARCA ═══`;
      if (dna.tom_de_voz) block += `\nTOM DE VOZ: ${dna.tom_de_voz}`;
      if (dna.personalidade_marca) block += `\nPERSONALIDADE: ${dna.personalidade_marca}`;
      if (dna.proposta_valor) block += `\nPROPOSTA DE VALOR: ${dna.proposta_valor}`;
      if (dna.publico_alvo) block += `\nPÚBLICO-ALVO: ${dna.publico_alvo}`;
      if (dna.estilo_visual) block += `\nESTILO VISUAL: ${dna.estilo_visual}`;
      if (dna.pilares_conteudo?.length) block += `\nPILARES DE CONTEÚDO: ${dna.pilares_conteudo.join(" | ")}`;
      if (dna.frequencia_ideal) block += `\nFREQUÊNCIA IDEAL: ${dna.frequencia_ideal}`;
      if (dna.diferenciais_vs_concorrentes?.length) block += `\nDIFERENCIAIS: ${dna.diferenciais_vs_concorrentes.join(" | ")}`;
      if (dna.palavras_usar?.length) block += `\nPALAVRAS PARA USAR: ${dna.palavras_usar.join(", ")}`;
      if (dna.palavras_evitar?.length) block += `\nPALAVRAS PARA EVITAR: ${dna.palavras_evitar.join(", ")}`;
      if (dna.hashtags_recomendadas?.length) block += `\nHASHTAGS DA MARCA: ${dna.hashtags_recomendadas.join(" ")}`;
      if (dna.exemplos_legenda?.length) block += `\nEXEMPLOS DE TOM (use como referência de estilo):\n${dna.exemplos_legenda.map((e: string, i: number) => `  ${i + 1}. ${e}`).join("\n")}`;
      block += `\n═══════════════════`;
    } catch {
      // Invalid DNA JSON, skip
    }
  }

  return block;
}

function buildDNAInstruction(ctx: EmpresaContext): string {
  if (!ctx.dnaMarca) return "";
  return "\nIMPORTANTE: Siga rigorosamente o DNA DA MARCA acima. Use o tom de voz definido, as palavras recomendadas, e evite as palavras proibidas. As hashtags devem incluir as hashtags da marca. O conteúdo deve estar alinhado aos pilares de conteúdo e diferenciais listados.";
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
${buildDNAInstruction(ctx)}
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
${buildDNAInstruction(ctx)}
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
${buildDNAInstruction(ctx)}
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
${buildDNAInstruction(ctx)}
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
${buildDNAInstruction(ctx)}
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
