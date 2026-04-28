import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Termos de Uso — GO Studio",
  description:
    "Termos e condições de uso da plataforma GO Studio, operada pela BGP — Bertuzzi Patrimonial.",
  alternates: {
    canonical: "https://contia.bertuzzipatrimonial.com.br/termos",
  },
};

/* ── Tabela de conteúdo ── */
const TOC_ITEMS = [
  { id: "aceitacao", label: "1. Aceitação dos termos" },
  { id: "servico", label: "2. Descrição do serviço" },
  { id: "cadastro", label: "3. Cadastro e conta" },
  { id: "uso-permitido", label: "4. Uso permitido" },
  { id: "uso-proibido", label: "5. Uso proibido" },
  { id: "ia", label: "6. Conteúdo gerado por IA" },
  { id: "propriedade", label: "7. Propriedade intelectual" },
  { id: "responsabilidade", label: "8. Limitação de responsabilidade" },
  { id: "cancelamento", label: "9. Cancelamento e dados" },
  { id: "foro", label: "10. Foro e lei aplicável" },
  { id: "mudancas", label: "11. Alterações nos termos" },
  { id: "contato", label: "12. Contato" },
];

export default function TermosPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      {/* Cabeçalho */}
      <div className="mb-10">
        <p className="text-sm font-medium text-[#4ecdc4] mb-2 uppercase tracking-widest">
          Legal
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-[#e8eaff] mb-3">
          Termos de Uso
        </h1>
        <p className="text-[#8b8fb0] text-sm">
          Última atualização: <time dateTime="2026-04-15">15 de abril de 2026</time>
        </p>
        <p className="mt-4 text-[#8b8fb0] text-sm leading-relaxed">
          Estes Termos de Uso regem o acesso e o uso da plataforma GO Studio,
          operada pela <strong className="text-[#e8eaff]">BGP — Bertuzzi Patrimonial Gestão de Recursos Ltda</strong>.
          Leia com atenção antes de criar sua conta ou usar o serviço.
        </p>
      </div>

      {/* Sumário (TOC) */}
      <nav
        aria-label="Sumário dos Termos de Uso"
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

        {/* 1. Aceitação */}
        <section id="aceitacao" aria-labelledby="h-aceitacao">
          <h2
            id="h-aceitacao"
            className="text-xl font-semibold text-[#e8eaff] mb-4 pb-2 border-b border-[#1e2348]"
          >
            1. Aceitação dos termos
          </h2>
          <p className="text-sm">
            Ao criar uma conta, acessar ou usar qualquer funcionalidade do GO Studio, você declara
            que leu, compreendeu e concorda com estes Termos de Uso e com a nossa{" "}
            <Link href="/privacidade" className="text-[#4ecdc4] hover:underline">
              Política de Privacidade
            </Link>
            . Se você não concorda com qualquer disposição, não utilize a plataforma.
          </p>
          <p className="text-sm mt-3">
            Ao conectar contas de redes sociais ao GO Studio, você também declara estar ciente e
            em conformidade com os Termos de Uso das respectivas plataformas (Meta, LinkedIn, Google/YouTube).
          </p>
        </section>

        {/* 2. Descrição do serviço */}
        <section id="servico" aria-labelledby="h-servico">
          <h2
            id="h-servico"
            className="text-xl font-semibold text-[#e8eaff] mb-4 pb-2 border-b border-[#1e2348]"
          >
            2. Descrição do serviço
          </h2>
          <p className="text-sm">
            O GO Studio é uma plataforma SaaS (<em>Software as a Service</em>) que oferece:
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex gap-3">
              <span className="text-[#4ecdc4] mt-0.5 shrink-0">▸</span>
              <span><strong className="text-[#e8eaff]">Criação de conteúdo com IA</strong> — geração assistida de legendas, roteiros, textos e imagens para redes sociais usando modelos de linguagem.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#4ecdc4] mt-0.5 shrink-0">▸</span>
              <span><strong className="text-[#e8eaff]">Analytics multi-rede</strong> — consolidação de métricas de Instagram, Facebook, LinkedIn, YouTube, Google Analytics 4 e plataformas de anúncios em um único painel.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#4ecdc4] mt-0.5 shrink-0">▸</span>
              <span><strong className="text-[#e8eaff]">Calendário editorial</strong> — planejamento e agendamento de publicações.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#4ecdc4] mt-0.5 shrink-0">▸</span>
              <span><strong className="text-[#e8eaff]">DNA de marca</strong> — configuração de identidade visual, tom de voz e diretrizes para personalizar a geração de conteúdo.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#4ecdc4] mt-0.5 shrink-0">▸</span>
              <span><strong className="text-[#e8eaff]">Inteligência de conteúdo</strong> — análise de padrões de engajamento e sugestões baseadas em dados históricos.</span>
            </li>
          </ul>
          <p className="text-sm mt-4 text-[#8b8fb0]">
            O serviço pode ser ampliado, modificado ou descontinuado total ou parcialmente,
            com aviso prévio razoável aos usuários ativos.
          </p>
        </section>

        {/* 3. Cadastro */}
        <section id="cadastro" aria-labelledby="h-cadastro">
          <h2
            id="h-cadastro"
            className="text-xl font-semibold text-[#e8eaff] mb-4 pb-2 border-b border-[#1e2348]"
          >
            3. Cadastro e conta
          </h2>

          <h3 className="text-base font-semibold text-[#e8eaff] mt-4 mb-2">3.1 Requisitos</h3>
          <ul className="space-y-1.5 text-sm">
            <li className="flex gap-3">
              <span className="text-[#4ecdc4] mt-0.5 shrink-0">▸</span>
              <span>Ser pessoa física maior de 18 anos ou representante legal de pessoa jurídica.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#4ecdc4] mt-0.5 shrink-0">▸</span>
              <span>Fornecer informações verdadeiras, completas e atualizadas no cadastro.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#4ecdc4] mt-0.5 shrink-0">▸</span>
              <span>Possuir poderes para aceitar estes Termos em nome da empresa cadastrada.</span>
            </li>
          </ul>

          <h3 className="text-base font-semibold text-[#e8eaff] mt-5 mb-2">3.2 Responsabilidades do usuário</h3>
          <ul className="space-y-1.5 text-sm">
            <li className="flex gap-3">
              <span className="text-[#4ecdc4] mt-0.5 shrink-0">▸</span>
              <span>Manter a confidencialidade de suas credenciais de acesso.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#4ecdc4] mt-0.5 shrink-0">▸</span>
              <span>Notificar imediatamente a BGP em caso de acesso não autorizado à sua conta.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#4ecdc4] mt-0.5 shrink-0">▸</span>
              <span>Você é responsável por todas as ações realizadas com sua conta.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#4ecdc4] mt-0.5 shrink-0">▸</span>
              <span>Manter seus dados de cadastro atualizados.</span>
            </li>
          </ul>
        </section>

        {/* 4. Uso permitido */}
        <section id="uso-permitido" aria-labelledby="h-uso-permitido">
          <h2
            id="h-uso-permitido"
            className="text-xl font-semibold text-[#e8eaff] mb-4 pb-2 border-b border-[#1e2348]"
          >
            4. Uso permitido
          </h2>
          <p className="text-sm mb-3">
            Você pode usar o GO Studio para:
          </p>
          <ul className="space-y-2 text-sm">
            <li className="flex gap-3">
              <span className="text-[#34d399] mt-0.5 shrink-0">✓</span>
              <span>Conectar e gerenciar contas de redes sociais das quais você é <strong className="text-[#e8eaff]">administrador legítimo</strong> ou para as quais possui autorização formal do titular.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#34d399] mt-0.5 shrink-0">✓</span>
              <span>Criar, editar, agendar e publicar conteúdo nas contas conectadas.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#34d399] mt-0.5 shrink-0">✓</span>
              <span>Visualizar e exportar relatórios e métricas de performance.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#34d399] mt-0.5 shrink-0">✓</span>
              <span>Usar as funcionalidades de IA para auxiliar na criação de conteúdo, desde que você revise e aprove o resultado final.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#34d399] mt-0.5 shrink-0">✓</span>
              <span>Integrar com APIs de terceiros (Meta, Google, LinkedIn) dentro dos limites e escopos autorizados por essas plataformas.</span>
            </li>
          </ul>
          <div className="mt-4 bg-[#0c0f24] border border-[#282d58] rounded-lg p-4 text-sm">
            <p className="text-[#8b8fb0]">
              <strong className="text-[#e8eaff]">Importante:</strong> Você declara que possui todos os direitos, licenças
              e permissões necessários para o conteúdo que criar, publicar ou carregar na plataforma,
              incluindo imagens, textos e marcas.
            </p>
          </div>
        </section>

        {/* 5. Uso proibido */}
        <section id="uso-proibido" aria-labelledby="h-uso-proibido">
          <h2
            id="h-uso-proibido"
            className="text-xl font-semibold text-[#e8eaff] mb-4 pb-2 border-b border-[#1e2348]"
          >
            5. Uso proibido
          </h2>
          <p className="text-sm mb-3">
            É expressamente proibido usar o GO Studio para:
          </p>
          <ul className="space-y-2 text-sm">
            {[
              "Conectar contas de redes sociais de terceiros sem autorização expressa e documentada.",
              "Publicar conteúdo ilegal, difamatório, discriminatório, pornográfico, violento ou que viole direitos de terceiros.",
              "Enviar spam, mensagens em massa não solicitadas ou praticar phishing.",
              "Burlar, contornar ou explorar limites de rate-limiting das APIs de redes sociais.",
              "Usar a plataforma para campanhas de desinformação, manipulação de opinião pública ou fraude eleitoral.",
              "Fazer engenharia reversa, decompilar ou tentar extrair o código-fonte da plataforma.",
              "Usar bots, scripts ou meios automatizados não autorizados para acessar a plataforma de forma abusiva.",
              "Revender, sublicenciar ou transferir o acesso à plataforma sem autorização expressa da BGP.",
              "Violar as Políticas de Uso das plataformas conectadas (Meta, LinkedIn, Google, etc.).",
              "Usar o serviço de forma a causar danos à infraestrutura, outros usuários ou terceiros.",
              "Coletar ou raspar dados de outros usuários da plataforma.",
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <span className="text-[#f87171] mt-0.5 shrink-0">✗</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm mt-4 text-[#8b8fb0]">
            A violação destas regras pode resultar em suspensão ou encerramento imediato da conta,
            sem direito a reembolso, e pode gerar responsabilidade civil e/ou criminal.
          </p>
        </section>

        {/* 6. IA */}
        <section id="ia" aria-labelledby="h-ia">
          <h2
            id="h-ia"
            className="text-xl font-semibold text-[#e8eaff] mb-4 pb-2 border-b border-[#1e2348]"
          >
            6. Conteúdo gerado por IA
          </h2>
          <div className="space-y-3 text-sm">
            <p>
              O GO Studio utiliza modelos de inteligência artificial (incluindo GPT-4o da OpenAI e
              Gemini do Google) para auxiliar na criação de conteúdo. Ao usar estas funcionalidades,
              você entende e concorda que:
            </p>
            <div className="bg-[#fbbf24]/10 border border-[#fbbf24]/20 rounded-lg p-4">
              <ul className="space-y-2">
                <li className="flex gap-3">
                  <span className="text-[#fbbf24] mt-0.5 shrink-0">⚠</span>
                  <span><strong className="text-[#e8eaff]">Você é o responsável final</strong> pelo conteúdo publicado nas redes sociais, independentemente de ter sido gerado ou sugerido por IA.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-[#fbbf24] mt-0.5 shrink-0">⚠</span>
                  <span><strong className="text-[#e8eaff]">A IA pode errar.</strong> Revise sempre o conteúdo antes de publicar. Modelos de IA podem gerar informações imprecisas, desatualizadas ou inadequadas.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-[#fbbf24] mt-0.5 shrink-0">⚠</span>
                  <span>O conteúdo gerado por IA <strong className="text-[#e8eaff]">não constitui assessoria jurídica, financeira, médica ou profissional</strong> de qualquer natureza.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-[#fbbf24] mt-0.5 shrink-0">⚠</span>
                  <span>A BGP não garante que o conteúdo gerado por IA esteja livre de vieses, erros ou violações de direitos autorais de terceiros. A responsabilidade pela revisão e uso é do usuário.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* 7. Propriedade intelectual */}
        <section id="propriedade" aria-labelledby="h-propriedade">
          <h2
            id="h-propriedade"
            className="text-xl font-semibold text-[#e8eaff] mb-4 pb-2 border-b border-[#1e2348]"
          >
            7. Propriedade intelectual
          </h2>

          <h3 className="text-base font-semibold text-[#e8eaff] mt-4 mb-2">7.1 Conteúdo do usuário</h3>
          <p className="text-sm">
            Todo conteúdo criado, carregado ou publicado por você por meio da plataforma permanece
            de sua propriedade. Ao usar o GO Studio, você concede à BGP uma licença limitada,
            não exclusiva e revogável para armazenar e processar esse conteúdo exclusivamente
            para a prestação dos serviços contratados. Essa licença termina ao encerrar sua conta.
          </p>

          <h3 className="text-base font-semibold text-[#e8eaff] mt-5 mb-2">7.2 Plataforma GO Studio</h3>
          <p className="text-sm">
            A plataforma GO Studio, incluindo seu código-fonte, design, logotipos, marcas, interfaces,
            funcionalidades, documentação e tecnologias proprietárias, é de propriedade exclusiva
            da <strong className="text-[#e8eaff]">BGP — Bertuzzi Patrimonial</strong> e está protegida por leis de
            propriedade intelectual. É proibida qualquer reprodução, distribuição, modificação
            ou uso não autorizado.
          </p>

          <h3 className="text-base font-semibold text-[#e8eaff] mt-5 mb-2">7.3 Feedback</h3>
          <p className="text-sm">
            Sugestões, ideias ou feedbacks que você nos enviar poderão ser utilizados livremente
            pela BGP para aprimorar a plataforma, sem obrigação de remuneração ou crédito.
          </p>
        </section>

        {/* 8. Responsabilidade */}
        <section id="responsabilidade" aria-labelledby="h-responsabilidade">
          <h2
            id="h-responsabilidade"
            className="text-xl font-semibold text-[#e8eaff] mb-4 pb-2 border-b border-[#1e2348]"
          >
            8. Limitação de responsabilidade
          </h2>

          <h3 className="text-base font-semibold text-[#e8eaff] mt-4 mb-2">8.1 Disponibilidade</h3>
          <p className="text-sm">
            A BGP envidará esforços razoáveis para manter o GO Studio disponível, mas{" "}
            <strong className="text-[#e8eaff]">não garante disponibilidade ininterrupta de 100%</strong>.
            Manutenções programadas, falhas de infraestrutura de terceiros (ex: Supabase, Vercel, APIs de redes sociais)
            ou eventos fora do nosso controle podem causar indisponibilidade temporária.
          </p>

          <h3 className="text-base font-semibold text-[#e8eaff] mt-5 mb-2">8.2 Redes sociais de terceiros</h3>
          <p className="text-sm">
            O GO Studio depende das APIs de Meta, LinkedIn, Google e outras plataformas.
            A BGP não é responsável por:
          </p>
          <ul className="mt-2 space-y-1.5 text-sm">
            <li className="flex gap-3">
              <span className="text-[#f87171] mt-0.5 shrink-0">▸</span>
              <span>Restrições, suspensões ou banimentos aplicados pelas redes sociais à sua conta por <strong className="text-[#e8eaff]">uso indevido ou violação das políticas dessas plataformas</strong>.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#f87171] mt-0.5 shrink-0">▸</span>
              <span>Mudanças nas APIs de terceiros que afetem funcionalidades da plataforma.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#f87171] mt-0.5 shrink-0">▸</span>
              <span>Falhas de autenticação OAuth decorrentes de alterações nas políticas das redes sociais.</span>
            </li>
          </ul>

          <h3 className="text-base font-semibold text-[#e8eaff] mt-5 mb-2">8.3 Limite de responsabilidade</h3>
          <p className="text-sm">
            Na máxima extensão permitida pela legislação aplicável, a responsabilidade total da BGP
            perante o usuário, por qualquer causa, será limitada ao valor pago pelo usuário nos
            últimos 3 meses de serviço. A BGP não será responsável por danos indiretos,
            incidentais, lucros cessantes ou danos emergentes.
          </p>
        </section>

        {/* 9. Cancelamento */}
        <section id="cancelamento" aria-labelledby="h-cancelamento">
          <h2
            id="h-cancelamento"
            className="text-xl font-semibold text-[#e8eaff] mb-4 pb-2 border-b border-[#1e2348]"
          >
            9. Cancelamento e dados após encerramento
          </h2>

          <h3 className="text-base font-semibold text-[#e8eaff] mt-4 mb-2">9.1 Como cancelar</h3>
          <p className="text-sm">
            Você pode cancelar sua conta a qualquer momento enviando um e-mail para{" "}
            <a href="mailto:oliver@bertuzzipatrimonial.com.br" className="text-[#4ecdc4] hover:underline">
              oliver@bertuzzipatrimonial.com.br
            </a>{" "}
            com o assunto "Cancelamento de conta". A conta será desativada em até 5 dias úteis após a solicitação.
            <span className="text-[#fbbf24]"> [Funcionalidade de cancelamento self-service será disponibilizada em breve nas configurações da conta.]</span>
          </p>

          <h3 className="text-base font-semibold text-[#e8eaff] mt-5 mb-2">9.2 Dados após o cancelamento</h3>
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-[#5e6388] text-xs uppercase">
                  <th className="pb-2 pr-4 font-medium">O que acontece</th>
                  <th className="pb-2 font-medium">Prazo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2348]">
                <tr>
                  <td className="py-3 pr-4 text-[#c4c7e8]">Acesso à plataforma bloqueado</td>
                  <td className="py-3 text-[#c4c7e8]">Imediatamente</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 text-[#c4c7e8]">Tokens OAuth de redes sociais deletados</td>
                  <td className="py-3 text-[#c4c7e8]">Imediatamente</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 text-[#c4c7e8]">Dados da conta disponíveis para reativação</td>
                  <td className="py-3 text-[#c4c7e8]">Até 90 dias</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 text-[#c4c7e8]">Exclusão permanente de todos os dados</td>
                  <td className="py-3 text-[#c4c7e8]">Após 90 dias do cancelamento</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm mt-3 text-[#8b8fb0]">
            Você pode solicitar a exportação de seus dados antes do cancelamento, conforme seus
            direitos descritos na{" "}
            <Link href="/privacidade#direitos" className="text-[#4ecdc4] hover:underline">
              Política de Privacidade
            </Link>.
          </p>

          <h3 className="text-base font-semibold text-[#e8eaff] mt-5 mb-2">9.3 Encerramento por violação</h3>
          <p className="text-sm">
            A BGP reserva-se o direito de suspender ou encerrar contas que violem estes Termos,
            sem aviso prévio em casos graves (ex: uso ilegal, spam, comprometimento de segurança).
            Em casos de encerramento por violação, não haverá reembolso de valores pagos.
          </p>
        </section>

        {/* 10. Foro */}
        <section id="foro" aria-labelledby="h-foro">
          <h2
            id="h-foro"
            className="text-xl font-semibold text-[#e8eaff] mb-4 pb-2 border-b border-[#1e2348]"
          >
            10. Foro e lei aplicável
          </h2>
          <p className="text-sm">
            Estes Termos são regidos pelas leis da República Federativa do Brasil.
            Qualquer disputa decorrente deste contrato será submetida à competência exclusiva
            do Foro da comarca onde está situada a sede da{" "}
            <strong className="text-[#e8eaff]">BGP — Bertuzzi Patrimonial</strong>{" "}
            (<span className="text-[#fbbf24]">[Comarca a confirmar]</span>),
            com renúncia expressa a qualquer outro, por mais privilegiado que seja.
          </p>
        </section>

        {/* 11. Mudanças */}
        <section id="mudancas" aria-labelledby="h-mudancas">
          <h2
            id="h-mudancas"
            className="text-xl font-semibold text-[#e8eaff] mb-4 pb-2 border-b border-[#1e2348]"
          >
            11. Alterações nestes termos
          </h2>
          <p className="text-sm">
            A BGP pode atualizar estes Termos de Uso a qualquer momento.
            Alterações materiais serão comunicadas por e-mail com pelo menos{" "}
            <strong className="text-[#e8eaff]">30 dias de antecedência</strong>.
            O uso continuado da plataforma após o período de aviso constituirá aceitação dos novos termos.
            Caso não concorde com as alterações, você poderá encerrar sua conta antes da data de vigência.
          </p>
        </section>

        {/* 12. Contato */}
        <section id="contato" aria-labelledby="h-contato">
          <h2
            id="h-contato"
            className="text-xl font-semibold text-[#e8eaff] mb-4 pb-2 border-b border-[#1e2348]"
          >
            12. Contato
          </h2>
          <p className="text-sm mb-4">
            Para dúvidas, reclamações ou solicitações relacionadas a estes Termos, entre em contato:
          </p>
          <div className="bg-[#0c0f24] border border-[#1e2348] rounded-lg p-4 text-sm space-y-1.5">
            <p><strong className="text-[#e8eaff]">Empresa:</strong> BGP — Bertuzzi Patrimonial Gestão de Recursos Ltda</p>
            <p><strong className="text-[#e8eaff]">CNPJ:</strong> <span className="text-[#fbbf24]">[CNPJ a confirmar]</span></p>
            <p>
              <strong className="text-[#e8eaff]">E-mail:</strong>{" "}
              <a href="mailto:oliver@bertuzzipatrimonial.com.br" className="text-[#4ecdc4] hover:underline">
                oliver@bertuzzipatrimonial.com.br
              </a>
            </p>
            <p><strong className="text-[#e8eaff]">Endereço:</strong> <span className="text-[#fbbf24]">[Endereço completo a confirmar]</span></p>
          </div>
        </section>

        {/* Nav cruzada */}
        <div className="border-t border-[#1e2348] pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm">
          <p className="text-[#5e6388]">
            Veja também:{" "}
            <Link href="/privacidade" className="text-[#4ecdc4] hover:underline">
              Política de Privacidade
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
