/**
 * Metadata de todos os 9 providers — ContIA 2.0
 *
 * Contém requirements, instructions, capabilities, ícone e cor de cada provider.
 * Usado pela UI de /conexoes para renderizar cards e wizards.
 *
 * Ícones: nomes do lucide-react (importar com dynamic import no componente).
 */

import type { ProviderKey, ProviderMetadata } from '@/types/providers'

export const METADATA_BY_PROVIDER: Record<ProviderKey, ProviderMetadata> = {
  instagram: {
    key: 'instagram',
    displayName: 'Instagram',
    description: 'Posts, Reels, Stories, métricas de engajamento e crescimento de seguidores.',
    color: '#E4405F',
    iconName: 'Instagram',
    category: 'social',
    status: 'available',
    estimatedTime: '2 minutos',
    requirements: [
      {
        type: 'account',
        label: 'Conta Business ou Creator',
        description: 'Sua conta do Instagram precisa ser Business ou Creator (não pessoal).',
        link: 'https://help.instagram.com/502981923235522',
      },
      {
        type: 'account',
        label: 'Página do Facebook vinculada',
        description: 'A conta IG Business precisa estar conectada a uma Facebook Page.',
        link: 'https://help.instagram.com/570895513091465',
      },
    ],
    instructions: [
      {
        step: 1,
        title: 'Clique em Conectar',
        description: 'Você será redirecionado para o login do Instagram.',
        icon: 'LogIn',
      },
      {
        step: 2,
        title: 'Faça login no Instagram',
        description: 'Entre com a conta que deseja conectar.',
        icon: 'User',
      },
      {
        step: 3,
        title: 'Autorize as permissões',
        description: 'Permita acesso a insights, conteúdo e comentários.',
        icon: 'Shield',
      },
      {
        step: 4,
        title: 'Pronto!',
        description: 'Seus dados começarão a ser sincronizados automaticamente.',
        icon: 'CheckCircle',
      },
    ],
    capabilities: {
      canPublish: true,
      canSchedule: true,
      canReadEngagement: true,
      canReadDemographics: true,
      canReadAds: false,
      canReadComments: true,
    },
  },

  facebook: {
    key: 'facebook',
    displayName: 'Facebook Pages',
    description: 'Métricas de página, posts, alcance e engajamento do Facebook.',
    color: '#1877F2',
    iconName: 'Facebook',
    category: 'social',
    status: 'available',
    estimatedTime: '30 segundos',
    requirements: [
      {
        type: 'account',
        label: 'Página do Facebook',
        description: 'Você precisa ser administrador de uma Facebook Page.',
        link: 'https://www.facebook.com/pages/create',
      },
    ],
    instructions: [
      {
        step: 1,
        title: 'Clique em Conectar',
        description: 'Mesmo login do Instagram — se já conectou IG, é instantâneo.',
        icon: 'LogIn',
      },
      {
        step: 2,
        title: 'Selecione a Página',
        description: 'Escolha qual Facebook Page deseja monitorar.',
        icon: 'FileText',
      },
      {
        step: 3,
        title: 'Pronto!',
        description: 'Métricas da página serão coletadas diariamente.',
        icon: 'CheckCircle',
      },
    ],
    capabilities: {
      canPublish: true,
      canSchedule: true,
      canReadEngagement: true,
      canReadDemographics: true,
      canReadAds: false,
      canReadComments: true,
    },
  },

  linkedin: {
    key: 'linkedin',
    displayName: 'LinkedIn',
    description: 'Publique no feed pessoal com IA. Analytics de Company Page disponível após aprovação CMA.',
    color: '#0A66C2',
    iconName: 'Linkedin',
    category: 'social',
    status: 'available',
    estimatedTime: '2 minutos',
    requirements: [
      {
        type: 'account',
        label: 'Company Page no LinkedIn',
        description: 'Você precisa ser admin de uma Company Page.',
        link: 'https://www.linkedin.com/company/setup/new/',
      },
      {
        type: 'permission',
        label: 'Community Management API (CMA)',
        description: 'Para acesso completo, o app precisa de aprovação CMA (1-4 semanas). Nível 1 funciona sem review.',
        link: 'https://learn.microsoft.com/en-us/linkedin/marketing/community-management/',
      },
    ],
    instructions: [
      {
        step: 1,
        title: 'Clique em Conectar',
        description: 'Você será redirecionado para o LinkedIn OAuth.',
        icon: 'LogIn',
      },
      {
        step: 2,
        title: 'Faça login no LinkedIn',
        description: 'Entre com a conta que é admin da Company Page.',
        icon: 'User',
      },
      {
        step: 3,
        title: 'Autorize o acesso',
        description: 'Permita leitura de posts e métricas da organização.',
        icon: 'Shield',
      },
      {
        step: 4,
        title: 'Selecione a Company Page',
        description: 'Escolha qual organização deseja monitorar.',
        icon: 'Building',
      },
    ],
    capabilities: {
      canPublish: true,
      canSchedule: false,
      canReadEngagement: true,
      canReadDemographics: true,
      canReadAds: false,
      canReadComments: true,
    },
  },

  youtube: {
    key: 'youtube',
    displayName: 'YouTube',
    description: 'Canal: vídeos, views, inscritos, watch time e métricas de engajamento.',
    color: '#FF0000',
    iconName: 'Youtube',
    category: 'social',
    status: 'coming_soon',
    estimatedTime: '1 minuto',
    requirements: [
      {
        type: 'account',
        label: 'Canal do YouTube',
        description: 'Você precisa ter um canal no YouTube.',
        link: 'https://www.youtube.com/create_channel',
      },
      {
        type: 'setup',
        label: 'YouTube Analytics ativo',
        description: 'O canal precisa ter o YouTube Analytics habilitado (padrão para canais com conteúdo).',
      },
    ],
    instructions: [
      {
        step: 1,
        title: 'Clique em Conectar',
        description: 'Você será redirecionado para o Google OAuth.',
        icon: 'LogIn',
      },
      {
        step: 2,
        title: 'Faça login no Google',
        description: 'Entre com a conta que gerencia o canal.',
        icon: 'User',
      },
      {
        step: 3,
        title: 'Autorize o YouTube Analytics',
        description: 'Permita leitura de métricas e dados do canal.',
        icon: 'Shield',
      },
      {
        step: 4,
        title: 'Selecione o canal',
        description: 'Se tiver múltiplos canais, escolha qual monitorar.',
        icon: 'MonitorPlay',
      },
    ],
    capabilities: {
      canPublish: false,
      canSchedule: false,
      canReadEngagement: true,
      canReadDemographics: true,
      canReadAds: false,
      canReadComments: true,
    },
  },

  ga4: {
    key: 'ga4',
    displayName: 'Google Analytics 4',
    description: 'Tráfego do site: sessões, usuários, conversões, origens e comportamento.',
    color: '#E37400',
    iconName: 'BarChart3',
    category: 'analytics',
    status: 'coming_soon',
    estimatedTime: '1 minuto',
    requirements: [
      {
        type: 'account',
        label: 'Propriedade GA4',
        description: 'Você precisa ter uma propriedade GA4 configurada para seu site.',
        link: 'https://analytics.google.com/',
      },
      {
        type: 'permission',
        label: 'Acesso de leitura',
        description: 'Sua conta Google precisa ter pelo menos permissão de Viewer na propriedade.',
      },
    ],
    instructions: [
      {
        step: 1,
        title: 'Clique em Conectar',
        description: 'Mesmo login do Google — se já conectou YouTube, é rápido.',
        icon: 'LogIn',
      },
      {
        step: 2,
        title: 'Autorize o Analytics',
        description: 'Permita leitura dos dados do Google Analytics.',
        icon: 'Shield',
      },
      {
        step: 3,
        title: 'Selecione a Propriedade',
        description: 'Escolha qual propriedade GA4 deseja monitorar.',
        icon: 'BarChart3',
      },
    ],
    capabilities: {
      canPublish: false,
      canSchedule: false,
      canReadEngagement: true,
      canReadDemographics: true,
      canReadAds: false,
      canReadComments: false,
    },
  },

  google_ads: {
    key: 'google_ads',
    displayName: 'Google Ads',
    description: 'Campanhas, CPC, conversões, ROAS e performance de anúncios Google.',
    color: '#4285F4',
    iconName: 'Megaphone',
    category: 'ads',
    status: 'coming_soon',
    estimatedTime: '3 minutos',
    requirements: [
      {
        type: 'account',
        label: 'Conta Google Ads',
        description: 'Você precisa ter uma conta Google Ads ativa.',
        link: 'https://ads.google.com/',
      },
      {
        type: 'setup',
        label: 'Customer ID',
        description: 'Tenha em mãos o Customer ID da conta (formato: XXX-XXX-XXXX).',
      },
      {
        type: 'external',
        label: 'Developer Token aprovado',
        description: 'O acesso à API do Google Ads requer um Developer Token (solicitação leva 1-2 semanas).',
        link: 'https://developers.google.com/google-ads/api/docs/get-started/dev-token',
      },
    ],
    instructions: [
      {
        step: 1,
        title: 'Clique em Conectar',
        description: 'Mesmo login do Google — compartilha autenticação com GA4/YouTube.',
        icon: 'LogIn',
      },
      {
        step: 2,
        title: 'Autorize o Google Ads',
        description: 'Permita leitura de campanhas e métricas de anúncios.',
        icon: 'Shield',
      },
      {
        step: 3,
        title: 'Informe o Customer ID',
        description: 'Digite o ID da conta Google Ads (encontrado no canto superior direito do painel).',
        icon: 'Hash',
      },
    ],
    capabilities: {
      canPublish: false,
      canSchedule: false,
      canReadEngagement: true,
      canReadDemographics: true,
      canReadAds: true,
      canReadComments: false,
    },
  },

  meta_ads: {
    key: 'meta_ads',
    displayName: 'Meta Ads',
    description: 'Campanhas Facebook/Instagram Ads: alcance, CPC, conversões e ROAS.',
    color: '#0668E1',
    iconName: 'Target',
    category: 'ads',
    status: 'available',
    estimatedTime: '1 minuto',
    requirements: [
      {
        type: 'account',
        label: 'Conta de Anúncios Meta',
        description: 'Você precisa ter acesso a uma Ad Account no Meta Business Suite.',
        link: 'https://business.facebook.com/',
      },
      {
        type: 'permission',
        label: 'Permissão ads_read',
        description: 'O app precisa do scope ads_read (mesmo Meta App do Instagram).',
      },
    ],
    instructions: [
      {
        step: 1,
        title: 'Clique em Conectar',
        description: 'Mesmo login do Meta — se já conectou Instagram, é instantâneo.',
        icon: 'LogIn',
      },
      {
        step: 2,
        title: 'Selecione a Ad Account',
        description: 'Escolha qual conta de anúncios deseja monitorar.',
        icon: 'Target',
      },
      {
        step: 3,
        title: 'Pronto!',
        description: 'Métricas de campanhas serão coletadas diariamente.',
        icon: 'CheckCircle',
      },
    ],
    capabilities: {
      canPublish: false,
      canSchedule: false,
      canReadEngagement: true,
      canReadDemographics: true,
      canReadAds: true,
      canReadComments: false,
    },
  },

  greatpages: {
    key: 'greatpages',
    displayName: 'GreatPages',
    description: 'Landing pages: leads capturados, conversões e performance via webhook do CRM.',
    color: '#10B981',
    iconName: 'LayoutTemplate',
    category: 'landing',
    status: 'coming_soon',
    estimatedTime: '0 cliques',
    requirements: [
      {
        type: 'external',
        label: 'CRM BGPGO conectado',
        description: 'Os dados vêm automaticamente via webhook do CRM. Basta ter landing pages publicadas.',
      },
      {
        type: 'setup',
        label: 'UTM configurado',
        description: 'Landing pages devem usar utm_medium=greatpages para identificação automática.',
      },
    ],
    instructions: [
      {
        step: 1,
        title: 'Automático',
        description: 'GreatPages é conectado automaticamente quando o CRM detecta leads com UTM de landing pages.',
        icon: 'Zap',
      },
      {
        step: 2,
        title: 'Verifique o CRM',
        description: 'Confirme que seus leads estão chegando com utm_medium=greatpages no CRM.',
        icon: 'CheckCircle',
      },
    ],
    capabilities: {
      canPublish: false,
      canSchedule: false,
      canReadEngagement: true,
      canReadDemographics: false,
      canReadAds: false,
      canReadComments: false,
    },
  },

  crm: {
    key: 'crm',
    displayName: 'CRM BGPGO',
    description: 'Funil de vendas: leads, deals, conversões, origem de tráfego e métricas do pipeline.',
    color: '#8B5CF6',
    iconName: 'Database',
    category: 'crm',
    status: 'available',
    estimatedTime: '0 cliques',
    requirements: [
      {
        type: 'external',
        label: 'CRM com endpoint de analytics',
        description: 'O CRM precisa ter o endpoint /api/analytics/export configurado com API key.',
      },
    ],
    instructions: [
      {
        step: 1,
        title: 'Auto-conectado',
        description: 'Se você usa o CRM BGPGO, a conexão é feita automaticamente pela empresa compartilhada.',
        icon: 'Zap',
      },
      {
        step: 2,
        title: 'Dados disponíveis',
        description: 'Leads, deals, funil, conversões e métricas de vendas aparecem nos relatórios.',
        icon: 'TrendingUp',
      },
    ],
    capabilities: {
      canPublish: false,
      canSchedule: false,
      canReadEngagement: true,
      canReadDemographics: false,
      canReadAds: false,
      canReadComments: false,
    },
  },
}

/**
 * Lista de providers ordenados por prioridade de exibição na UI.
 */
export const PROVIDER_DISPLAY_ORDER: ProviderKey[] = [
  'instagram',
  'facebook',
  'meta_ads',
  'linkedin',
  'youtube',
  'ga4',
  'google_ads',
  'greatpages',
  'crm',
]

/**
 * Retorna metadata de um provider específico.
 */
export function getProviderMetadata(key: ProviderKey): ProviderMetadata {
  return METADATA_BY_PROVIDER[key]
}
