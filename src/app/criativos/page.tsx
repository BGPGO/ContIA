"use client";

import { useEmpresa } from "@/hooks/useEmpresa";
import { useCreativeChat } from "@/hooks/useCreativeChat";
import { ChatPanel } from "@/components/creatives/ChatPanel";
import { PreviewPanel } from "@/components/creatives/PreviewPanel";

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
  const {
    messages,
    isStreaming,
    streamingText,
    streamingPhase,
    totalCostUsd,
    totalTokens,
    currentHtml,
    currentPngUrl,
    currentPngUrls,
    model,
    setModel,
    useBrandKit,
    setUseBrandKit,
    sendMessage,
    error,
    pendingAttachments,
    addAttachment,
    removeAttachment,
  } = useCreativeChat({ empresaId });

  return (
    <div className="flex h-full w-full">
      <div className="flex-[3] min-w-0 border-r border-white/10">
        <ChatPanel
          messages={messages}
          isStreaming={isStreaming}
          streamingText={streamingText}
          streamingPhase={streamingPhase}
          totalCostUsd={totalCostUsd}
          totalTokens={totalTokens}
          onSendMessage={sendMessage}
          model={model}
          onModelChange={setModel}
          useBrandKit={useBrandKit}
          onUseBrandKitChange={setUseBrandKit}
          pendingAttachments={pendingAttachments}
          onAddAttachment={addAttachment}
          onRemoveAttachment={removeAttachment}
        />
      </div>
      <div className="flex-[2] min-w-0">
        <PreviewPanel
          currentHtml={currentHtml}
          currentPngUrl={currentPngUrl}
          currentPngUrls={currentPngUrls}
          isStreaming={isStreaming}
          error={error}
        />
      </div>
    </div>
  );
}
