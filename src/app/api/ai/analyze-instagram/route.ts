import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient, isAIConfigured } from "@/lib/ai/config";

// ── Fetch Instagram data via multiple strategies ──────────────────────────

interface IGPostData {
  imageUrl: string;
  caption: string;
  likes: number;
  comments: number;
  timestamp: string;
  isVideo: boolean;
  shortcode: string;
}

interface IGProfileData {
  username: string;
  fullName: string;
  bio: string;
  followers: number;
  following: number;
  postCount: number;
  profilePicUrl: string;
  posts: IGPostData[];
}

async function fetchInstagramData(username: string): Promise<IGProfileData | null> {
  // Strategy 1: Try the public JSON endpoint (works without login for public profiles)
  try {
    const res = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "X-IG-App-ID": "936619743392459",
        "Accept": "*/*",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const json = await res.json();
      const user = json?.data?.user;
      if (user) {
        const posts: IGPostData[] = (user.edge_owner_to_timeline_media?.edges || [])
          .slice(0, 12)
          .map((edge: any) => {
            const node = edge.node;
            return {
              imageUrl: node.display_url || node.thumbnail_src || "",
              caption: node.edge_media_to_caption?.edges?.[0]?.node?.text || "",
              likes: node.edge_liked_by?.count || node.edge_media_preview_like?.count || 0,
              comments: node.edge_media_to_comment?.count || 0,
              timestamp: node.taken_at_timestamp ? new Date(node.taken_at_timestamp * 1000).toISOString() : "",
              isVideo: node.is_video || false,
              shortcode: node.shortcode || "",
            };
          });

        return {
          username: user.username,
          fullName: user.full_name || "",
          bio: user.biography || "",
          followers: user.edge_followed_by?.count || 0,
          following: user.edge_follow?.count || 0,
          postCount: user.edge_owner_to_timeline_media?.count || 0,
          profilePicUrl: user.profile_pic_url_hd || user.profile_pic_url || "",
          posts,
        };
      }
    }
  } catch {}

  // Strategy 2: Try scraping the HTML page for embedded JSON
  try {
    const res = await fetch(`https://www.instagram.com/${username}/`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const html = await res.text();

      // Extract meta tags
      const description = html.match(/<meta[^>]*(?:name="description"|property="og:description")[^>]*content="([^"]*)"[^>]*>/i)?.[1] || "";
      const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || "";

      // Try to find shared_data or additional_data JSON
      const sharedDataMatch = html.match(/window\._sharedData\s*=\s*({.+?});/);
      if (sharedDataMatch) {
        try {
          const sharedData = JSON.parse(sharedDataMatch[1]);
          const user = sharedData?.entry_data?.ProfilePage?.[0]?.graphql?.user;
          if (user) {
            const posts: IGPostData[] = (user.edge_owner_to_timeline_media?.edges || [])
              .slice(0, 12)
              .map((edge: any) => ({
                imageUrl: edge.node.display_url || "",
                caption: edge.node.edge_media_to_caption?.edges?.[0]?.node?.text || "",
                likes: edge.node.edge_liked_by?.count || 0,
                comments: edge.node.edge_media_to_comment?.count || 0,
                timestamp: edge.node.taken_at_timestamp ? new Date(edge.node.taken_at_timestamp * 1000).toISOString() : "",
                isVideo: edge.node.is_video || false,
                shortcode: edge.node.shortcode || "",
              }));

            return {
              username: user.username,
              fullName: user.full_name || "",
              bio: user.biography || "",
              followers: user.edge_followed_by?.count || 0,
              following: user.edge_follow?.count || 0,
              postCount: user.edge_owner_to_timeline_media?.count || 0,
              profilePicUrl: user.profile_pic_url_hd || "",
              posts,
            };
          }
        } catch {}
      }

      // If we got at least meta description, return partial data
      if (description || title) {
        return {
          username,
          fullName: title.replace(/ \(.*/, "").replace(/@.*/, "").trim(),
          bio: description,
          followers: 0,
          following: 0,
          postCount: 0,
          profilePicUrl: "",
          posts: [],
        };
      }
    }
  } catch {}

  // Strategy 3: Return null, let AI work from knowledge
  return null;
}

// ── Download images and convert to base64 for Vision API ──────────────────

async function downloadImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    return buffer.toString("base64");
  } catch {
    return null;
  }
}

