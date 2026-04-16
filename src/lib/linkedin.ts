/**
 * LinkedIn API — biblioteca cliente para ContIA
 *
 * Nível 1: scopes auto-aprovados apenas (openid, profile, email, w_member_social)
 * Nível 2 (requer CMA approval): r_organization_social, w_organization_social, r_member_postAnalytics
 *
 * Referência: https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2
 */

/* ── Constantes ──────────────────────────────────────────────────────────── */

const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2'
const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization'
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken'

/** Scopes Nível 1 — todos auto-aprovados, não requerem CMA */
const SCOPES = ['openid', 'profile', 'email', 'w_member_social']

/* ── Tipos ───────────────────────────────────────────────────────────────── */

export interface LinkedInTokenResponse {
  access_token: string
  expires_in: number
  scope: string
  token_type: string
}

export interface LinkedInProfile {
  /** sub == LinkedIn member URN (ex: "ABC123") — usar para author URN */
  sub: string
  name: string
  given_name: string
  family_name: string
  picture: string | null
  email: string
  email_verified: boolean
  locale: string
}

export interface LinkedInPostResponse {
  id: string
}

export class LinkedInAPIError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'LinkedInAPIError'
  }
}

/* ── Helpers internos ────────────────────────────────────────────────────── */

function getClientId(): string {
  const id = process.env.LINKEDIN_CLIENT_ID
  if (!id) throw new Error('LINKEDIN_CLIENT_ID não configurado')
  return id
}

function getClientSecret(): string {
  const secret = process.env.LINKEDIN_CLIENT_SECRET
  if (!secret) throw new Error('LINKEDIN_CLIENT_SECRET não configurado')
  return secret
}

function getAppUrl(): string {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000'
  )
}

/**
 * Lança LinkedInAPIError para respostas de erro da API.
 * Tenta extrair mensagem do corpo JSON.
 */
async function assertOk(res: Response, context: string): Promise<void> {
  if (res.ok) return

  let body: Record<string, unknown> = {}
  try {
    body = (await res.json()) as Record<string, unknown>
  } catch {
    // ignora se body não for JSON
  }

  const message =
    (body.message as string) ||
    (body.error_description as string) ||
    (body.error as string) ||
    `LinkedIn API error ${res.status}`

  throw new LinkedInAPIError(
    res.status,
    String(body.serviceErrorCode ?? body.error ?? res.status),
    `[${context}] ${message}`
  )
}

/* ── OAuth ───────────────────────────────────────────────────────────────── */

/**
 * Retorna a URL de autorização OAuth do LinkedIn.
 * @param state - string base64url com empresa_id, user_id e nonce (proteção CSRF)
 */
export function getOAuthURL(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: getClientId(),
    redirect_uri: `${getAppUrl()}/api/linkedin/callback`,
    scope: SCOPES.join(' '),
    state,
  })

  return `${LINKEDIN_AUTH_URL}?${params.toString()}`
}

/**
 * Troca o authorization code por access_token.
 * LinkedIn Nível 1 NÃO retorna refresh_token — tokens duram 60 dias.
 * Reconexão manual necessária quando expirar.
 */
export async function exchangeCodeForToken(
  code: string
): Promise<LinkedInTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: `${getAppUrl()}/api/linkedin/callback`,
    client_id: getClientId(),
    client_secret: getClientSecret(),
  })

  const res = await fetch(LINKEDIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  await assertOk(res, 'exchangeCodeForToken')
  return res.json() as Promise<LinkedInTokenResponse>
}

/* ── Perfil ──────────────────────────────────────────────────────────────── */

/**
 * Busca o perfil do usuário via OpenID Connect userinfo endpoint.
 * Retorna sub (member URN), name, picture, email, headline (locale).
 * Scope necessário: openid, profile, email
 */
export async function getProfile(accessToken: string): Promise<LinkedInProfile> {
  const res = await fetch(`${LINKEDIN_API_BASE}/userinfo`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'LinkedIn-Version': '202401',
    },
  })

  await assertOk(res, 'getProfile')
  return res.json() as Promise<LinkedInProfile>
}

/* ── Publicação ──────────────────────────────────────────────────────────── */

export type LinkedInVisibility = 'PUBLIC' | 'CONNECTIONS'

export interface LinkedInPostParams {
  /** Texto principal do post */
  commentary: string
  /**
   * Visibilidade do post.
   * PUBLIC = visível para todos; CONNECTIONS = apenas conexões.
   */
  visibility?: LinkedInVisibility
}

/**
 * Publica um post de texto no feed PESSOAL do usuário.
 * Scope necessário: w_member_social
 *
 * NÍVEL 1 APENAS — publicação em Company Page requer CMA approval.
 *
 * @param accessToken - token OAuth do usuário
 * @param authorSub   - sub do /userinfo (ex: "ABC123") — convertido para URN
 * @param params      - conteúdo e visibilidade do post
 */
export async function publishPost(
  accessToken: string,
  authorSub: string,
  params: LinkedInPostParams
): Promise<LinkedInPostResponse> {
  const authorUrn = authorSub.startsWith('urn:li:')
    ? authorSub
    : `urn:li:person:${authorSub}`

  const payload = {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: {
          text: params.commentary,
        },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility':
        params.visibility ?? 'PUBLIC',
    },
  }

  const res = await fetch(`${LINKEDIN_API_BASE}/ugcPosts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202401',
    },
    body: JSON.stringify(payload),
  })

  await assertOk(res, 'publishPost')

  // LinkedIn retorna o ID do post no header X-RestLi-Id
  const postId =
    res.headers.get('x-restli-id') ||
    res.headers.get('X-RestLi-Id') ||
    (res.status === 201 ? 'created' : '')

  if (!postId) {
    throw new LinkedInAPIError(
      res.status,
      'no_post_id',
      '[publishPost] Post criado mas ID não retornado no header'
    )
  }

  return { id: postId }
}
