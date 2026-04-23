"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle, AlertCircle, RefreshCw, Eye, EyeOff } from "lucide-react";
import { useApprovals } from "@/hooks/useApprovals";
import { useEmpresa } from "@/hooks/useEmpresa";
import { PostApprovalCard } from "@/components/aprovacao/PostApprovalCard";
import { PhoneMockup } from "@/components/calendario/PhoneMockup";
import type { FeedPost } from "@/hooks/useInstagramFeedPreview";

// ── Loading skeleton ──────────────────────────────────────────────────────────

function ApprovalSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl bg-[#0c0f24] border border-[#1e2348]/70 overflow-hidden"
        >
          <div className="bg-[#141736]" style={{ aspectRatio: "1 / 1" }} />
          <div className="p-4 space-y-3">
            <div className="h-4 bg-[#141736] rounded w-3/4" />
            <div className="h-3 bg-[#141736] rounded" />
            <div className="h-3 bg-[#141736] rounded w-5/6" />
            <div className="flex gap-1.5">
              <div className="h-5 w-20 bg-[#141736] rounded-full" />
              <div className="h-5 w-16 bg-[#141736] rounded-full" />
            </div>
          </div>
          <div className="p-4 pt-0 flex gap-2">
            <div className="flex-1 h-9 bg-[#141736] rounded-xl" />
            <div className="flex-1 h-9 bg-[#141736] rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AprovacaoPage() {
  const { empresa } = useEmpresa();
  const { items, loading, error, refetch, approve, reject } = useApprovals();
  const [feedVisible, setFeedVisible] = useState(true);

  // Constrói FeedPost[] a partir dos posts pendentes de aprovação
  const feedPostsFromPending: FeedPost[] = items
    .slice(0, 9)
    .map(({ post }) => ({
      id: post.id,
      thumbnail: post.midia_url ?? "",
      isScheduled: false,
      isPublished: false,
      isFromAPI: false,
      date: "",
      caption: post.conteudo?.slice(0, 80) ?? post.titulo,
    }))
    .filter((p) => p.thumbnail !== "");

  // No empresa selected guard
  if (!empresa) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle className="w-10 h-10 text-[#5e6388]" />
        <p className="text-[#8b8fb0] text-sm">
          Selecione uma empresa para ver as aprovacoes pendentes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#34d399]/20 to-[#059669]/20 border border-[#34d399]/20 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5 text-[#34d399]" />
          </div>
          <div>
            <h1 className="text-base sm:text-xl font-semibold text-[#e8eaff] tracking-tight">
              Aprovacoes
            </h1>
            {!loading && (
              <p className="text-[12px] text-[#5e6388]">
                {items.length === 0
                  ? "Nenhum post pendente"
                  : `${items.length} post${items.length !== 1 ? "s" : ""} aguardando revisao`}
              </p>
            )}
          </div>
        </div>

        {/* Counter badge */}
        <div className="flex items-center gap-2">
          {!loading && items.length > 0 && (
            <motion.span
              key={items.length}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-[12px] font-bold px-2.5 py-1 rounded-full bg-[#fbbf24]/15 text-[#fbbf24] border border-[#fbbf24]/25"
            >
              {items.length} pendente{items.length !== 1 ? "s" : ""}
            </motion.span>
          )}

          <button
            onClick={refetch}
            disabled={loading}
            title="Atualizar lista"
            className="p-2 rounded-xl text-[#5e6388] hover:text-[#4ecdc4] hover:bg-[#4ecdc4]/10 transition-all duration-200 disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── Error state ── */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-xl bg-[#f87171]/[0.06] border border-[#f87171]/20 text-[#f87171]"
        >
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Erro ao carregar aprovacoes</p>
            <p className="text-[12px] text-[#f87171]/70 mt-0.5">{error}</p>
          </div>
          <button
            onClick={refetch}
            className="text-[12px] font-medium px-3 py-1.5 rounded-lg bg-[#f87171]/10 hover:bg-[#f87171]/20 transition-colors"
          >
            Tentar novamente
          </button>
        </motion.div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && !error && <ApprovalSkeleton />}

      {/* ── Empty state ── */}
      {!loading && !error && items.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 gap-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#34d399]/10 to-[#059669]/10 border border-[#34d399]/15 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-[#34d399]/60" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-[#e8eaff] font-medium">
              Nenhum post aguardando aprovacao
            </p>
            <p className="text-[13px] text-[#5e6388]">
              Quando um post for enviado para aprovacao, ele aparecera aqui.
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Layout principal: cards + feed preview ── */}
      {!loading && !error && items.length > 0 && (
        <div className="flex flex-col xl:flex-row gap-6 items-start">

          {/* Esquerda: grid de cards */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="popLayout">
              <motion.div
                layout
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                {items.map(({ post, approval }) => (
                  <PostApprovalCard
                    key={approval.id}
                    post={post}
                    approval={approval}
                    onApprove={approve}
                    onReject={reject}
                  />
                ))}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Direita: simulação do feed Instagram */}
          <aside className="xl:w-[420px] shrink-0 xl:sticky xl:top-4 self-start">
            {/* Cabeçalho da seção feed */}
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white/80">
                  Simulação do feed
                </h3>
                <span className="text-[11px] text-white/40">
                  como ficaria se aprovados
                </span>
              </div>
              <button
                onClick={() => setFeedVisible((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/70 transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                title={feedVisible ? "Esconder simulação" : "Mostrar simulação"}
              >
                {feedVisible ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    Esconder
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    Mostrar
                  </>
                )}
              </button>
            </div>

            {feedVisible && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden"
              >
                <PhoneMockup
                  feedPosts={feedPostsFromPending}
                  profilePic={empresa?.logo_url ?? null}
                  username={
                    empresa?.instagram_handle ?? empresa?.nome ?? "empresa"
                  }
                  followersCount={0}
                  postsCount={feedPostsFromPending.length}
                  loading={false}
                />

                {feedPostsFromPending.length === 0 && (
                  <p className="text-center text-[11px] text-white/30 mt-3">
                    Nenhum post com imagem para pré-visualizar.
                  </p>
                )}
              </motion.div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
