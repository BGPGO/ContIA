import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidade — GO Studio",
  description:
    "Saiba como o GO Studio coleta, usa, armazena e protege seus dados pessoais e das redes sociais conectadas. Em conformidade com a LGPD.",
  alternates: {
    canonical: "https://contia.bertuzzipatrimonial.com.br/privacidade",
  },
};

/* ── Tabela de conteúdo ── */
const TOC_ITEMS = [
  { id: "quem-somos", label: "1. Quem somos" },
  { id: "dados-coletados", label: "2. Dados coletados" },
  { id: "finalidades", label: "3. Por que coletamos" },
  { id: "compartilhamento", label: "4. Como compartilhamos" },
  { id: "armazenamento", label: "5. Onde armazenamos" },
  { id: "retencao", label: "6. Retenção de dados" },
  { id: "direitos", label: "7. Seus direitos (LGPD)" },
  { id: "cookies", label: "8. Cookies" },
  { id: "seguranca", label: "9. Segurança" },
  { id: "criancas", label: "10. Menores de idade" },
  { id: "mudancas", label: "11. Mudanças nesta política" },
  { id: "contato", label: "12. Contato e DPO" },
];

export default function PrivacidadePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      {/* Cabeçalho */}
      <div className="mb-10">
        <p className="text-sm font-medium text-[#4ecdc4] mb-2 uppercase tracking-widest">
          Legal
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-[#e8eaff] mb-3">
          Política de Privacidade
        </h1>
        <p className="text-[#8b8fb0] text-sm">
          Última atualização: <time dateTime="2026-04-15">15 de abril de 2026</time>
        </p>
        <p className="mt-4 text-[#8b8fb0] text-sm leading-relaxed">
          Esta Política de Privacidade explica como a <strong className="text-[#e8eaff]">BGP — Bertuzzi Patrimonial</strong>,
          operadora da plataforma GO Studio, coleta, usa, armazena e protege seus dados pessoais
          e os dados das redes sociais que você conecta. Estamos em conformidade com a
          Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018) e com as políticas de
          dados da Meta, LinkedIn e Google.
        </p>
      </div>

      {/* Sumário (TOC) */}
      <nav
        aria-label="Sumário da Política de Privacidade"
        className="mb-10 bg-[#0c0f24] border border-[#1e2348] rounded-xl p-5"
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-[#5e6388] mb-3">
          Sumário
        </p>
        <ol className="space-y-1.5">
          {TOC_ITEMS.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className="text-sm text-[#8b8fb0] hover:text-[#4ecdc4] transition-colors"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* Conteúdo */}
      <div className="space-y-12 text-[#c4c7e8] leading-relaxed">

        {/* 1. Quem somos */}
        <section id="quem-somos" aria-labelledby="h-quem-somos">
          <h2
            id="h-quem-somos"
            className="text-xl font-semibold text-[#e8eaff] mb-4 pb-2 border-b border-[#1e2348]"
          >
            1. Quem somos
          </h2>
          <p>
            O GO Studio é uma plataforma SaaS de criação de conteúdo, publicação e analytics
            para redes sociais, operada por:
          </p>
          <div className="mt-4 bg-[#0c0f24] border border-[#1e2348] rounded-lg p-4 text-sm space-y-1">
            <p><strong className="text-[#e8eaff]">Razão social:</strong> BGP — Bertuzzi Patrimonial Gestão de Recursos Ltda</p>
            <p><strong className="text-[#e8eaff]">CNPJ:</strong> <span className="text-[#fbbf24]">[CNPJ a confirmar]</span></p>
            <p><strong className="text-[#e8eaff]">Endereço:</strong> <span className="text-[#fbbf24]">[Endereço completo a confirmar]</span></p>
            <p><strong className="text-[#e8eaff]">E-mail de contato:</strong>{" "}
              <a href="mailto:oliver@bertuzzipatrimonial.com.br" className="text-[#4ecdc4] hover:underline">
                oliver@bertuzzipatrimonial.com.br
              </a>
            </p>
            <p><strong className="text-[#e8eaff]">Site:</strong>{" "}
              <a href="https://contia.bertuzzipatrimonial.com.br" className="text-[#4ecdc4] hover:underline" target="_blank" rel="noopener noreferrer">
                contia.bertuzzipatrimonial.com.br
              </a>
            </p>
          </div>
        </section>

        {/* 2. Dados coletados */}
        <section id="dados-coletados" aria-labelledby="h-dados-coletados">
          <h2
            id="h-dados-coletados"
            className="text-xl font-semibold text-[#e8eaff] mb-4 pb-2 border-b border-[#1e2348]"
          >
            2. Que dados coletamos
          </h2>

          <h3 className="text-base font-semibold text-[#e8eaff] mt-5 mb-2">2.1 Dados de cadastro</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Nome completo</li>
            <li>Endereço de e-mail</li>
            <li>Senha (armazenada com hash bcrypt via Supabase Auth — nunca em texto puro)</li>
          </ul>

          <h3 className="text-base font-semibold text-[#e8eaff] mt-5 mb-2">2.2 Dados das redes sociais conectadas</h3>
          <p className="text-sm mb-3">
            Ao conectar uma conta de rede social, coletamos exclusivamente os dados necessários
            para as funcionalidades da plataforma, via OAuth 2.0 com escopos declarados no
            momento da autorização:
          </p>

          <div className="space-y-4">
            {/* Instagram / Facebook */}
            <div className="bg-[#0c0f24] border border-[#1e2348] rounded-lg p-4">
              <p className="text-sm font-semibold text-[#e1306c] mb-2">Instagram Business &amp; Facebook Pages (Meta)</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>ID da conta, username, nome de exibição e foto de perfil</li>
                <li>Número de seguidores e perfis seguidos</li>
                <li>Biografia e categoria do perfil</li>
                <li>Lista de posts e reels (ID, tipo de mídia, legenda, URL de mídia, data de publicação)</li>
                <li>Métricas por post: impressões, alcance, curtidas, comentários, salvamentos, compartilhamentos</li>
                <li>Insights agregados da conta: alcance semanal/mensal, impressões totais, crescimento de seguidores</li>
                <li>Comentários públicos (texto, autor, data) para análise de sentimento</li>
                <li>Stories e suas métricas quando disponíveis via API</li>
                <li>Token de acesso OAuth (criptografado em repouso)</li>
              </ul>
            </div>

            {/* LinkedIn */}
            <div className="bg-[#0c0f24] border border-[#1e2348] rounded-lg p-4">
              <p className="text-sm font-semibold text-[#0a66c2] mb-2">LinkedIn (Páginas de Empresa)</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>ID da organização, nome da empresa e logo</li>
                <li>Número de seguidores e funcionários declarados</li>
                <li>Posts da página (ID, texto, mídia, data de publicação)</li>
                <li>Métricas de posts: impressões, cliques, curtidas, comentários, compartilhamentos</li>
                <li>Insights da página: visualizações, crescimento de seguidores (dados agregados)</li>
                <li>Token de acesso OAuth (criptografado em repouso)</li>
              </ul>
            </div>

            {/* YouTube / Google */}
            <div className="bg-[#0c0f24] border border-[#1e2348] rounded-lg p-4">
              <p className="text-sm font-semibold text-[#ff0000] mb-2">YouTube (Google)</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>ID do canal, nome, foto de perfil e descrição</li>
                <li>Número de inscritos, visualizações totais e número de vídeos</li>
                <li>Lista de vídeos (ID, título, descrição, thumbnail, data de publicação)</li>
                <li>Métricas por vídeo: visualizações, curtidas, comentários, tempo de exibição</li>
                <li>Dados de retenção de audiência e tráfego agregados</li>
                <li>Token OAuth Google (criptografado em repouso)</li>
              </ul>
            </div>

            {/* Google Analytics 4 */}
            <div className="bg-[#0c0f24] border border-[#1e2348] rounded-lg p-4">
              <p className="text-sm font-semibold text-[#60a5fa] mb-2">Google Analytics 4</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>ID da propriedade GA4 e nome do site</li>
                <li>Métricas agregadas: sessões, usuários, taxa de rejeição, eventos principais</li>
                <li>Fonte de tráfego (orgânico, social, direto, pago) — dados agregados</li>
                <li>Nenhum dado individual de usuários do site é armazenado</li>
              </ul>
            </div>

            {/* Meta Ads / Google Ads */}
            <div className="bg-[#0c0f24] border border-[#1e2348] rounded-lg p-4">
              <p className="text-sm font-semibold text-[#6c5ce7] mb-2">Meta Ads &amp; Google Ads</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>ID da conta de anúncios e nome</li>
                <li>Campanhas: nome, status, orçamento, datas</li>
                <li>Métricas de campanha: impressões, cliques, CPM, CPC, conversões, gasto total</li>
                <li>Conjuntos de anúncios e criativos (IDs e métricas de performance)</li>
                <li>Nenhum dado de público personalizado ou pixel é armazenado em nossos servidores</li>
              </ul>
            </div>
          </div>

          <h3 className="text-base font-semibold text-[#e8eaff] mt-5 mb-2">2.3 Dados de uso da plataforma</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Logs de acesso (endereço IP, user-agent, timestamps)</li>
            <li>Ações realizadas (posts criados, conteúdo gerado por IA, agendamentos)</li>
            <li>Preferências de configuração por empresa cadastrada</li>
          </ul>

          <h3 className="text-base font-semibold text-[#e8eaff] mt-5 mb-2">2.4 Cookies</h3>
          <p className="text-sm">
            Utilizamos apenas cookies de sessão essenciais para autenticação. Veja a seção
            {" "}<a href="#cookies" className="text-[#4ecdc4] hover:underline">8. Cookies</a> para detalhes.
          </p>
        </section>

        {/* 3. Finalidades */}
        <section id="finalidades" aria-labelledby="h-finalidades">
          <h2
            id="h-finalidades"
            className="text-xl font-semibold text-[#e8eaff] mb-4 pb-2 border-b border-[#1e2348]"
          >
            3. Por que coletamos esses dados
          </h2>
          <p className="text-sm mb-3">
            Coletamos e tratamos seus dados exclusivamente para as seguintes finalidades,
            com base legal na execução do contrato (Art. 7º, V da LGPD) e no legítimo interesse (Art. 7º, IX):
          </p>
          <ul className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="text-[#4ecdc4] mt-0.5 shrink-0">▸</span>
              <span><strong className="text-[#e8eaff]">Autenticação e acesso seguro</strong> — identificar e autenticar usuários na plataforma.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#4ecdc4] mt-0.5 shrink-0">▸</span>
              <span><strong className="text-[#e8eaff]">Relatórios de performance</strong> — consolidar métricas de múltiplas redes em um único painel analytics.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#4ecdc4] mt-0.5 shrink-0">▸</span>
              <span><strong className="text-[#e8eaff]">Geração de conteúdo por IA</strong> — enviar contexto da empresa e histórico de posts para modelos de IA (GPT-4o, Gemini) a fim de sugerir legendas, temas e formatos.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#4ecdc4] mt-0.5 shrink-0">▸</span>
              <span><strong className="text-[#e8eaff]">Publicação de conteúdo</strong> — publicar ou agendar posts nas redes sociais conectadas, sempre com autorização prévia do usuário por ação explícita.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#4ecdc4] mt-0.5 shrink-0">▸</span>
              <span><strong className="text-[#e8eaff]">Análises e insights agregados</strong> — identificar padrões de conteúdo, melhores horários de publicação e benchmarks de engajamento.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#4ecdc4] mt-0.5 shrink-0">▸</span>
              <span><strong className="text-[#e8eaff]">Comunicações operacionais</strong> — enviar notificações sobre o serviço, atualizações de política e alertas de segurança.</span>
            </li>
          </ul>
        </section>

        {/* 4. Compartilhamento */}
        <section id="compartilhamento" aria-labelledby="h-compartilhamento">
          <h2
            id="h-compartilhamento"
            className="text-xl font-semibold text-[#e8eaff] mb-4 pb-2 border-b border-[#1e2348]"
          >
            4. Como compartilhamos seus dados
          </h2>

          <div className="bg-[#034e2a]/30 border border-[#34d399]/20 rounded-lg p-4 mb-5 text-sm">
            <p className="text-[#34d399] font-semibold mb-1">Declaração clara:</p>
            <p className="text-[#c4c7e8]">
              <strong>Não vendemos, alugamos nem comercializamos seus dados pessoais</strong> com
              terceiros para qualquer finalidade, incluindo marketing ou publicidade.
            </p>
          </div>

          <p className="text-sm mb-3">Compartilhamos dados apenas nas situações abaixo:</p>

          <div className="space-y-3 text-sm">
            <div className="border border-[#1e2348] rounded-lg p-4">
              <p className="font-semibold text-[#e8eaff] mb-1">OpenAI (GPT-4o, GPT-4o-mini, DALL-E 3)</p>
              <p>
                Enviamos contexto de marca, histórico de posts e solicitações de geração de conteúdo.
                Identificadores pessoais são removidos ou pseudonimizados antes do envio sempre que possível.
                A OpenAI não usa esses dados para treinar seus modelos (API comercial com proteção de dados).
                {" "}<a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[#4ecdc4] hover:underline">Política de privacidade OpenAI</a>.
              </p>
            </div>
            <div className="border border-[#1e2348] rounded-lg p-4">
              <p className="font-semibold text-[#e8eaff] mb-1">Google (Gemini)</p>
              <p>
                Utilizado para análise de conteúdo em vídeo e geração de sugestões visuais.
                Os dados enviados seguem a política de dados da API Google Gemini.
                {" "}<a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[#4ecdc4] hover:underline">Política de privacidade Google</a>.
              </p>
            </div>
            <div className="border border-[#1e2348] rounded-lg p-4">
              <p className="font-semibold text-[#e8eaff] mb-1">Supabase (infraestrutura de banco de dados)</p>
              <p>
                Processador de dados que armazena informações em servidores com criptografia em repouso.
                Supabase não acessa seus dados para fins próprios.
                {" "}<a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[#4ecdc4] hover:underline">Política de privacidade Supabase</a>.
              </p>
            </div>
            <div className="border border-[#1e2348] rounded-lg p-4">
              <p className="font-semibold text-[#e8eaff] mb-1">Autoridades e cumprimento legal</p>
              <p>
                Podemos divulgar dados quando exigido por lei, ordem judicial ou autoridade regulatória competente,
                na extensão estritamente necessária.
              </p>
            </div>
          </div>

          <p className="text-sm mt-4">
            <strong className="text-[#e8eaff]">Sem compartilhamento para fins de marketing:</strong> não
            compartilhamos seus dados com redes de publicidade, data brokers ou parceiros comerciais
            para fins de segmentação ou publicidade.
          </p>
        </section>

        {/* 5. Armazenamento */}
        <section id="armazenamento" aria-labelledby="h-armazenamento">
          <h2
            id="h-armazenamento"
            className="text-xl font-semibold text-[#e8eaff] mb-4 pb-2 border-b border-[#1e2348]"
          >
            5. Onde e como armazenamos
          </h2>
          <ul className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="text-[#4ecdc4] mt-0.5 shrink-0">▸</span>
              <span><strong className="text-[#e8eaff]">Banco de dados:</strong> Supabase (PostgreSQL), com Row-Level Security (RLS) garantindo que cada usuário acesse apenas seus próprios dados.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#4ecdc4] mt-0.5 shrink-0">▸</span>
              <span><strong className="text-[#e8eaff]">Tokens OAuth:</strong> armazenados criptografados no banco, nunca expostos em logs ou respostas de API.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#4ecdc4] mt-0.5 shrink-0">▸</span>
              <span><strong className="text-[#e8eaff]">Arquivos de mídia:</strong> armazenados no Supabase Storage com criptografia em repouso e acesso autenticado.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#4ecdc4] mt-0.5 shrink-0">▸</span>
              <span><strong className="text-[#e8eaff]">Localização dos dados:</strong> os servidores Supabase utilizados estão localizados <span className="text-[#fbbf24]">[região a confirmar, ex: South America - São Paulo]</span>.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#4ecdc4] mt-0.5 shrink-0">▸</span>
              <span><strong className="text-[#e8eaff]">Transporte:</strong> toda comunicação ocorre exclusivamente via HTTPS/TLS 1.2+.</span>
            </li>
          </ul>
        </section>

        {/* 6. Retenção */}
        <section id="retencao" aria-labelledby="h-retencao">
          <h2
            id="h-retencao"
            className="text-xl font-semibold text-[#e8eaff] mb-4 pb-2 border-b border-[#1e2348]"
          >
            6. Por quanto tempo mantemos seus dados
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-[#5e6388] text-xs uppercase">
                  <th className="pb-2 pr-4 font-medium">Tipo de dado</th>
                  <th className="pb-2 font-medium">Prazo de retenção</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2348]">
                <tr>
                  <td className="py-3 pr-4 text-[#e8eaff]">Dados de cadastro (conta ativa)</td>
                  <td className="py-3 text-[#c4c7e8]">Enquanto a conta estiver ativa</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 text-[#e8eaff]">Tokens OAuth de redes sociais</td>
                  <td className="py-3 text-[#c4c7e8]">Deletados imediatamente ao desconectar a rede</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 text-[#e8eaff]">Snapshots históricos de métricas</td>
                  <td className="py-3 text-[#c4c7e8]">Até 2 anos (para análises temporais)</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 text-[#e8eaff]">Logs de acesso e auditoria</td>
                  <td className="py-3 text-[#c4c7e8]">90 dias</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 text-[#e8eaff]">Dados após encerramento da conta</td>
                  <td className="py-3 text-[#c4c7e8]">90 dias para possível reativação; após, deletados permanentemente</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 7. Direitos LGPD */}
        <section id="direitos" aria-labelledby="h-direitos">
          <h2
            id="h-direitos"
            className="text-xl font-semibold text-[#e8eaff] mb-4 pb-2 border-b border-[#1e2348]"
          >
            7. Seus direitos como titular (LGPD)
          </h2>
          <p className="text-sm mb-4">
            A LGPD garante a você os seguintes direitos em relação aos seus dados pessoais:
          </p>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            {[
              { title: "Acesso", desc: "Confirmar se tratamos seus dados e obter cópia deles." },
              { title: "Correção", desc: "Solicitar correção de dados incorretos, desatualizados ou incompletos." },
              { title: "Exclusão", desc: "Solicitar a exclusão de dados desnecessários ou tratados em desconformidade." },
              { title: "Portabilidade", desc: "Receber seus dados em formato estruturado para uso em outro serviço." },
              { title: "Oposição", desc: "Opor-se ao tratamento realizado com base no legítimo interesse." },
              { title: "Revogação", desc: "Revogar o consentimento a qualquer momento, sem prejuízo de tratamentos anteriores." },
              { title: "Limitação", desc: "Solicitar a limitação do tratamento em determinadas circunstâncias." },
              { title: "Informação", desc: "Ser informado sobre as entidades públicas e privadas com quem compartilhamos dados." },
            ].map((right) => (
              <div key={right.title} className="bg-[#0c0f24] border border-[#1e2348] rounded-lg p-3">
                <p className="font-semibold text-[#4ecdc4] mb-1">{right.title}</p>
                <p className="text-[#8b8fb0]">{right.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 bg-[#0c0f24] border border-[#1e2348] rounded-lg p-4 text-sm">
            <p className="font-semibold text-[#e8eaff] mb-2">Como exercer seus direitos:</p>
            <ul className="space-y-1.5 text-[#c4c7e8]">
              <li>
                <strong>E-mail:</strong>{" "}
                <a href="mailto:oliver@bertuzzipatrimonial.com.br" className="text-[#4ecdc4] hover:underline">
                  oliver@bertuzzipatrimonial.com.br
                </a>{" "}
                com o assunto "Direitos LGPD — [seu pedido]"
              </li>
              <li>
                <strong>Endpoint de exclusão (em breve):</strong>{" "}
                <code className="bg-[#141736] px-1.5 py-0.5 rounded text-xs">/api/privacy/delete-my-data</code>
              </li>
              <li>Prazo de resposta: até <strong>15 dias úteis</strong>, conforme a LGPD.</li>
            </ul>
          </div>
          <p className="text-sm mt-4 text-[#8b8fb0]">
            Você também tem o direito de apresentar reclamação à{" "}
            <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" className="text-[#4ecdc4] hover:underline">
              Autoridade Nacional de Proteção de Dados (ANPD)
            </a>.
          </p>
        </section>

        {/* 8. Cookies */}
        <section id="cookies" aria-labelledby="h-cookies">
          <h2
            id="h-cookies"
            className="text-xl font-semibold text-[#e8eaff] mb-4 pb-2 border-b border-[#1e2348]"
          >
            8. Cookies
          </h2>
          <p className="text-sm mb-3">
            O GO Studio utiliza cookies de forma mínima e apenas para o funcionamento essencial da plataforma:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-[#5e6388] text-xs uppercase">
                  <th className="pb-2 pr-4 font-medium">Nome</th>
                  <th className="pb-2 pr-4 font-medium">Tipo</th>
                  <th className="pb-2 font-medium">Finalidade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2348]">
                <tr>
                  <td className="py-3 pr-4 text-[#e8eaff] font-mono text-xs">sb-[token]-auth</td>
                  <td className="py-3 pr-4 text-[#c4c7e8]">Sessão (essencial)</td>
                  <td className="py-3 text-[#c4c7e8]">Manter sessão autenticada no Supabase</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4 bg-[#034e2a]/30 border border-[#34d399]/20 rounded-lg p-3 text-sm">
            <p className="text-[#34d399]">
              <strong>Sem rastreamento:</strong> não utilizamos cookies de terceiros, pixels de rastreamento,
              Google Analytics via cookie, nor cookies de publicidade comportamental.
            </p>
          </div>
        </section>

        {/* 9. Segurança */}
        <section id="seguranca" aria-labelledby="h-seguranca">
          <h2
            id="h-seguranca"
            className="text-xl font-semibold text-[#e8eaff] mb-4 pb-2 border-b border-[#1e2348]"
          >
            9. Segurança dos dados
          </h2>
          <p className="text-sm mb-3">
            Adotamos medidas técnicas e organizacionais proporcionais ao risco para proteger seus dados:
          </p>
          <ul className="space-y-2 text-sm">
            <li className="flex gap-3">
              <span className="text-[#4ecdc4] mt-0.5 shrink-0">▸</span>
              <span><strong className="text-[#e8eaff]">HTTPS obrigatório</strong> em todas as comunicações (TLS 1.2+).</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#4ecdc4] mt-0.5 shrink-0">▸</span>
              <span><strong className="text-[#e8eaff]">Tokens OAuth criptografados</strong> em repouso no banco de dados.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#4ecdc4] mt-0.5 shrink-0">▸</span>
              <span><strong className="text-[#e8eaff]">Row-Level Security (RLS)</strong> no Supabase: cada usuário acessa apenas seus próprios dados, mesmo em caso de bug de aplicação.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#4ecdc4] mt-0.5 shrink-0">▸</span>
              <span><strong className="text-[#e8eaff]">Senhas com hash bcrypt</strong> — nunca armazenadas em texto puro.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#4ecdc4] mt-0.5 shrink-0">▸</span>
              <span><strong className="text-[#e8eaff]">Logs de auditoria</strong> para monitorar acessos e detectar anomalias.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#4ecdc4] mt-0.5 shrink-0">▸</span>
              <span><strong className="text-[#e8eaff]">Acesso interno restrito</strong> ao mínimo necessário (princípio do menor privilégio).</span>
            </li>
          </ul>
          <p className="text-sm mt-4 text-[#8b8fb0]">
            Em caso de incidente de segurança que afete seus dados, notificaremos você e a ANPD
            dentro dos prazos legais aplicáveis.
          </p>
        </section>

        {/* 10. Crianças */}
        <section id="criancas" aria-labelledby="h-criancas">
          <h2
            id="h-criancas"
            className="text-xl font-semibold text-[#e8eaff] mb-4 pb-2 border-b border-[#1e2348]"
          >
            10. Menores de idade
          </h2>
          <p className="text-sm">
            O GO Studio é uma plataforma B2B voltada exclusivamente para profissionais e empresas.
            <strong className="text-[#e8eaff]"> Não coletamos, processamos nem armazenamos dados de menores de 18 anos.</strong>{" "}
            Caso identifiquemos inadvertidamente dados de um menor, os excluiremos imediatamente.
            Se você acredita que dados de um menor foram coletados, entre em contato pelo e-mail
            {" "}<a href="mailto:oliver@bertuzzipatrimonial.com.br" className="text-[#4ecdc4] hover:underline">oliver@bertuzzipatrimonial.com.br</a>.
          </p>
        </section>

        {/* 11. Mudanças */}
        <section id="mudancas" aria-labelledby="h-mudancas">
          <h2
            id="h-mudancas"
            className="text-xl font-semibold text-[#e8eaff] mb-4 pb-2 border-b border-[#1e2348]"
          >
            11. Mudanças nesta política
          </h2>
          <p className="text-sm">
            Reservamo-nos o direito de atualizar esta Política de Privacidade periodicamente para
            refletir mudanças na plataforma, na legislação ou nas práticas do setor.
            Alterações relevantes serão comunicadas por e-mail com pelo menos{" "}
            <strong className="text-[#e8eaff]">30 dias de antecedência</strong>.
            A data de "Última atualização" no topo desta página sempre indicará quando a versão
            vigente foi publicada. O uso continuado da plataforma após o período de aviso implica
            na aceitação das alterações.
          </p>
        </section>

        {/* 12. Contato e DPO */}
        <section id="contato" aria-labelledby="h-contato">
          <h2
            id="h-contato"
            className="text-xl font-semibold text-[#e8eaff] mb-4 pb-2 border-b border-[#1e2348]"
          >
            12. Contato e Encarregado de Dados (DPO)
          </h2>
          <p className="text-sm mb-4">
            Para dúvidas, solicitações ou reclamações relacionadas a esta política ou ao tratamento
            de seus dados pessoais, entre em contato com nosso encarregado:
          </p>
          <div className="bg-[#0c0f24] border border-[#1e2348] rounded-lg p-4 text-sm space-y-1.5">
            <p><strong className="text-[#e8eaff]">Nome:</strong> <span className="text-[#fbbf24]">[Nome do DPO a confirmar]</span></p>
            <p>
              <strong className="text-[#e8eaff]">E-mail:</strong>{" "}
              <a href="mailto:oliver@bertuzzipatrimonial.com.br" className="text-[#4ecdc4] hover:underline">
                oliver@bertuzzipatrimonial.com.br
              </a>
            </p>
            <p><strong className="text-[#e8eaff]">Endereço para correspondência:</strong>{" "}
              <span className="text-[#fbbf24]">[Endereço completo da BGP a confirmar]</span>
            </p>
            <p><strong className="text-[#e8eaff]">Prazo de resposta:</strong> até 15 dias úteis</p>
          </div>
        </section>

        {/* Nav cruzada */}
        <div className="border-t border-[#1e2348] pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm">
          <p className="text-[#5e6388]">
            Veja também:{" "}
            <Link href="/termos" className="text-[#4ecdc4] hover:underline">
              Termos de Uso
            </Link>
          </p>
          <p className="text-[#5e6388]">
            Última atualização:{" "}
            <time dateTime="2026-04-15" className="text-[#8b8fb0]">15 de abril de 2026</time>
          </p>
        </div>

      </div>
    </div>
  );
}
