/**
 * 取件表海报长图导出（纯 Canvas 2D 绘制，暗黑硬核风）
 * 布局：玩家实拍封面 → 标题 + 四大统计 + CLEAN SCORE → RUNNER LAYOUT 比例尺 → 板件图例
 *       → 按部位彩条号码矩阵（groupBy=region） / 按板件分部位号码行（groupBy=runner）
 */
import type { ChecklistGroupBy, ChecklistRunner, PartsChecklist } from '../types';
import {
  compressNumbers,
  computeChecklistStats,
  formatSegment,
  GRADE_META,
  groupRegionParts,
  pivotByRunner,
  readableTextColor,
  regionPartCount,
  RunnerGroup,
  segmentBadgeLabel,
} from './partsChecklist';
import { REGION_ICON_PATHS } from '../components/partsChecklist/RegionIcon';

const DEFAULT_W = 1080;
const WIDE_W = 1600;
const PAD = 56;
const BG = '#090A0F';
const SANS = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",-apple-system,"Helvetica Neue",Arial,sans-serif';
const MONO = 'ui-monospace,"SF Mono",Menlo,Consolas,monospace';

/** iOS Safari 单画布面积上限 ≈ 16.7M px，留余量 */
const MAX_CANVAS_AREA = 15_500_000;

interface PosterOptions {
  checklist: PartsChecklist;
  title: string;
  subtitle?: string;
  coverSrc?: string;
  /** 列表分组：按部位（默认） / 按板件 */
  groupBy?: ChecklistGroupBy;
  /** 排布栏数：1=1080px 单栏竖版长图；2=1600px 双栏宽幅一屏海报 */
  columns?: 1 | 2;
  /** 期望像素倍率（会按面积上限自动下调） */
  pixelRatio?: number;
}

const loadImage = (src?: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
};

const wrapLines = (ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] => {
  const lines: string[] = [];
  let line = '';
  for (const ch of Array.from(text)) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
};

// ------------------------------------------------------------------
// 号码胶囊流式布局
// ------------------------------------------------------------------

interface CellBox {
  x: number;
  y: number;
  w: number;
  text: string;
  badge?: string;
  isHead: boolean;
  bg: string;
  fg: string;
  stripeColor?: string;
}

interface GroupRun {
  x: number;
  y: number;
  w: number;
}

const CELL_H = 40;
const CELL_GAP = 2;
const HEAD_EXTRA_GAP = 2;
const GROUP_GAP_X = 12;
const ROW_GAP = 10;
const HEAD_FONT = `900 20px ${SANS}`;
const NUM_FONT = `700 19px ${MONO}`;
const BADGE_FONT = `800 12px ${MONO}`;

