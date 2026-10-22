import React from "react";

/**
 * KeepAlivePanel
 * Keeps a tab panel mounted (preserving its internal state) but skips React
 * reconciliation entirely while it stays hidden. Parent re-renders (e.g. tab
 * switches, color picks, slider drags) therefore only cost work for the one
 * visible panel instead of every persistently-mounted panel.
 */
interface KeepAlivePanelProps {
  active: boolean;
  children: React.ReactNode;
  className?: string;
  direction?: "forward" | "backward" | "up";
}

const KeepAlivePanelInner: React.FC<KeepAlivePanelProps> = ({
  active,
  children,
  className = "",
  direction = "up",
}) => {
  const animClass = active
    ? direction === "forward"
      ? "gk-tab-transition-forward"
      : direction === "backward"
      ? "gk-tab-transition-backward"
      : "gk-tab-transition"
    : "";
  return (
    <div
      translate="no"
      className={`notranslate ${active ? `block ${animClass}` : "hidden"} ${className}`}
      aria-hidden={!active}
    >
      {children}
    </div>
  );
};

// Skip re-render when the panel is hidden before and after the update.
export const KeepAlivePanel = React.memo(
  KeepAlivePanelInner,
  (prev, next) => !prev.active && !next.active
);

export default KeepAlivePanel;
