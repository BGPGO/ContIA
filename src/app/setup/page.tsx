"use client";

import { useState, useCallback } from "react";
import {
  Rocket,
  Database,
  FileText,
  Globe,
  Users,
  Link2,
  Server,
  ServerCog,
  Megaphone,
  Camera,
  ExternalLink,
  AlertTriangle,
  KeyRound,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";
import { useSetupProgress } from "@/hooks/useSetupProgress";
import { SetupCard } from "@/components/setup/SetupCard";
import { CodeBlock } from "@/components/setup/CodeBlock";

/* ── Card IDs (order defines display) ── */
const CARD_IDS = [
  "migration-009",
  "paginas-legais",
  "meta-redirect-uris",
  "meta-testers",
  "linkedin-app",
  "coolify-contia-env",
  "coolify-crm-env",
  "google-ads-token",
  "instagram-testers",
] as const;

type CardId = (typeof CARD_IDS)[number];

/* ── Helper: NoteInput ── */
function NoteInput({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-text-secondary mb-1">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg bg-bg-input border border-border text-[13px] text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50 transition-colors"
      />
    </div>
  );
}

/* ── Helper: Section heading inside card ── */
function Section({ title }: { title: string }) {
  return (
    <h4 className="text-[13px] font-semibold text-text-primary">{title}</h4>
  );
}

/* ── Helper: Numbered step ── */
function Step({
  n,
  children,
}: {
  n: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-bg-elevated flex items-center justify-center text-[10px] font-bold text-text-muted">
        {n}
      </span>
      <div className="flex-1 text-[13px] text-text-secondary leading-relaxed">
        {children}
      </div>
    </div>
  );
}

/* ── Helper: external link ── */
function ExtLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-accent hover:text-accent-light underline underline-offset-2 transition-colors"
    >
      {children}
      <ExternalLink size={12} />
    </a>
  );
}

/* ── Helper: important callout ── */
function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/5 border border-warning/20 text-[12px] text-warning">
      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

