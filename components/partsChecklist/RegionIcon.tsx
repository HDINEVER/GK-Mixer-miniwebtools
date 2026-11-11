import React from "react";
import type { ChecklistRegionCategory } from "../../types";

/**
 * 机甲身体部位矢量 Icon（24×24 viewBox，描边绘制）
 * 路径数据同时供 DOM SVG 与 Canvas Path2D（海报导出）复用。
 */
export const REGION_ICON_PATHS: Record<ChecklistRegionCategory, string[]> = {
  head: [
    "M12 6.2 L6.2 2.4 M12 6.2 L17.8 2.4",
    "M6.5 10 C6.5 7 9 5.4 12 5.4 C15 5.4 17.5 7 17.5 10 L17.5 14.2 L15 17.8 L9 17.8 L6.5 14.2 Z",
    "M8.6 10.8 L11 11.8 M15.4 10.8 L13 11.8",
    "M10 14.6 L12 16.2 L14 14.6",
  ],
  torso: [
    "M5 6 L9 4.5 L15 4.5 L19 6 L18 14 L14.5 18.5 L9.5 18.5 L6 14 Z",
    "M8 8.5 L11 8.5 L11 11.2 L8 11.2 Z",
    "M13 8.5 L16 8.5 L16 11.2 L13 11.2 Z",
    "M12 13.2 L12 18.5",
  ],
  core: [
    "M12 3 L13.5 9 L20 13 L20 14.6 L13.5 13.2 L13 18 L15.5 20 L15.5 21 L12 20.2 L8.5 21 L8.5 20 L11 18 L10.5 13.2 L4 14.6 L4 13 L10.5 9 Z",
  ],
  backpack: [
    "M7 5 H17 V15 H7 Z",
    "M8.6 15 L7.6 19.5 H11 L10.2 15",
    "M13.8 15 L13 19.5 H16.4 L15.4 15",
    "M9 5 V2.4 M15 5 V2.4",
    "M10 8.6 H14",
  ],
  waist: [
    "M6 4.5 H18 V8 H6 Z",
    "M7 8 L6 15.5 L10.6 16.5 L11 8",
    "M13 8 L13.4 16.5 L18 15.5 L17 8",
    "M11 8 H13 L12.5 12 H11.5 Z",
  ],
  arm_common: [
    "M9 2.6 H14.4 V8.8 H9 Z",
    "M10.2 10.4 a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0 -3 0",
    "M8.4 12.2 H15.2 L14.6 18 H9 Z",
    "M9.4 18.6 H14.2 V21.6 H9.4 Z",
  ],
  arm_r: [
    "M9 2.6 H14.4 V8.8 H9 Z",
    "M10.2 10.4 a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0 -3 0",
    "M8.4 12.2 H15.2 L14.6 18 H9 Z",
    "M9.4 18.6 H14.2 V21.6 H9.4 Z",
    "M17.5 4 V9 M17.5 4 H19.5 C20.6 4 20.6 6.4 19.5 6.4 H17.5 M18.8 6.4 L20.6 9",
  ],
  arm_l: [
    "M9 2.6 H14.4 V8.8 H9 Z",
    "M10.2 10.4 a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0 -3 0",
    "M8.4 12.2 H15.2 L14.6 18 H9 Z",
    "M9.4 18.6 H14.2 V21.6 H9.4 Z",
    "M17.6 4 V9 H20.6",
  ],
  shoulder: [
    "M4 11 C4 6.5 7.5 4 12 4 C16.5 4 20 6.5 20 11 L18 15 H6 Z",
    "M7 11 H17",
    "M10 15 V19.5 H14 V15",
  ],
  leg_common: [
    "M9 2.4 H15 V8.8 H9 Z",
    "M8.5 9.4 H15.5 L15 12 H9 Z",
    "M9 12 H15 L16 18 H8 Z",
    "M7 18.6 H17 L18.6 21.6 H5.4 Z",
  ],
  leg_r: [
    "M7 2.4 H13 V8.8 H7 Z",
    "M6.5 9.4 H13.5 L13 12 H7 Z",
    "M7 12 H13 L14 18 H6 Z",
    "M5 18.6 H15 L16.6 21.6 H3.4 Z",
    "M17.5 4 V9 M17.5 4 H19.5 C20.6 4 20.6 6.4 19.5 6.4 H17.5 M18.8 6.4 L20.6 9",
  ],
  leg_l: [
    "M7 2.4 H13 V8.8 H7 Z",
    "M6.5 9.4 H13.5 L13 12 H7 Z",
    "M7 12 H13 L14 18 H6 Z",
    "M5 18.6 H15 L16.6 21.6 H3.4 Z",
    "M17.6 4 V9 H20.6",
  ],
  weapon: [
    "M4 9 H17 V13 H4 Z",
    "M17 10.2 H21.6 V11.8 H17",
    "M8 13 L7 18 H9.6 L10.6 13",
    "M9 9 V7 H14 V9",
    "M4 10 L2 10.6 V13.4 L4 13",
  ],
  shield: [
    "M12 3 L19 5.5 V11.5 C19 15.5 16 19 12 21 C8 19 5 15.5 5 11.5 V5.5 Z",
    "M12 7 V16 M8.5 10.5 H15.5",
  ],
  effect: [
    "M12 3 L13.6 9.2 L20 11 L13.6 12.8 L12 19 L10.4 12.8 L4 11 L10.4 9.2 Z",
    "M18.5 3.5 V6.5 M17 5 H20",
  ],
  adapter: [
    "M5 19 H19 V21 H5 Z",
    "M11 19 V11 H13 V19",
    "M10 9 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0",
    "M13.6 7.8 L17.4 5 L19.4 6.6 M17.4 5 L16.4 3",
  ],
  decal: [
    "M5 4 H19 V14 L14 19 H5 Z",
    "M19 14 H14 V19",
    "M8 8 H15 M8 11 H13",
  ],
  other: [
    "M12 3 L20 7.5 V16.5 L12 21 L4 16.5 V7.5 Z",
    "M4 7.5 L12 12 L20 7.5 M12 12 V21",
  ],
};

interface RegionIconProps {
  category: ChecklistRegionCategory;
  className?: string;
  strokeWidth?: number;
}

export const RegionIcon: React.FC<RegionIconProps> = ({ category, className, strokeWidth = 1.6 }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {(REGION_ICON_PATHS[category] ?? REGION_ICON_PATHS.other).map((d, i) => (
      <path key={i} d={d} />
    ))}
  </svg>
);

export default RegionIcon;
