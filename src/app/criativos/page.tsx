"use client";

import { useState } from "react";
import { Library } from "lucide-react";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useCreativeChat } from "@/hooks/useCreativeChat";
import { ChatPanel } from "@/components/creatives/ChatPanel";
import { PreviewPanel } from "@/components/creatives/PreviewPanel";
import { CreativesLibrary } from "@/components/creatives/CreativesLibrary";
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
  const [libraryOpen, setLibraryOpen] = useState(false);
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
      {/* Botão Biblioteca — canto superior esquerdo */}
      <button
        type="button"
        onClick={() => setLibraryOpen(true)}
        className="absolute top-3 left-3 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-xs font-medium transition-all"
        title="Abrir biblioteca de criativos"
      >
        <Library className="w-4 h-4" />
        <span>Biblioteca</span>
      </button>

      {/* Chat */}
      <div className="flex-[3] min-w-0 border-r border-white/10 relative">
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

      {/* Biblioteca modal */}
      <CreativesLibrary
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        conversations={hook.conversations}
        activeConversationId={hook.conversationId}
        loading={hook.loadingConversations}
        onSelect={hook.loadConversation}
        onDelete={hook.deleteConversation}
        onRename={hook.renameConversation}
        onNewConversation={hook.createNewConversation}
      />

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