/* ── Helper: Generate API Key button ── */
function GenerateKeyButton({
  onGenerated,
}: {
  onGenerated: (key: string) => void;
}) {
  const [generated, setGenerated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function generate() {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    const key = Array.from(arr)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    setGenerated(key);
    onGenerated(key);
  }

  async function copyKey() {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(generated);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="space-y-2">
      <button
        onClick={generate}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/15 border border-secondary/30 text-[12px] font-medium text-secondary-light hover:bg-secondary/25 transition-colors"
      >
        <KeyRound size={14} />
        Gerar API Key forte
      </button>
      {generated && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-[#0a0d20] border border-border">
          <code className="flex-1 text-[11px] text-accent break-all font-mono">
            {generated}
          </code>
          <button
            onClick={copyKey}
            className={`p-1 rounded transition-colors ${
              copied ? "text-success" : "text-text-muted hover:text-text-primary"
            }`}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Page ── */
export default function SetupPage() {
  const {
    steps,
    loaded,
    toggleDone,
    setNotes,
    completedCount,
    totalCount,
  } = useSetupProgress([...CARD_IDS]);

  const [generatedApiKey, setGeneratedApiKey] = useState("");

  const getNotes = useCallback(
    (id: CardId) => steps[id]?.notes ?? "",
    [steps]
  );
  const isDone = useCallback(
    (id: CardId) => steps[id]?.done ?? false,
    [steps]
  );

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary">
        <RefreshCw size={18} className="animate-spin mr-2" />
        Carregando...
      </div>
    );
  }

  /* Sort: pendentes first, concluidos last */
  const sortedIds = [...CARD_IDS].sort((a, b) => {
    const aDone = isDone(a) ? 1 : 0;
    const bDone = isDone(b) ? 1 : 0;
    return aDone - bDone;
  });

  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="space-y-6 p-2 sm:p-4 md:p-6 max-w-4xl mx-auto page-enter">
      {/* ── Header ── */}
      <div className="page-header">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/20 to-secondary/20 flex items-center justify-center">
            <Rocket size={20} className="text-accent" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">
              Setup ContIA 2.0
            </h1>
            <p className="text-[13px] text-text-secondary">
              Configuracao inicial necessaria para ativar todas as redes e
              analises.
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-bg-elevated overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${progressPct}%`,
                background:
                  "linear-gradient(90deg, var(--color-accent), var(--color-secondary))",
              }}
            />
          </div>
          <span className="text-[13px] font-semibold text-text-secondary shrink-0">
            {completedCount}/{totalCount} concluidos
          </span>
        </div>
      </div>

      {/* ── Cards ── */}
      <div className="space-y-3">
        {sortedIds.map((id) => {
          switch (id) {
            /* ────────────────────────────────────────────── */
            case "migration-009":
              return (
                <SetupCard
                  key={id}
                  id={id}
                  icon={Database}
                  title="Migration Supabase (009)"
                  reason="Tabelas do modulo de inteligencia e relatorios"
                  estimatedTime="2 min"
                  done={isDone(id)}
                  onToggleDone={() => toggleDone(id)}
                  defaultOpen={!isDone(id)}
                >
                  <Section title="O que e" />
                  <p className="text-[12px] text-text-muted">
                    A migration <code className="text-accent">009_inteligencia_schema.sql</code>{" "}
                    cria 7 tabelas novas:{" "}
                    <code className="text-text-secondary">
                      provider_snapshots, content_items, metric_events, reports,
                      scheduled_reports, ai_analyses, sync_jobs
                    </code>
                    . Ja foi executada pelo Claude — verifique se rodou corretamente.
                  </p>

                  <Section title="Verificar no Supabase" />
                  <Step n={1}>
                    Abra o{" "}
                    <ExtLink href="https://supabase.com/dashboard/project/hvpbrlczzqhroerogylu/sql/new">
                      SQL Editor do Supabase
                    </ExtLink>
                  </Step>
                  <Step n={2}>Cole e execute a query abaixo:</Step>
                  <CodeBlock
                    language="sql"
                    code={`SELECT table_name FROM information_schema.tables
WHERE table_schema='public'
AND table_name IN ('provider_snapshots','content_items','metric_events','reports','scheduled_reports','ai_analyses','sync_jobs');`}
                  />
                  <Step n={3}>
                    Devem aparecer <strong className="text-text-primary">7 tabelas</strong>. Se aparecerem
                    menos, rode a migration manualmente no SQL Editor (arquivo{" "}
                    <code className="text-accent">supabase/migrations/009_inteligencia_schema.sql</code>).
                  </Step>
                </SetupCard>
              );

            /* ────────────────────────────────────────────── */
            case "paginas-legais":
              return (
                <SetupCard
                  key={id}
                  id={id}
                  icon={FileText}
                  title="Paginas legais (Privacidade + Termos)"
                  reason="Obrigatorio para Meta, Google e LinkedIn aprovarem o app"
                  estimatedTime="10 min"
                  done={isDone(id)}
                  onToggleDone={() => toggleDone(id)}
                >
                  <Section title="Paginas criadas" />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[12px]">
                      <span className="text-success">&#10003;</span>
                      <ExtLink href="https://contia.bertuzzipatrimonial.com.br/privacidade">
                        /privacidade
                      </ExtLink>
                    </div>
                    <div className="flex items-center gap-2 text-[12px]">
                      <span className="text-success">&#10003;</span>
                      <ExtLink href="https://contia.bertuzzipatrimonial.com.br/termos">
                        /termos
                      </ExtLink>
                    </div>
                  </div>

                  <Section title="Placeholders para preencher" />
                  <Callout>
                    Essas paginas podem ter placeholders como [CNPJ], [ENDERECO],
                    [RAZAO_SOCIAL]. Abra cada link, revise o texto e substitua
                    com os dados reais da Bertuzzi Patrimonial.
                  </Callout>
                  <ul className="text-[12px] text-text-muted space-y-1 pl-4 list-disc">
                    <li>CNPJ da empresa</li>
                    <li>Endereco completo</li>
                    <li>Razao social</li>
                    <li>Email de contato para LGPD (DPO)</li>
                  </ul>
                </SetupCard>
              );

            /* ────────────────────────────────────────────── */
            case "meta-redirect-uris":
              return (
                <SetupCard
                  key={id}
                  id={id}
                  icon={Globe}
                  title="Meta App: adicionar Redirect URIs"
                  reason="Facebook, Instagram e Meta Ads precisam de callback URLs configurados"
                  estimatedTime="5 min"
                  done={isDone(id)}
                  onToggleDone={() => toggleDone(id)}
                >
                  <Section title="Adicionar OAuth Redirect URIs" />
                  <Step n={1}>
                    Abra{" "}
                    <ExtLink href="https://developers.facebook.com/apps/3845537452420704/fb-login/settings/">
                      Facebook Login &gt; Settings
                    </ExtLink>
                  </Step>
                  <Step n={2}>
                    Em &quot;Valid OAuth Redirect URIs&quot;, adicione estas 3 URLs:
                  </Step>
                  <CodeBlock
                    code={`https://contia.bertuzzipatrimonial.com.br/api/instagram/callback
https://contia.bertuzzipatrimonial.com.br/api/facebook/callback
https://contia.bertuzzipatrimonial.com.br/api/meta-ads/callback`}
                  />
                  <Step n={3}>
                    Clique <strong className="text-text-primary">Save Changes</strong>.
                  </Step>

                  <Section title="Configurar Privacy Policy e Terms no App" />
                  <Step n={4}>
                    Abra{" "}
                    <ExtLink href="https://developers.facebook.com/apps/3845537452420704/settings/basic/">
                      App Settings &gt; Basic
                    </ExtLink>
                  </Step>
                  <Step n={5}>
                    Em <strong className="text-text-primary">Privacy Policy URL</strong>, cole:
                  </Step>
                  <CodeBlock code="https://contia.bertuzzipatrimonial.com.br/privacidade" />
                  <Step n={6}>
                    Em <strong className="text-text-primary">Terms of Service URL</strong>, cole:
                  </Step>
                  <CodeBlock code="https://contia.bertuzzipatrimonial.com.br/termos" />
                  <Step n={7}>
                    Clique <strong className="text-text-primary">Save Changes</strong>.
                  </Step>
                </SetupCard>
              );

            /* ────────────────────────────────────────────── */
            case "meta-testers":
              return (
                <SetupCard
                  key={id}
                  id={id}
                  icon={Users}
                  title="Meta App: adicionar testers"
                  reason="Enquanto o app esta em dev mode, so testers podem usar"
                  estimatedTime="5 min"
                  done={isDone(id)}
                  onToggleDone={() => toggleDone(id)}
                >
                  <Section title="Adicionar App Testers (Facebook + Meta Ads)" />
                  <Step n={1}>
                    Abra{" "}
                    <ExtLink href="https://developers.facebook.com/apps/3845537452420704/roles/roles/">
                      App Roles
                    </ExtLink>
                  </Step>
                  <Step n={2}>
                    Clique &quot;Add Testers&quot; e insira o email ou nome do Facebook de cada
                    pessoa que precisa usar.
                  </Step>
                  <Step n={3}>
                    Cada tester precisa aceitar o convite em{" "}
                    <ExtLink href="https://developers.facebook.com/requests/">
                      developers.facebook.com/requests
                    </ExtLink>
                  </Step>

                  <Section title="Adicionar Instagram Testers" />
                  <Step n={4}>
                    Abra{" "}
                    <ExtLink href="https://developers.facebook.com/apps/3845537452420704/instagram-business/IG%20API%20Setup">
                      Instagram API Setup
                    </ExtLink>
                  </Step>
                  <Step n={5}>
                    Na secao &quot;Instagram Testers&quot;, adicione o @username do Instagram de
                    cada tester.
                  </Step>
                  <Step n={6}>
                    Cada tester precisa aceitar no app do Instagram: Settings &gt;
                    Apps and Websites &gt; Tester Invites.
                  </Step>

                  <NoteInput
                    label="Testers adicionados (anotacao)"
                    placeholder="Ex: @oliver, @joana..."
                    value={getNotes(id)}
                    onChange={(v) => setNotes(id, v)}
                  />
                </SetupCard>
              );

            /* ────────────────────────────────────────────── */
            case "linkedin-app":
              return (
                <SetupCard
                  key={id}
                  id={id}
                  icon={Link2}
                  title="Criar LinkedIn App"
                  reason="Necessario para publicar e analisar no LinkedIn"
                  estimatedTime="15 min"
                  done={isDone(id)}
                  onToggleDone={() => toggleDone(id)}
                >
                  <Section title="Pre-requisitos" />
                  <ul className="text-[12px] text-text-muted space-y-1 pl-4 list-disc">
                    <li>
                      Company Page BGP no LinkedIn:{" "}
                      <ExtLink href="https://www.linkedin.com/company/bertuzzi-patrimonial/">
                        linkedin.com/company/bertuzzi-patrimonial
                      </ExtLink>
                    </li>
                    <li>Voce precisa ser Super Admin da Company Page</li>
                  </ul>

                  <Section title="Criar o App" />
                  <Step n={1}>
                    Acesse{" "}
                    <ExtLink href="https://www.linkedin.com/developers/apps/new">
                      LinkedIn Developer Apps &gt; New
                    </ExtLink>
                  </Step>
                  <Step n={2}>
                    Preencha:
                    <ul className="mt-1 ml-4 list-disc text-text-muted">
                      <li>
                        <strong className="text-text-primary">App name:</strong> ContIA
                      </li>
                      <li>
                        <strong className="text-text-primary">LinkedIn Page:</strong> Bertuzzi
                        Patrimonial
                      </li>
                      <li>
                        <strong className="text-text-primary">Privacy Policy URL:</strong>
                      </li>
                    </ul>
                  </Step>
                  <CodeBlock code="https://contia.bertuzzipatrimonial.com.br/privacidade" />
                  <Step n={3}>
                    App logo: use qualquer PNG 1024x1024 por enquanto (pode trocar
                    depois).
                  </Step>

                  <Section title="Configurar Auth" />
                  <Step n={4}>
                    Na aba <strong className="text-text-primary">Auth</strong>, em &quot;Authorized redirect URLs&quot;,
                    adicione:
                  </Step>
                  <CodeBlock code="https://contia.bertuzzipatrimonial.com.br/api/linkedin/callback" />

                  <Section title="Ativar Products" />
                  <Step n={5}>
                    Na aba <strong className="text-text-primary">Products</strong>, ative:
                    <ul className="mt-1 ml-4 list-disc text-text-muted">
                      <li>Sign In with LinkedIn using OpenID Connect</li>
                      <li>Share on LinkedIn</li>
                    </ul>
                  </Step>

                  <Section title="Copiar credenciais" />
                  <Step n={6}>
                    Na aba <strong className="text-text-primary">Auth</strong>, copie o{" "}
                    <strong className="text-text-primary">Client ID</strong> e{" "}
                    <strong className="text-text-primary">Client Secret</strong> e cole abaixo:
                  </Step>

                  <NoteInput
                    label="LINKEDIN_CLIENT_ID"
                    placeholder="Cole o Client ID aqui"
                    value={getNotes(id).split("|||")[0] ?? ""}
                    onChange={(v) => {
                      const parts = getNotes(id).split("|||");
                      setNotes(id, `${v}|||${parts[1] ?? ""}`);
                    }}
                  />
                  <NoteInput
                    label="LINKEDIN_CLIENT_SECRET"
                    placeholder="Cole o Client Secret aqui"
                    value={getNotes(id).split("|||")[1] ?? ""}
                    onChange={(v) => {
                      const parts = getNotes(id).split("|||");
                      setNotes(id, `${parts[0] ?? ""}|||${v}`);
                    }}
                  />
                  <Callout>
                    Voce vai precisar colar essas credenciais no Coolify (CARD 6).
                    Guarde-as aqui como referencia.
                  </Callout>
                </SetupCard>
              );

            /* ────────────────────────────────────────────── */
            case "coolify-contia-env":
              return (
                <SetupCard
                  key={id}
                  id={id}
                  icon={Server}
                  title="Coolify ContIA: configurar env vars"
                  reason="Variaveis de ambiente para LinkedIn e CRM"
                  estimatedTime="5 min"
                  done={isDone(id)}
                  onToggleDone={() => toggleDone(id)}
                >
                  <Section title="Abrir painel Coolify" />
                  <Step n={1}>
                    Acesse{" "}
                    <ExtLink href="http://187.77.238.125:8000/project/frrqapqbem8i13ncaifx9xzo/u5gr1pwn7x320gb92ej1kb4s/environment-variables">
                      Coolify &gt; ContIA &gt; Environment Variables
                    </ExtLink>
                  </Step>

                  <Section title="Gerar API Key para CRM" />
                  <p className="text-[12px] text-text-muted">
                    Gere uma chave forte e use a MESMA tanto no ContIA quanto no
                    CRM (proximo card).
                  </p>
                  <GenerateKeyButton
                    onGenerated={(key) => setGeneratedApiKey(key)}
                  />

                  <Section title="Adicionar variaveis" />
                  <Step n={2}>
                    Adicione cada variavel abaixo no Coolify. Substitua os
                    valores entre colchetes:
                  </Step>
                  <CodeBlock
                    code={`LINKEDIN_CLIENT_ID=${getNotes("linkedin-app").split("|||")[0] || "[colar do CARD 5]"}
LINKEDIN_CLIENT_SECRET=${getNotes("linkedin-app").split("|||")[1] || "[colar do CARD 5]"}
CRM_API_URL=https://crm-api.bgpgo.com.br
CRM_ANALYTICS_API_KEY=${generatedApiKey || "[colar a API key gerada acima]"}
APP_URL=https://contia.bertuzzipatrimonial.com.br`}
                  />
                  <Step n={3}>
                    Salve e faca <strong className="text-text-primary">Redeploy</strong> do
                    ContIA.
                  </Step>

                  <Callout>
                    A CRM_ANALYTICS_API_KEY tem que ser IDENTICA no ContIA e no
                    CRM (proximo card).
                  </Callout>
                </SetupCard>
              );

            /* ────────────────────────────────────────────── */
            case "coolify-crm-env":
              return (
                <SetupCard
                  key={id}
                  id={id}
                  icon={ServerCog}
                  title="Coolify CRM: configurar mesma API key"
                  reason="O CRM precisa da mesma chave para aceitar requests do ContIA"
                  estimatedTime="3 min"
                  done={isDone(id)}
                  onToggleDone={() => toggleDone(id)}
                >
                  <Section title="Abrir painel Coolify do CRM" />
                  <Step n={1}>
                    Acesse{" "}
                    <ExtLink href="http://187.77.238.125:8000">
                      Coolify
                    </ExtLink>{" "}
                    e navegue ate o projeto <strong className="text-text-primary">CRM</strong> &gt;
                    Environment Variables.
                  </Step>

                  <Section title="Adicionar variavel" />
                  <Step n={2}>Adicione:</Step>
                  <CodeBlock
                    code={`ANALYTICS_API_KEY=${generatedApiKey || "[mesma string gerada no CARD 6]"}`}
                  />
                  <Step n={3}>
                    Salve e faca <strong className="text-text-primary">Redeploy</strong> do CRM.
                  </Step>

                  <Callout>
                    Tem que ser EXATAMENTE a mesma string dos dois lados (ContIA e
                    CRM). Se gerar uma nova, atualize ambos.
                  </Callout>
                </SetupCard>
              );

            /* ────────────────────────────────────────────── */
            case "google-ads-token":
              return (
                <SetupCard
                  key={id}
                  id={id}
                  icon={Megaphone}
                  title="Solicitar Google Ads Developer Token"
                  reason="Requisito para Fase 6 (YouTube + GA4 + Google Ads) — leva 1-2 semanas"
                  estimatedTime="15 min"
                  done={isDone(id)}
                  onToggleDone={() => toggleDone(id)}
                >
                  <Section title="Pre-requisitos" />
                  <ul className="text-[12px] text-text-muted space-y-1 pl-4 list-disc">
                    <li>Conta Google Ads ativa</li>
                    <li>
                      Se for agencia: precisa de uma conta MCC (My Client
                      Center)
                    </li>
                    <li>API Center liberado na conta</li>
                  </ul>

                  <Section title="Solicitar token" />
                  <Step n={1}>
                    Acesse{" "}
                    <ExtLink href="https://ads.google.com/aw/apicenter">
                      Google Ads API Center
                    </ExtLink>
                  </Step>
                  <Step n={2}>
                    Preencha o formulario:
                    <ul className="mt-1 ml-4 list-disc text-text-muted">
                      <li>
                        <strong className="text-text-primary">Caso de uso:</strong> Reporting e
                        analytics para dashboard interno
                      </li>
                      <li>
                        <strong className="text-text-primary">Traffic estimate:</strong> baixo
                        (menos de 10k requests/dia)
                      </li>
                    </ul>
                  </Step>
                  <Step n={3}>Submeta e aguarde aprovacao (1-2 semanas).</Step>

                  <Callout>
                    Solicite o quanto antes — o token demora para ser aprovado e
                    bloqueia toda a integracao Google (YouTube, GA4, Google Ads).
                  </Callout>

                  <NoteInput
                    label="Status / Developer Token (quando aprovado)"
                    placeholder="Ex: Solicitado em 15/04, aguardando..."
                    value={getNotes(id)}
                    onChange={(v) => setNotes(id, v)}
                  />
                </SetupCard>
              );

            /* ────────────────────────────────────────────── */
            case "instagram-testers":
              return (
                <SetupCard
                  key={id}
                  id={id}
                  icon={Camera}
                  title="Adicionar testers Instagram"
                  reason="Testers precisam aceitar convite no app do Instagram"
                  estimatedTime="5 min"
                  done={isDone(id)}
                  onToggleDone={() => toggleDone(id)}
                >
                  <Section title="Adicionar no Meta for Developers" />
                  <Step n={1}>
                    Abra{" "}
                    <ExtLink href="https://developers.facebook.com/apps/3845537452420704/instagram-business/IG%20API%20Setup">
                      Instagram API Setup
                    </ExtLink>
                  </Step>
                  <Step n={2}>
                    Na secao &quot;Instagram Testers&quot;, adicione o @username do Instagram.
                  </Step>

                  <Section title="Aceitar o convite (cada tester)" />
                  <Step n={3}>
                    No app do Instagram, va em:{" "}
                    <strong className="text-text-primary">
                      Settings &gt; Apps and Websites &gt; Tester Invites
                    </strong>
                  </Step>
                  <Step n={4}>
                    Aceite o convite do app &quot;ContIA&quot; (ou o nome que aparece no Meta
                    App).
                  </Step>

                  <Callout>
                    Sem aceitar o convite, o OAuth do Instagram vai dar erro. Cada
                    nova pessoa que for usar precisa repetir esse processo.
                  </Callout>

                  <NoteInput
                    label="Testers adicionados (Instagram)"
                    placeholder="Ex: @bertuzzipatrimonial, @oliver..."
                    value={getNotes(id)}
                    onChange={(v) => setNotes(id, v)}
                  />
                </SetupCard>
              );

            default:
              return null;
          }
        })}
      </div>
    </div>
  );
}