const layoutGroups = (
  ctx: CanvasRenderingContext2D,
  groups: RunnerGroup[],
  runnerMap: Map<string, ChecklistRunner>,
  x0: number,
  y0: number,
  maxW: number,
  hideHead = false
): { cells: CellBox[]; runs: GroupRun[]; height: number } => {
  const cells: CellBox[] = [];
  const runs: GroupRun[] = [];
  let x = x0;
  let y = y0;

  const measureCell = (text: string, isHead: boolean, badge?: string) => {
    ctx.font = isHead ? HEAD_FONT : NUM_FONT;
    let w = ctx.measureText(text).width + (isHead ? 28 : 22);
    if (badge) {
      ctx.font = BADGE_FONT;
      w += ctx.measureText(badge).width + 2;
    }
    return Math.max(isHead ? 42 : 40, Math.ceil(w));
  };

  for (const group of groups) {
    const runner = runnerMap.get(group.runnerId);
    const base = runner?.colorHex ?? '#C9CED6';
    const tileFg = readableTextColor(base);
    const isDarkRunner = tileFg === '#FFFFFF';
    const headBg = isDarkRunner ? '#F8FAFC' : '#1E293B';
    const headFg = isDarkRunner ? '#0F172A' : '#F8FAFC';
    const headItem = {
      text: group.runnerId,
      isHead: true,
      badge: undefined as string | undefined,
      bg: headBg,
      fg: headFg,
      stripeColor: base as string | undefined,
    };
    const items = [
      ...(hideHead ? [] : [headItem]),
      ...group.segments.map((s) => {
        const segBg = s.colorHex ?? base;
        return {
          text: formatSegment(s),
          isHead: false,
          badge: segmentBadgeLabel(s),
          bg: segBg,
          fg: readableTextColor(segBg),
          stripeColor: undefined as string | undefined,
        };
      }),
    ];
    const widths = items.map((it) => measureCell(it.text, it.isHead, it.badge));
    const groupW =
      widths.reduce((a, b) => a + b, 0) +
      CELL_GAP * (widths.length - 1) +
      (!hideHead && items.length > 1 ? HEAD_EXTRA_GAP : 0);

    if (x > x0 && x + groupW > x0 + maxW) {
      x = x0;
      y += CELL_H + ROW_GAP;
    }

    let runStart = x;
    let lastGap = CELL_GAP;
    items.forEach((it, i) => {
      const w = widths[i];
      if (x > runStart && x + w > x0 + maxW) {
        runs.push({ x: runStart, y, w: x - lastGap - runStart });
        x = x0;
        y += CELL_H + ROW_GAP;
        runStart = x;
      }
      cells.push({
        x,
        y,
        w,
        text: it.text,
        badge: it.badge,
        isHead: it.isHead,
        bg: it.bg,
        fg: it.fg,
        stripeColor: it.stripeColor,
      });
      const stepGap = it.isHead ? CELL_GAP + HEAD_EXTRA_GAP : CELL_GAP;
      lastGap = stepGap;
      x += w + stepGap;
    });
    runs.push({ x: runStart, y, w: x - lastGap - runStart });
    x += GROUP_GAP_X - lastGap;
  }

  return { cells, runs, height: groups.length ? y - y0 + CELL_H : 0 };
};

const drawCells = (ctx: CanvasRenderingContext2D, cells: CellBox[], runs: GroupRun[]) => {
  for (const run of runs) {
    ctx.fillStyle = '#0F172A';
    roundRect(ctx, run.x - 2, run.y - 2, run.w + 4, CELL_H + 4, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  for (const c of cells) {
    if (c.isHead && c.stripeColor) {
      ctx.save();
      roundRect(ctx, c.x, c.y, c.w, CELL_H, 5);
      ctx.clip();
      ctx.fillStyle = c.bg;
      ctx.fillRect(c.x, c.y, c.w, CELL_H);
      ctx.fillStyle = c.stripeColor;
      ctx.fillRect(c.x, c.y, 5, CELL_H);
      ctx.restore();
    } else {
      ctx.fillStyle = c.bg;
      roundRect(ctx, c.x, c.y, c.w, CELL_H, 5);
      ctx.fill();
    }
    ctx.fillStyle = c.fg;
    ctx.textBaseline = 'middle';
    ctx.font = c.isHead ? HEAD_FONT : NUM_FONT;
    if (c.badge) {
      const tw = ctx.measureText(c.text).width;
      ctx.font = BADGE_FONT;
      const bw = ctx.measureText(c.badge).width;
      const startX = c.x + (c.w - tw - bw - 2) / 2;
      ctx.font = NUM_FONT;
      ctx.textAlign = 'left';
      ctx.fillText(c.text, startX, c.y + CELL_H / 2 + 1);
      ctx.font = BADGE_FONT;
      ctx.globalAlpha = 0.85;
      ctx.fillText(c.badge, startX + tw + 2, c.y + 12);
      ctx.globalAlpha = 1;
    } else if (c.isHead) {
      ctx.textAlign = 'center';
      ctx.fillText(c.text, c.x + 2.5 + (c.w - 2.5) / 2, c.y + CELL_H / 2 + 1);
    } else {
      ctx.textAlign = 'center';
      ctx.fillText(c.text, c.x + c.w / 2, c.y + CELL_H / 2 + 1);
    }
  }
  ctx.textAlign = 'left';
};

const drawIcon = (
  ctx: CanvasRenderingContext2D,
  paths: string[],
  x: number,
  y: number,
  size: number,
  color: string
) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.7;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const d of paths) {
    try {
      ctx.stroke(new Path2D(d));
    } catch {
      /* Path2D 不可用时跳过图标 */
    }
  }
  ctx.restore();
};