// ── Main handler ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!isAIConfigured()) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  try {
    const { username } = await request.json();
    if (!username) {
      return NextResponse.json({ error: "Missing username" }, { status: 400 });
    }

    const cleanUsername = username.replace("@", "").trim();
    const openai = getOpenAIClient();

    // Fetch Instagram data
    const igData = await fetchInstagramData(cleanUsername);

    // Download post images for Vision analysis (max 6)
    const imageBase64s: string[] = [];
    if (igData?.posts?.length) {
      const downloadPromises = igData.posts.slice(0, 6).map((p) => downloadImageAsBase64(p.imageUrl));
      const results = await Promise.allSettled(downloadPromises);
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          imageBase64s.push(r.value);
        }
      }
    }

    // Build context for GPT
    const profileContext = igData
      ? `
Perfil: @${igData.username} (${igData.fullName})
Bio: ${igData.bio}
Seguidores: ${igData.followers.toLocaleString()}
Posts: ${igData.postCount}

Últimas legendas:
${igData.posts
  .slice(0, 10)
  .map((p, i) => `${i + 1}. ${p.caption.slice(0, 300)}${p.caption.length > 300 ? "..." : ""} [❤️ ${p.likes} 💬 ${p.comments}${p.isVideo ? " 🎥" : ""}]`)
  .join("\n")}
`
      : `Perfil: @${cleanUsername} (dados detalhados não disponíveis — analise com base no que você conhece sobre o nicho)`;

    // Build Vision messages if we have images
    const imageMessages: any[] = imageBase64s.map((b64) => ({
      type: "image_url" as const,
      image_url: { url: `data:image/jpeg;base64,${b64}`, detail: "low" as const },
    }));

    const hasImages = imageMessages.length > 0;
    const model = hasImages ? "gpt-4o" : "gpt-4o-mini";

    const systemPrompt = `Você é um analista expert de design e estratégia para Instagram. ${
      hasImages
        ? "Analise VISUALMENTE as imagens dos posts fornecidos. Foque no estilo visual: backgrounds, overlays, posicionamento de texto, containers, cores, tipografia, elementos gráficos."
        : "Analise o perfil com base nas informações fornecidas e seu conhecimento sobre este nicho."
    }

REGRAS CRÍTICAS:
1. Responda EXCLUSIVAMENTE em JSON válido
2. NÃO use markdown, NÃO use code blocks
3. NÃO inclua explicações fora do JSON
4. Comece sua resposta com { e termine com }`;

    const userContent: any[] = [
      {
        type: "text",
        text: `${profileContext}

${hasImages ? `Analisei ${imageMessages.length} imagens dos posts mais recentes (anexadas abaixo).` : ""}

Responda neste JSON EXATO (sem markdown, sem code blocks, apenas JSON puro):
{"profile":{"resumo_visual":"descrição detalhada do estilo visual","tom_legendas":"tom das legendas","temas_recorrentes":["tema1","tema2","tema3"],"estilo_visual":"padrão visual dominante","formatos_mais_usados":["formato1","formato2"],"hashtags_frequentes":["#tag1","#tag2","#tag3"],"frequencia_postagem":"estimativa"},"visual_style":{"layout":"descrição do layout mais usado","background":{"type":"image-darkened","overlay_opacity":0.6,"colors":["#hex1","#hex2"]},"text":{"position":"center","has_container":true,"container_style":"descrição","font_style":"bold-sans","title_size":"large","colors":["#fff"]},"elements":["elemento1"],"aspect_ratio":"1:1"},"recent_posts":[{"caption":"resumo","visual_description":"descrição visual","format":"tipo","engagement_cues":["cue1"],"topic":"tema"}],"suggested_next_posts":[{"topic":"tema","format":"formato","reasoning":"motivo","hook":"gancho"}]}`,
      },
      ...imageMessages,
    ];

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.4,
      max_tokens: 3000,
    });

    const raw = completion.choices[0]?.message?.content || "";

    // Robust JSON extraction
    let jsonStr = raw.trim();

    // Remove markdown code blocks if present
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
    }

    // Try to find JSON object in the response
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    let analysis;
    try {
      analysis = JSON.parse(jsonStr);
    } catch {
      // If JSON parsing fails, build a fallback response
      console.error("Failed to parse GPT response as JSON. Raw:", raw.slice(0, 200));
      analysis = {
        profile: {
          resumo_visual: `Perfil @${cleanUsername} analisado com dados limitados`,
          tom_legendas: "Não determinado",
          temas_recorrentes: [],
          estilo_visual: "Não determinado",
          formatos_mais_usados: ["imagem", "carrossel"],
          hashtags_frequentes: [],
          frequencia_postagem: "Não determinado",
        },
        visual_style: {
          layout: "imagem-com-texto-sobreposto",
          background: { type: "image-darkened", overlay_opacity: 0.5, colors: ["#1a1a2e", "#6c5ce7"] },
          text: { position: "center", has_container: true, container_style: "retângulo semi-transparente", font_style: "bold-sans", title_size: "large", colors: ["#ffffff"] },
          elements: [],
          aspect_ratio: "1:1",
        },
        recent_posts: igData?.posts?.slice(0, 10).map((p) => ({
          caption: p.caption.slice(0, 100),
          visual_description: "Não analisado visualmente",
          format: p.isVideo ? "video" : "imagem",
          engagement_cues: [],
          topic: "",
        })) || [],
        suggested_next_posts: [
          { topic: "Conteúdo educacional sobre o nicho", format: "carrossel", reasoning: "Carrosséis educacionais geram alto engajamento", hook: "Você sabia que..." },
          { topic: "Bastidores da empresa", format: "reels", reasoning: "Reels de bastidores humanizam a marca", hook: "Vem ver como funciona por trás..." },
          { topic: "Depoimento de cliente", format: "imagem", reasoning: "Prova social aumenta conversão", hook: "Olha o que nosso cliente disse..." },
        ],
      };
    }

    return NextResponse.json(analysis);
  } catch (error: any) {
    console.error("Instagram analysis error:", error);
    return NextResponse.json(
      { error: error.message || "Analysis failed" },
      { status: 500 }
    );
  }
}
