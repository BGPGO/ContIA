"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Plus, Trash2, Copy, GripVertical, ChevronLeft, ChevronRight } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

interface SlideNavigatorProps {
  slides: object[];
  currentSlide: number;
  thumbnails: string[]; // Array of data URLs for mini previews
  onSlideChange: (index: number) => void;
  onAddSlide: () => void;
  onDeleteSlide: (index: number) => void;
  onDuplicateSlide: (index: number) => void;
  onReorderSlide: (from: number, to: number) => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════════════ */

export function SlideNavigator({
  slides,
  currentSlide,
  thumbnails,
  onSlideChange,
  onAddSlide,
  onDeleteSlide,
  onDuplicateSlide,
  onReorderSlide,
}: SlideNavigatorProps) {
  const [contextMenu, setContextMenu] = useState<{
    index: number;
    x: number;
    y: number;
  } | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [contextMenu]);

  // Scroll current slide into view
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const thumb = container.children[currentSlide] as HTMLElement | undefined;
    if (thumb) {
      thumb.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [currentSlide]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ index, x: e.clientX, y: e.clientY });
    },
    []
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      setDragIndex(index);
      e.dataTransfer.effectAllowed = "move";
      // Use a transparent image for drag
      const img = new Image();
      img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
      e.dataTransfer.setDragImage(img, 0, 0);
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverIndex(index);
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, toIndex: number) => {
      e.preventDefault();
      if (dragIndex !== null && dragIndex !== toIndex) {
        onReorderSlide(dragIndex, toIndex);
      }
      setDragIndex(null);
      setDragOverIndex(null);
    },
    [dragIndex, onReorderSlide]
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  // Navigate with arrows
  const canGoLeft = currentSlide > 0;
  const canGoRight = currentSlide < slides.length - 1;

  return (
    <div className="relative shrink-0 flex items-center gap-2 px-4 py-3 bg-[#0a0d20] border-t border-white/[0.06]">
      {/* Left arrow */}
      <button
        onClick={() => canGoLeft && onSlideChange(currentSlide - 1)}
        disabled={!canGoLeft}
        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-[#5e6388]
          hover:text-[#e8eaff] hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed
          transition-all cursor-pointer"
      >
        <ChevronLeft size={16} />
      </button>

      {/* Slides track */}
      <div
        ref={scrollRef}
        className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-hide py-1"
        style={{ scrollbarWidth: "none" }}
      >
        {slides.map((_, index) => {
          const isActive = index === currentSlide;
          const isDragging = dragIndex === index;
          const isDragOver = dragOverIndex === index && dragIndex !== index;

          return (
            <div
              key={index}
              draggable
              onClick={() => onSlideChange(index)}
              onContextMenu={(e) => handleContextMenu(e, index)}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`
                group relative shrink-0 flex flex-col items-center gap-1 cursor-pointer
                transition-all duration-150
                ${isDragging ? "opacity-40" : ""}
                ${isDragOver ? "translate-x-2" : ""}
              `}
            >
              {/* Thumbnail */}
              <div
                className={`
                  relative w-[60px] h-[75px] rounded-md overflow-hidden border-2 transition-all duration-150
                  ${isActive
                    ? "border-[#4ecdc4] shadow-[0_0_12px_rgba(78,205,196,0.25)]"
                    : "border-white/[0.08] hover:border-white/20"
                  }
                `}
              >
                {thumbnails[index] ? (
                  <img
                    src={thumbnails[index]}
                    alt={`Slide ${index + 1}`}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <div className="w-full h-full bg-[#141736] flex items-center justify-center">
                    <span className="text-[10px] text-[#5e6388]">{index + 1}</span>
                  </div>
                )}

                {/* Drag handle (visible on hover) */}
                <div className="absolute top-0.5 left-0.5 opacity-0 group-hover:opacity-60 transition-opacity">
                  <GripVertical size={10} className="text-white/60" />
                </div>
              </div>

              {/* Slide number */}
              <span
                className={`text-[10px] font-medium transition-colors ${
                  isActive ? "text-[#4ecdc4]" : "text-[#5e6388]"
                }`}
              >
                {index + 1}
              </span>
            </div>
          );
        })}

        {/* Add slide button */}
        <button
          onClick={onAddSlide}
          className="shrink-0 flex flex-col items-center gap-1 cursor-pointer group"
        >
          <div className="w-[60px] h-[75px] rounded-md border-2 border-dashed border-white/[0.1]
            flex items-center justify-center hover:border-[#4ecdc4]/40 hover:bg-[#4ecdc4]/5
            transition-all group-hover:border-[#4ecdc4]/40 group-hover:bg-[#4ecdc4]/5"
          >
            <Plus size={18} className="text-[#5e6388] group-hover:text-[#4ecdc4] transition-colors" />
          </div>
          <span className="text-[10px] font-medium text-[#5e6388] group-hover:text-[#4ecdc4] transition-colors">
            Novo
          </span>
        </button>
      </div>

      {/* Right arrow */}
      <button
        onClick={() => canGoRight && onSlideChange(currentSlide + 1)}
        disabled={!canGoRight}
        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-[#5e6388]
          hover:text-[#e8eaff] hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed
          transition-all cursor-pointer"
      >
        <ChevronRight size={16} />
      </button>

      {/* Slide count */}
      <div className="shrink-0 text-[10px] font-mono text-[#5e6388] tabular-nums">
        {currentSlide + 1}/{slides.length}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-[100] bg-[#141736] border border-white/10 rounded-lg shadow-2xl shadow-black/50 py-1 min-w-[160px]"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            transform: "translateY(-100%)",
          }}
        >
          <button
            onClick={() => {
              onDuplicateSlide(contextMenu.index);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#e8eaff]
              hover:bg-white/5 transition-colors cursor-pointer"
          >
            <Copy size={13} />
            Duplicar slide
          </button>
          {slides.length > 1 && (
            <button
              onClick={() => {
                onDeleteSlide(contextMenu.index);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400
                hover:bg-red-500/10 transition-colors cursor-pointer"
            >
              <Trash2 size={13} />
              Excluir slide
            </button>
          )}
        </div>
      )}
    </div>
  );
}
