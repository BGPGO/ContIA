"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Menu } from "lucide-react";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useCreativeChat } from "@/hooks/useCreativeChat";
import { ChatPanel } from "@/components/creatives/ChatPanel";
import { PreviewPanel } from "@/components/creatives/PreviewPanel";
import { ConversationsSidebar } from "@/components/creatives/ConversationsSidebar";
import { SendToApprovalModal } from "@/components/creatives/SendToApprovalModal";

export default function CriativosPage() {
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id ?? "";

  if (!empresaId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-white/60">Selecione uma empresa para gerar criativos.</p>
      </div>
    );
  }

  return <CriativosPageInner empresaId={empresaId} />;
}

function CriativosPageInner({ empresaId }: { empresaId: string }) {
  const hook = useCreativeChat({ empresaId });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);

  // Pega o último assistant message com png_urls para preparar aprovação
  const lastAssistantMsg = [...hook.messages]
    .reverse()
    .find(
      (m) =>
        m.role === "assistant" &&
        (m.pngUrl || (m.pngUrls && m.pngUrls.length > 0))
    );

  const canSendToApproval = Boolean(
    lastAssistantMsg?.id &&
      (hook.currentPngUrl || (hook.currentPngUrls && hook.currentPngUrls.length > 0))
  );

  // Default caption: última mensagem assistant sem HTML (legenda), ou vazio
  const lastAssistantWithoutHtml = [...hook.messages]
    .reverse()
    .find((m) => m.role === "assistant" && !m.html);
  const defaultCaption = lastAssistantWithoutHtml?.content?.trim() ?? "";

  return (
    <div className="flex h-full w-full relative">
      {/* DESKTOP: Sidebar fixa */}
      <div className="hidden md:block shrink-0 w-[280px] border-r border-white/10">
        <ConversationsSidebar
          conversations={hook.conversations}
          activeConversationId={hook.conversationId}
          loading={hook.loadingConversations}
          onSelect={hook.loadConversation}
          onNewConversation={hook.createNewConversation}
          onDelete={hook.deleteConversation}
          onRename={hook.renameConversation}
        />
      </div>

      {/* MOBILE: Drawer sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 260 }}
              className="md:hidden fixed left-0 top-0 bottom-0 w-[280px] bg-[#080b1e] border-r border-white/10 z-50"
            >
              <ConversationsSidebar
                conversations={hook.conversations}
                activeConversationId={hook.conversationId}
                loading={hook.loadingConversations}
                onSelect={(id) => {
                  hook.loadConversation(id);
                  setSidebarOpen(false);
                }}
                onNewConversation={() => {
                  hook.createNewConversation();
                  setSidebarOpen(false);
                }}
                onDelete={hook.deleteConversation}
                onRename={hook.renameConversation}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Chat */}
      <div className="flex-[3] min-w-0 border-r border-white/10 relative">
        {/* Botão mobile pra abrir sidebar */}
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="md:hidden absolute top-3 left-3 z-10 w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70"
          title="Abrir biblioteca"
        >
          <Menu className="w-4 h-4" />
        </button>

        <ChatPanel
          messages={hook.messages}
          isStreaming={hook.isStreaming}
          streamingText={hook.streamingText}
          streamingPhase={hook.streamingPhase}
          totalCostUsd={hook.totalCostUsd}
          totalTokens={hook.totalTokens}
          onSendMessage={hook.sendMessage}
          model={hook.model}
          onModelChange={hook.setModel}
          useBrandKit={hook.useBrandKit}
          onUseBrandKitChange={hook.setUseBrandKit}
          pendingAttachments={hook.pendingAttachments}
          onAddAttachment={hook.addAttachment}
          onRemoveAttachment={hook.removeAttachment}
        />
      </div>

      {/* Preview */}
      <div className="flex-[2] min-w-0">
        <PreviewPanel
          currentHtml={hook.currentHtml}
          currentPngUrl={hook.currentPngUrl}
          currentPngUrls={hook.currentPngUrls}
          isStreaming={hook.isStreaming}
          error={hook.error}
          onSendToApproval={canSendToApproval ? () => setApprovalModalOpen(true) : undefined}
        />
      </div>

      {/* Modal de aprovação */}
      {approvalModalOpen && lastAssistantMsg?.id && hook.conversationId && (
        <SendToApprovalModal
          open={approvalModalOpen}
          onClose={() => setApprovalModalOpen(false)}
          conversationId={hook.conversationId}
          messageId={lastAssistantMsg.id}
          pngUrls={
            hook.currentPngUrls ??
            (hook.currentPngUrl ? [hook.currentPngUrl] : [])
          }
          defaultCaption={defaultCaption}
          onSuccess={() => setApprovalModalOpen(false)}
        />
      )}
    </div>
  );
}