// ------------------------------------------------------------------
// 主绘制：draw=false 时只测量总高度
// ------------------------------------------------------------------

const paint = (
  ctx: CanvasRenderingContext2D,
  opts: PosterOptions,
  cover: HTMLImageElement | null,
  draw: boolean
): number => {
  const { checklist } = opts;
  const W = opts.columns === 2 ? WIDE_W : DEFAULT_W;
  const CONTENT_W = W - PAD * 2;
  const stats = computeChecklistStats(checklist);
  const runnerMap = new Map(checklist.runners.map((r) => [r.id, r]));
  let y = 0;

  // 1. 封面
  const coverH = cover ? 640 : 150;
  if (draw) {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, 1e5);
    if (cover) {
      const s = Math.max(W / cover.width, coverH / cover.height);
      const dw = cover.width * s;
      const dh = cover.height * s;
      ctx.drawImage(cover, (W - dw) / 2, (coverH - dh) / 2, dw, dh);
      const top = ctx.createLinearGradient(0, 0, 0, 160);
      top.addColorStop(0, 'rgba(9,10,15,0.55)');
      top.addColorStop(1, 'rgba(9,10,15,0)');
      ctx.fillStyle = top;
      ctx.fillRect(0, 0, W, 160);
      const fade = ctx.createLinearGradient(0, coverH * 0.38, 0, coverH);
      fade.addColorStop(0, 'rgba(9,10,15,0)');
      fade.addColorStop(0.7, 'rgba(9,10,15,0.85)');
      fade.addColorStop(1, BG);
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, W, coverH + 1);
    } else {
      const g = ctx.createLinearGradient(0, 0, W, coverH);
      g.addColorStop(0, '#151823');
      g.addColorStop(1, BG);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, coverH);
    }
    // 右上角品牌水印
    ctx.font = `800 16px ${MONO}`;
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('GK MIXER', W - PAD, 40);
    ctx.textAlign = 'left';
  }

  // 2. 标题区
  y = cover ? coverH - 210 : 64;
  ctx.textBaseline = 'top';
  ctx.font = `900 24px ${SANS}`;
  const tagW = ctx.measureText('取件表').width + 28;
  if (draw) {
    ctx.fillStyle = '#E5322D';
    roundRect(ctx, PAD, y, tagW, 40, 4);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('取件表', PAD + 14, y + 8);
    ctx.font = `700 14px ${MONO}`;
    ctx.fillStyle = '#A3A9B3';
    ctx.fillText('PARTS CHECKLIST', PAD + tagW + 14, y + 3);
    ctx.fillStyle = '#6B717C';
    ctx.fillText(
      opts.groupBy === 'runner' ? 'PICK BY RUNNER · 按板件取件' : 'VERIFY BY REGION · 按部位取件',
      PAD + tagW + 14,
      y + 21
    );
  }
  y += 56;

  ctx.font = `900 58px ${SANS}`;
  const titleLines = wrapLines(ctx, opts.title || '未命名机体', CONTENT_W);
  for (const line of titleLines) {
    if (draw) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(line, PAD, y);
    }
    y += 68;
  }
  if (opts.subtitle) {
    ctx.font = `700 22px ${SANS}`;
    if (draw) {
      ctx.fillStyle = '#A3A9B3';
      ctx.fillText(opts.subtitle, PAD, y);
    }
    y += 34;
  }
  ctx.font = `600 17px ${SANS}`;
  if (draw) {
    ctx.fillStyle = '#6B717C';
    ctx.fillText(
      `零件数: ${stats.partsCount}   ·   板件数: ${stats.runnersCount}   ·   部位数: ${stats.regionsCount}`,
      PAD,
      y
    );
  }
  y += 44;

  // 3. 四大统计卡
  const cardGap = 14;
  const cardW = (CONTENT_W - cardGap * 3) / 4;
  const cardH = 128;
  if (draw) {
    const cards: Array<{ label: string; value: string; color?: string; sub?: string }> = [
      { label: 'PARTS', value: String(stats.partsCount), sub: '零件总数' },
      { label: 'RUNNERS', value: String(stats.runnersCount), sub: '板件数' },
      { label: 'REGIONS', value: String(stats.regionsCount), sub: '部位数' },
      {
        label: 'CLEAN SCORE',
        value: stats.grade ? `[${stats.grade}] ${stats.cleanScore}` : '--',
        color: stats.grade ? GRADE_META[stats.grade].color : '#6B717C',
        sub: stats.grade ? `${GRADE_META[stats.grade].label} /100` : '尚未分配零件',
      },
    ];
    cards.forEach((c, i) => {
      const cx = PAD + i * (cardW + cardGap);
      ctx.fillStyle = '#11131A';
      roundRect(ctx, cx, y, cardW, cardH, 14);
      ctx.fill();
      ctx.strokeStyle = c.color ? `${c.color}66` : '#22252E';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = `800 13px ${MONO}`;
      ctx.fillStyle = '#6B717C';
      ctx.fillText(c.label, cx + 18, y + 18);
      ctx.font = `900 ${c.value.length > 6 ? 38 : 46}px ${MONO}`;
      ctx.fillStyle = c.color ?? '#FFFFFF';
      ctx.fillText(c.value, cx + 18, y + 42);
      ctx.font = `600 14px ${SANS}`;
      ctx.fillStyle = '#7C828C';
      ctx.fillText(c.sub ?? '', cx + 18, y + cardH - 30);
    });
  }
  y += cardH + 36;

  // 4. RUNNER LAYOUT 比例尺
  if (checklist.runners.length) {
    if (draw) {
      ctx.font = `800 14px ${MONO}`;
      ctx.fillStyle = '#A3A9B3';
      ctx.fillText('RUNNER LAYOUT', PAD, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#6B717C';
      ctx.font = `600 14px ${SANS}`;
      ctx.fillText('板件零件量分布', W - PAD, y);
      ctx.textAlign = 'left';
    }
    y += 28;
    const total = checklist.runners.reduce((s, r) => s + r.maxNumber, 0) || 1;
    if (draw) {
      ctx.save();
      roundRect(ctx, PAD, y, CONTENT_W, 36, 8);
      ctx.clip();
      let bx = PAD;
      checklist.runners.forEach((r) => {
        const bw = (r.maxNumber / total) * CONTENT_W;
        ctx.fillStyle = r.colorHex;
        ctx.fillRect(bx, y, bw, 36);
        ctx.fillStyle = '#000000';
        ctx.fillRect(bx + bw - 1, y, 2, 36);
        ctx.fillStyle = readableTextColor(r.colorHex);
        ctx.font = `800 14px ${MONO}`;
        ctx.textBaseline = 'middle';
        const label = bw > 64 ? `${r.id} ${r.maxNumber}` : bw > 22 ? r.id : '';
        if (label) {
          ctx.textAlign = 'center';
          ctx.fillText(label, bx + bw / 2, y + 18);
        }
        bx += bw;
      });
      ctx.restore();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
    }
    y += 36 + 34;

    // 5. 板件图例
    if (draw) {
      ctx.font = `800 14px ${MONO}`;
      ctx.fillStyle = '#A3A9B3';
      ctx.fillText('RUNNERS', PAD, y);
    }
    y += 28;
    let lx = PAD;
    const tileH = 36;
    checklist.runners.forEach((r) => {
      ctx.font = `900 18px ${SANS}`;
      const letterW = Math.max(36, ctx.measureText(r.id).width + 20);
      const paintLabel = r.paintCode ? `${r.paintCode}${r.paintName ? ' ' + r.paintName : ''}` : r.paintName || '';
      ctx.font = `600 13px ${SANS}`;
      const labelW = paintLabel ? Math.min(180, ctx.measureText(paintLabel).width) + 18 : 0;
      const tileW = letterW + labelW;
      if (lx > PAD && lx + tileW > W - PAD) {
        lx = PAD;
        y += tileH + 10;
      }
      if (draw) {
        ctx.fillStyle = '#0F172A';
        roundRect(ctx, lx - 2, y - 2, tileW + 4, tileH + 4, 7);
        ctx.fill();
        ctx.fillStyle = r.colorHex;
        roundRect(ctx, lx, y, letterW, tileH, 5);
        ctx.fill();
        ctx.fillStyle = readableTextColor(r.colorHex);
        ctx.font = `900 18px ${SANS}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(r.id, lx + letterW / 2, y + tileH / 2 + 1);
        ctx.textAlign = 'left';
        if (paintLabel) {
          ctx.fillStyle = '#14161D';
          roundRect(ctx, lx + letterW + 2, y, labelW - 2, tileH, 5);
          ctx.fill();
          ctx.fillStyle = '#C3C8D0';
          ctx.font = `600 13px ${SANS}`;
          const clipped = wrapLines(ctx, paintLabel, 180)[0] ?? '';
          ctx.fillText(clipped, lx + letterW + 10, y + tileH / 2 + 1);
        }
        ctx.textBaseline = 'top';
      }
      lx += tileW + 10;
    });
    y += tileH + 30;
  }

  // 分隔线
  if (draw) {
    ctx.fillStyle = '#1C1F28';
    ctx.fillRect(PAD, y, CONTENT_W, 2);
  }
  y += 30;

  // 6. 部位列表 / 板件列表
  const filled = checklist.regions.filter((r) => r.parts.length > 0);
  if (!filled.length && draw) {
    ctx.font = `600 18px ${SANS}`;
    ctx.fillStyle = '#6B717C';
    ctx.fillText('尚未为任何部位分配零件', PAD, y);
  }
  if (!filled.length) y += 40;

  if (opts.groupBy === 'runner' && filled.length) {
    y = paintRunnerSections(ctx, checklist, y, draw, CONTENT_W);
  } else if (opts.columns === 2 && filled.length) {
    const colGap = 24;
    const colW = Math.floor((CONTENT_W - colGap) / 2);
    const cardPad = 20;
    const innerW = colW - cardPad * 2;
    for (let i = 0; i < filled.length; i += 2) {
      const pair = [filled[i], filled[i + 1]].filter(Boolean);
      const layouts = pair.map((region, colIdx) => {
        const cx = PAD + colIdx * (colW + colGap);
        const groups = groupRegionParts(region.parts, checklist.runners, checklist.mergeConsecutive);
        const laid = layoutGroups(ctx, groups, runnerMap, cx + cardPad, y + cardPad + 52, innerW);
        const cardH = cardPad + 52 + laid.height + cardPad;
        return { region, cx, laid, cardH };
      });
      const rowH = Math.max(...layouts.map((l) => l.cardH));
      if (draw) {
        for (const item of layouts) {
          ctx.fillStyle = '#0E1017';
          roundRect(ctx, item.cx, y, colW, rowH, 14);
          ctx.fill();
          ctx.strokeStyle = '#1D212C';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          const hx = item.cx + cardPad;
          const hy = y + cardPad;
          ctx.fillStyle = '#151820';
          roundRect(ctx, hx, hy, 38, 38, 9);
          ctx.fill();
          drawIcon(
            ctx,
            REGION_ICON_PATHS[item.region.category] ?? REGION_ICON_PATHS.other,
            hx + 6,
            hy + 6,
            26,
            '#E8EAEE'
          );
          ctx.font = `900 22px ${SANS}`;
          ctx.fillStyle = '#FFFFFF';
          ctx.textBaseline = 'middle';
          ctx.fillText(item.region.title, hx + 50, hy + 20);
          const tw = ctx.measureText(item.region.title).width;
          ctx.font = `600 14px ${SANS}`;
          ctx.fillStyle = '#6B717C';
          ctx.fillText(`零件数: ${regionPartCount(item.region)}`, hx + 50 + tw + 12, hy + 21);
          ctx.textBaseline = 'top';
          drawCells(ctx, item.laid.cells, item.laid.runs);
        }
      }
      y += rowH + 20;
    }
  } else {
    filled.forEach((region, idx) => {
      if (draw) {
        ctx.fillStyle = '#151820';
        roundRect(ctx, PAD, y, 40, 40, 9);
        ctx.fill();
        drawIcon(ctx, REGION_ICON_PATHS[region.category] ?? REGION_ICON_PATHS.other, PAD + 7, y + 7, 26, '#E8EAEE');
        ctx.font = `900 24px ${SANS}`;
        ctx.fillStyle = '#FFFFFF';
        ctx.textBaseline = 'middle';
        ctx.fillText(region.title, PAD + 54, y + 21);
        const tw = ctx.measureText(region.title).width;
        ctx.font = `600 15px ${SANS}`;
        ctx.fillStyle = '#6B717C';
        ctx.fillText(`零件数: ${regionPartCount(region)}`, PAD + 54 + tw + 14, y + 22);
        ctx.textBaseline = 'top';
      }
      y += 56;
      const groups = groupRegionParts(region.parts, checklist.runners, checklist.mergeConsecutive);
      const laid = layoutGroups(ctx, groups, runnerMap, PAD, y, CONTENT_W);
      if (draw) drawCells(ctx, laid.cells, laid.runs);
      y += laid.height + 26;
      if (idx < filled.length - 1) {
        if (draw) {
          ctx.fillStyle = '#15171E';
          ctx.fillRect(PAD, y, CONTENT_W, 1);
        }
        y += 24;
      }
    });
  }

  // 7. 页脚
  y += 24;
  if (draw) {
    ctx.fillStyle = '#1C1F28';
    ctx.fillRect(PAD, y, CONTENT_W, 1);
    ctx.font = `700 14px ${MONO}`;
    ctx.fillStyle = '#5B616B';
    ctx.fillText('玩家自制取件表 · 封面为实拍作品', PAD, y + 20);
    ctx.textAlign = 'right';
    ctx.fillText('POWERED BY GK MIXER', W - PAD, y + 20);
    ctx.textAlign = 'left';
  }
  y += 64;
  return Math.ceil(y);
};

// ------------------------------------------------------------------
// 按板件取件：板件头 → 每个部位一行（左：部位图标 + 名称；右：号码方块）
// ------------------------------------------------------------------

const ROW_LABEL_W = 232;

const paintRunnerSections = (
  ctx: CanvasRenderingContext2D,
  checklist: PartsChecklist,
  y0: number,
  draw: boolean,
  contentW: number
): number => {
  const { cards } = pivotByRunner(checklist);
  let y = y0;
  cards.forEach((card, idx) => {
    const base = card.runner?.colorHex ?? '#C9CED6';
    const runnerMap = new Map<string, ChecklistRunner>(
      card.runner ? [[card.runnerId, card.runner]] : []
    );
    // 板件头
    ctx.font = `900 24px ${MONO}`;
    const tileW = Math.max(56, Math.ceil(ctx.measureText(card.runnerId).width) + 24);
    if (draw) {
      ctx.fillStyle = base;
      roundRect(ctx, PAD, y, tileW, 48, 9);
      ctx.fill();
      ctx.fillStyle = readableTextColor(base);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(card.runnerId, PAD + tileW / 2, y + 25);
      ctx.textAlign = 'left';
      ctx.font = `900 24px ${SANS}`;
      ctx.fillStyle = '#FFFFFF';
      const title = `${card.runnerId} 板`;
      ctx.fillText(title, PAD + tileW + 16, y + 16);
      const tw = ctx.measureText(title).width;
      ctx.font = `600 15px ${SANS}`;
      ctx.fillStyle = '#6B717C';
      ctx.fillText(`${card.partCount} 件 · 跨 ${card.rows.length} 部位`, PAD + tileW + 16 + tw + 14, y + 17);
      const paintLabel = card.runner
        ? [card.runner.paintCode, card.runner.paintName].filter(Boolean).join(' ')
        : '';
      if (paintLabel) {
        ctx.font = `600 14px ${SANS}`;
        ctx.fillStyle = '#A3A9B3';
        ctx.fillText(paintLabel, PAD + tileW + 16, y + 38);
      }
      ctx.textBaseline = 'top';
    }
    y += 66;

    // 部位行
    card.rows.forEach((row) => {
      const laid = layoutGroups(
        ctx,
        [{ runnerId: card.runnerId, segments: row.segments }],
        runnerMap,
        PAD + ROW_LABEL_W,
        y,
        contentW - ROW_LABEL_W,
        true
      );
      if (draw) {
        ctx.fillStyle = '#151820';
        roundRect(ctx, PAD, y + 2, 36, 36, 8);
        ctx.fill();
        drawIcon(ctx, REGION_ICON_PATHS[row.category] ?? REGION_ICON_PATHS.other, PAD + 6, y + 8, 24, '#E8EAEE');
        ctx.textBaseline = 'middle';
        ctx.font = `800 18px ${SANS}`;
        ctx.fillStyle = '#FFFFFF';
        const label = wrapLines(ctx, row.regionTitle, ROW_LABEL_W - 100)[0] ?? row.regionTitle;
        ctx.fillText(label, PAD + 46, y + CELL_H / 2 + 1);
        const lw = ctx.measureText(label).width;
        ctx.font = `600 14px ${MONO}`;
        ctx.fillStyle = '#6B717C';
        ctx.fillText(String(row.partCount), PAD + 46 + lw + 8, y + CELL_H / 2 + 2);
        ctx.textBaseline = 'top';
        drawCells(ctx, laid.cells, laid.runs);
      }
      y += Math.max(CELL_H, laid.height) + 12;
    });

    if (card.unusedNumbers.length) {
      if (draw) {
        ctx.font = `600 14px ${SANS}`;
        ctx.fillStyle = '#5B616B';
        const text = `板上未用号：${compressNumbers(card.unusedNumbers)}（可留板 / 废件 / 备用）`;
        ctx.fillText(wrapLines(ctx, text, contentW)[0] ?? text, PAD, y + 2);
      }
      y += 28;
    }

    y += 14;
    if (idx < cards.length - 1) {
      if (draw) {
        ctx.fillStyle = '#15171E';
        ctx.fillRect(PAD, y, contentW, 1);
      }
      y += 24;
    }
  });
  return y;
};

export async function renderChecklistPoster(opts: PosterOptions): Promise<HTMLCanvasElement> {
  const W = opts.columns === 2 ? WIDE_W : DEFAULT_W;
  const cover = await loadImage(opts.coverSrc);
  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d');
  if (!mctx) throw new Error('Canvas 2D not available');
  const height = paint(mctx, opts, cover, false);

  const desired = opts.pixelRatio ?? 2;
  const ratio = Math.max(0.5, Math.min(desired, Math.sqrt(MAX_CANVAS_AREA / (W * height))));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D not available');
  ctx.scale(ratio, ratio);
  paint(ctx, opts, cover, true);
  return canvas;
}

export async function downloadChecklistPoster(opts: PosterOptions, filename: string): Promise<void> {
  const canvas = await renderChecklistPoster(opts);
  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const safeName = filename.replace(/[\\/:*?"<>|]/g, '_');
  if (!blob) {
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = safeName;
    link.click();
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
