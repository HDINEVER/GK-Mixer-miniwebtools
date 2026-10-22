import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "@phosphor-icons/react";

/**
 * ResponsiveSheet
 * - < 768px (mobile / Android portrait): native-feel Bottom Sheet with drag handle,
 *   swipe-down-to-close, safe-area padding, and keyboard-friendly bottom anchoring.
 * - >= 768px (desktop): compact floating Popover card anchored above the bottom-right FAB
 *   (or centered card when `desktopPlacement="center"`), without dimming/blurring the page.
 *
 * Deliberately avoids full-screen `backdrop-filter: blur()` so Android WebView stays at 60fps.
 */
export interface ResponsiveSheetProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  desktopPlacement?: "fab" | "center";
  desktopWidth?: number;
}

const MOBILE_QUERY = "(max-width: 767.98px)";
const ANIM_MS = 260;

export const ResponsiveSheet: React.FC<ResponsiveSheetProps> = ({
  open,
  onClose,
  title,
  icon,
  children,
  desktopPlacement = "fab",
  desktopWidth = 400,
}) => {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragDelta = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Mount -> next frame animate in; close -> animate out then unmount
  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const t = window.setTimeout(() => setMounted(false), ANIM_MS);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock page scroll on mobile while the sheet is open
  useEffect(() => {
    if (!open || !isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, isMobile]);

  if (!mounted) return null;

  const onHandlePointerDown = (e: React.PointerEvent) => {
    dragStartY.current = e.clientY;
    dragDelta.current = 0;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    if (panelRef.current) panelRef.current.style.transition = "none";
  };
  const onHandlePointerMove = (e: React.PointerEvent) => {
    if (dragStartY.current === null || !panelRef.current) return;
    dragDelta.current = Math.max(0, e.clientY - dragStartY.current);
    panelRef.current.style.transform = `translate3d(0, ${dragDelta.current}px, 0)`;
  };
  const onHandlePointerUp = () => {
    if (dragStartY.current === null || !panelRef.current) return;
    dragStartY.current = null;
    panelRef.current.style.transition = "";
    panelRef.current.style.transform = "";
    if (dragDelta.current > 90) onClose();
  };

  const header = (title || icon) && (
    <div className="flex items-center justify-between gap-2 mb-4">
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <h3 className="text-[15px] font-black text-slate-900 dark:text-white truncate">{title}</h3>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition"
        aria-label="关闭"
      >
        <XIcon className="h-4 w-4" weight="bold" />
      </button>
    </div>
  );

  const content = isMobile ? (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true">
      {/* Lightweight dim overlay — no blur, Android WebView friendly */}
      <div
        className={`absolute inset-0 bg-slate-900/25 transition-opacity duration-200 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto overscroll-contain rounded-t-3xl bg-white dark:bg-slate-900 px-5 pt-2.5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-8px_32px_rgba(15,23,42,0.14)]"
        style={{
          transform: visible ? "translate3d(0,0,0)" : "translate3d(0,100%,0)",
          transition: `transform ${ANIM_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`,
          willChange: "transform",
        }}
      >
        {/* Drag handle (tap or swipe down to close) */}
        <div
          className="flex justify-center pb-3 pt-1 cursor-grab touch-none"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
        >
          <span className="block h-1 w-9 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>
        {header}
        {children}
      </div>
    </div>
  ) : (
    <div className="fixed inset-0 z-[60] pointer-events-none" role="dialog" aria-modal="false">
      {/* Transparent click-catcher: closes on outside click without dimming the page */}
      <div className="absolute inset-0 pointer-events-auto" onClick={onClose} />
      <div
        className={`pointer-events-auto absolute rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 shadow-[0_16px_48px_rgba(15,23,42,0.16)] max-h-[calc(100dvh-8rem)] overflow-y-auto ${
          desktopPlacement === "fab" ? "bottom-24 right-6 origin-bottom-right" : "left-1/2 top-1/2"
        }`}
        style={{
          width: desktopWidth,
          opacity: visible ? 1 : 0,
          transform:
            desktopPlacement === "fab"
              ? visible
                ? "translate3d(0,0,0) scale(1)"
                : "translate3d(0,8px,0) scale(0.96)"
              : visible
              ? "translate(-50%,-50%) scale(1)"
              : "translate(-50%,-48%) scale(0.96)",
          transition: `opacity 180ms ease-out, transform ${ANIM_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`,
        }}
      >
        {header}
        {children}
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default ResponsiveSheet;
