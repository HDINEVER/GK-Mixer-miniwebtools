import React, { useEffect, useState } from "react";
import {
  CatalogPaint,
  Language,
  PaintProject,
  PartCanvas,
} from "../types";
import {
  loadBottle,
  loadImage,
  renderAnnotatedCanvas,
  saveOrExportImage,
  shareExportedImage,
} from "../utils/exportAnnotatedImage";
import { floatingNodesToColors } from "../utils/projectStore";
import { encodeQRPayloadString, parseStepParams } from "../utils/projectSharing";
import { embedPayloadInPngDataUrl, renderQRCodeToDataUrl } from "../utils/qrCode";
import { localizedBrand } from "../utils/paintCatalog";
import { SwatchSettings } from "../utils/swatchLayout";
import {
  XIcon,
  DownloadSimpleIcon,
  ShareNetworkIcon,
  QrCodeIcon,
  CopyIcon,
  CheckIcon,
} from "@phosphor-icons/react";

interface ProjectSharePosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: PaintProject;
  part: PartCanvas;
  catalogPaints: CatalogPaint[];
  swatchSettings: SwatchSettings;
  lang: Language;
}

export const ProjectSharePosterModal: React.FC<ProjectSharePosterModalProps> = ({
  isOpen,
  onClose,
  project,
  part,
  catalogPaints,
  swatchSettings,
  lang,
}) => {
  const [posterDataUrl, setPosterDataUrl] = useState<string>("");
  const [qrPayloadStr, setQrPayloadStr] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !part) return;
    let cancelled = false;

    const buildPoster = async () => {
      setIsGenerating(true);
      try {
        // 1. Load source image and render 1:1 annotated upper canvas (zero black bars)
        const srcImg = await loadImage(part.sourceImageDataUrl, false);
        const colors = floatingNodesToColors(part.nodes, catalogPaints);
        const markers = colors.map((c) => ({
          id: c.id,
          nx: c.sampleX ?? 0.5,
          ny: c.sampleY ?? 0.5,
          hex: c.hex,
          paint: c.assignedPaint,
          labelNx: c.labelNx,
          labelNy: c.labelNy,
          labelScale: c.labelScale,
          tonalGradient: c.tonalGradient,
        }));

        const exportWidth = 1080;
        let canvasAreaHeight = 720;
        let upperCanvas: HTMLCanvasElement | null = null;

        if (srcImg && srcImg.naturalWidth > 0 && srcImg.naturalHeight > 0) {
          const aspectRatio = srcImg.naturalHeight / srcImg.naturalWidth;
          canvasAreaHeight = Math.max(1, Math.round(exportWidth * aspectRatio));
          upperCanvas = await renderAnnotatedCanvas(
            srcImg,
            markers,
            swatchSettings,
            false,
            exportWidth
          );
        }

        // Strict 2-column Footer layout metrics (2x retina scale of 540px standard poster)
        const padX = 48; // 24px @ 1x
        const padY = 56; // 28px @ 1x
        const colGap = 48; // 24px @ 1x safety gap between Left Column and Right Column
        const rightColW = 292; // 146px @ 1x fixed QR & Brand column width
        const rightColX = exportWidth - padX - rightColW;
        const leftColX = padX;
        // Left column strictly isolated: max-width = calc(100% - 170px) @ 1x
        const leftColW = exportWidth - padX * 2 - rightColW - colGap;

        // Pre-measure Left Column heights (Header + Assigned Paints + Multi-row Workflow Pipeline)
        const measureCanvas = document.createElement("canvas");
        const measureCtx = measureCanvas.getContext("2d");

        const headerBlockH = 76;
        const sectionGap = 24;
        const paintGridGap = 20; // 10px @ 1x
        const paintCardH = 52;
        const paintRowGap = 14;
        const paintColW = Math.floor((leftColW - paintGridGap) / 2);
        const paintRows = Math.max(1, Math.ceil(part.nodes.length / 2));
        const paintsHeaderH = 26;
        const paintsGridH =
          paintRows * paintCardH + Math.max(0, paintRows - 1) * paintRowGap;
        const paintsSectionH = paintsHeaderH + paintsGridH;

        const pillFont =
          "bold 14px ui-sans-serif, system-ui, -apple-system, sans-serif";
        if (measureCtx) {
          measureCtx.font = pillFont;
        }
        const pillH = 38;
        const pillGap = 16; // 8px @ 1x
        const pillPadX = 14;

        interface PositionedStepPill {
          x: number;
          y: number;
          w: number;
          h: number;
          stepNumText: string;
          stepBodyText: string;
          numW: number;
        }

        const positionedPills: PositionedStepPill[] = [];
        let stepsSectionH = 0;

        if (part.steps.length > 0) {
          const stepsHeaderH = 26;
          let curPillX = leftColX;
          let curPillY = 0;

          part.steps.forEach((step, idx) => {
            const { ratio, pressure, nozzle } = parseStepParams(
              step.ratioAndPressure,
              step.nozzle
            );
            const paramList = [nozzle, ratio, pressure].filter(Boolean).join("·");
            const stepNumText = `${idx + 1}. `;
            const stepBodyText = paramList
              ? `${step.actionText} (${paramList})`
              : step.actionText;

            const numW = measureCtx
              ? Math.ceil(measureCtx.measureText(stepNumText).width)
              : stepNumText.length * 9;
            const bodyW = measureCtx
              ? Math.ceil(measureCtx.measureText(stepBodyText).width)
              : stepBodyText.length * 14;

            const naturalPillW = numW + bodyW + pillPadX * 2;
            const pillW = Math.min(leftColW, naturalPillW);

            // Force wrap to next line when reaching Left Column right boundary
            if (curPillX > leftColX && curPillX + pillW > leftColX + leftColW) {
              curPillX = leftColX;
              curPillY += pillH + pillGap;
            }

            positionedPills.push({
              x: curPillX,
              y: curPillY,
              w: pillW,
              h: pillH,
              stepNumText,
              stepBodyText,
              numW,
            });

            curPillX += pillW + pillGap;
          });

          const totalPillsH = curPillY + pillH;
          stepsSectionH = stepsHeaderH + totalPillsH;
        }

        const leftColContentH =
          headerBlockH +
          sectionGap +
          paintsSectionH +
          (part.steps.length > 0 ? sectionGap + stepsSectionH : 0);

        const brandBadgeH = 68;
        const rightColGap = 24; // 12px @ 1x
        const qrCardH = rightColW + 44;
        const rightColContentH = brandBadgeH + rightColGap + qrCardH;

        const lowerH = Math.max(leftColContentH, rightColContentH) + padY * 2;
        const totalH = canvasAreaHeight + lowerH;
        const cropRatioH = Math.round((canvasAreaHeight / totalH) * 1000) / 1000;

        // 2. Encode QR payload string with exact upper image crop ratio
        const payloadStr = await encodeQRPayloadString(project.title, part, [
          0,
          0,
          1,
          cropRatioH,
        ]);
        if (cancelled) return;
        setQrPayloadStr(payloadStr);

        const qrDataUrl = renderQRCodeToDataUrl(payloadStr, 280, 12, "M");
        const [qrImg, logoImg, ...bottleImgs] = await Promise.all([
          loadImage(qrDataUrl, false),
          loadImage("/app-logo.png", false),
          ...part.nodes.map((n) =>
            loadBottle({ brand: n.paintBrand, code: n.paintCode })
          ),
        ]);

        const canvas = document.createElement("canvas");
        canvas.width = exportWidth;
        canvas.height = totalH;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const fitTextWithEllipsis = (text: string, maxWidth: number): string => {
          if (ctx.measureText(text).width <= maxWidth) return text;
          let str = text;
          while (str.length > 1 && ctx.measureText(str + "…").width > maxWidth) {
            str = str.slice(0, -1);
          }
          return str + "…";
        };

        // Draw Upper Annotated Part Preview (1:1 aspect ratio, zero distortion)
        ctx.fillStyle = "#0C0C0E";
        ctx.fillRect(0, 0, exportWidth, canvasAreaHeight);
        if (upperCanvas) {
          ctx.drawImage(upperCanvas, 0, 0, exportWidth, canvasAreaHeight);
        }

        // Draw Lower Dark Charcoal Industrial Spec Sheet (#141417 -> #0C0C0E)
        const bgGrad = ctx.createLinearGradient(0, canvasAreaHeight, 0, totalH);
        bgGrad.addColorStop(0, "#141417");
        bgGrad.addColorStop(1, "#0C0C0E");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, canvasAreaHeight, exportWidth, lowerH);

        // Top subtle coral/metallic divider line
        const lineGrad = ctx.createLinearGradient(
          0,
          canvasAreaHeight,
          exportWidth,
          canvasAreaHeight
        );
        lineGrad.addColorStop(0, "#EF5350");
        lineGrad.addColorStop(0.5, "#6366F1");
        lineGrad.addColorStop(1, "#10B981");
        ctx.fillStyle = lineGrad;
        ctx.fillRect(0, canvasAreaHeight, exportWidth, 4);

        const footerTopY = canvasAreaHeight + padY;

        // ============================================================
        // LEFT COLUMN (Strictly constrained to [leftColX, leftColX + leftColW])
        // ============================================================
        let leftY = footerTopY;

        // 1. Project Title & Part Name Pill
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "900 32px ui-sans-serif, system-ui, -apple-system, sans-serif";
        ctx.fillText(
          fitTextWithEllipsis(project.title, leftColW),
          leftColX,
          leftY + 28
        );

        ctx.font = "bold 16px ui-sans-serif, system-ui, sans-serif";
        const rawPartLabel = `PART · ${part.partName}`;
        const fittedPartLabel = fitTextWithEllipsis(rawPartLabel, leftColW - 24);
        const partLabelW = Math.min(
          leftColW,
          Math.ceil(ctx.measureText(fittedPartLabel).width + 24)
        );
        ctx.fillStyle = "rgba(239, 83, 80, 0.16)";
        ctx.beginPath();
        ctx.roundRect(leftColX, leftY + 44, partLabelW, 32, 8);
        ctx.fill();
        ctx.strokeStyle = "rgba(239, 83, 80, 0.45)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.fillStyle = "#FF8575";
        ctx.fillText(fittedPartLabel, leftColX + 12, leftY + 65);

        leftY += headerBlockH + sectionGap;

        // 2. ASSIGNED PAINTS (2-column grid within leftColW)
        ctx.fillStyle = "#94A3B8";
        ctx.font = "bold 14px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.fillText(
          `ASSIGNED PAINTS (${part.nodes.length})`,
          leftColX,
          leftY + 14
        );

        const paintGridY = leftY + paintsHeaderH;
        part.nodes.forEach((node, idx) => {
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          const bx = leftColX + col * (paintColW + paintGridGap);
          const by = paintGridY + row * (paintCardH + paintRowGap);

          ctx.save();
          ctx.fillStyle = "rgba(255,255,255,0.055)";
          ctx.beginPath();
          ctx.roundRect(bx, by, paintColW, paintCardH, 10);
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.09)";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.clip();

          // 1:1 Square Bottle or Color Swatch
          const bottle = bottleImgs[idx];
          const thumbSize = 40;
          const thumbX = bx + 6;
          const thumbY = by + Math.round((paintCardH - thumbSize) / 2);
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(thumbX, thumbY, thumbSize, thumbSize, 8);
          ctx.clip();
          ctx.fillStyle = node.hex;
          ctx.fillRect(thumbX, thumbY, thumbSize, thumbSize);
          if (bottle) {
            ctx.fillStyle = "#F8FAFC";
            ctx.fillRect(thumbX, thumbY, thumbSize, thumbSize);
            const bAspect = bottle.width / bottle.height;
            let dW = thumbSize;
            let dH = thumbSize;
            if (bAspect > 1) dH = thumbSize / bAspect;
            else dW = thumbSize * bAspect;
            ctx.drawImage(
              bottle,
              thumbX + (thumbSize - dW) / 2,
              thumbY + (thumbSize - dH) / 2,
              dW,
              dH
            );
          }
          ctx.restore();

          // Brand + Code + Full Name
          const bName = localizedBrand(node.paintBrand, lang);
          ctx.fillStyle = "#F8FAFC";
          ctx.font = "bold 14px ui-sans-serif, system-ui, sans-serif";
          const titleLine = `${bName} ${node.paintCode} ${node.paintName}`;
          const maxTextW = paintColW - 108;
          ctx.fillText(
            fitTextWithEllipsis(titleLine, maxTextW),
            bx + 54,
            by + 23
          );

          ctx.fillStyle = "#94A3B8";
          ctx.font = "bold 11px ui-monospace, SFMono-Regular, Menlo, monospace";
          ctx.fillText(node.hex.toUpperCase(), bx + 54, by + 41);

          // Right color dot
          ctx.fillStyle = node.hex;
          ctx.beginPath();
          ctx.roundRect(bx + paintColW - 44, by + 15, 34, 22, 6);
          ctx.fill();
          ctx.restore();
        });

        leftY = paintGridY + paintsGridH;

        // 3. WORKFLOW PIPELINE (Multi-row auto-wrapping flex flow within leftColW)
        if (part.steps.length > 0) {
          leftY += sectionGap;
          ctx.fillStyle = "#94A3B8";
          ctx.font = "bold 14px ui-monospace, SFMono-Regular, Menlo, monospace";
          ctx.fillText("WORKFLOW PIPELINE", leftColX, leftY + 14);

          const pillsBaseY = leftY + 26;
          positionedPills.forEach((pill) => {
            const px = pill.x;
            const py = pillsBaseY + pill.y;

            ctx.save();
            // Deep slate pill background (bg-slate-800/90) + subtle indigo border (border-indigo-500/30)
            ctx.fillStyle = "rgba(30, 41, 59, 0.92)";
            ctx.beginPath();
            ctx.roundRect(px, py, pill.w, pill.h, 10);
            ctx.fill();
            ctx.strokeStyle = "rgba(99, 102, 241, 0.38)";
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.clip();

            ctx.font = pillFont;
            // Highlighted step index number
            ctx.fillStyle = "#818CF8";
            ctx.fillText(pill.stepNumText, px + pillPadX, py + 24);

            // Step action & normalized bar/psi parameters with ellipsis protection
            ctx.fillStyle = "#F1F5F9";
            const availBodyW = Math.max(
              10,
              pill.w - pillPadX * 2 - pill.numW
            );
            ctx.fillText(
              fitTextWithEllipsis(pill.stepBodyText, availBodyW),
              px + pillPadX + pill.numW,
              py + 24
            );
            ctx.restore();
          });
        }

        // ============================================================
        // RIGHT COLUMN (Strictly isolated at [rightColX, rightColX + rightColW])
        // ============================================================
        // 1. Top Brand Logo Badge
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.beginPath();
        ctx.roundRect(rightColX, footerTopY, rightColW, brandBadgeH, 16);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.lineWidth = 1;
        ctx.stroke();

        if (logoImg) {
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(rightColX + 14, footerTopY + 11, 46, 46, 11);
          ctx.clip();
          ctx.drawImage(logoImg, rightColX + 14, footerTopY + 11, 46, 46);
          ctx.restore();
        }
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "900 22px ui-sans-serif, system-ui, sans-serif";
        ctx.fillText("GKMixer", rightColX + 72, footerTopY + 34);
        ctx.fillStyle = "#94A3B8";
        ctx.font = "bold 11px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.fillText("PAINTING STUDIO", rightColX + 72, footerTopY + 52);

        // 2. Bottom White QR Code Card (Fixed width rightColW = 292px / 146px @ 1x)
        const qrCardY = footerTopY + brandBadgeH + rightColGap;
        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 8;
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.roundRect(rightColX, qrCardY, rightColW, qrCardH, 20);
        ctx.fill();
        ctx.restore();

        const qrPad = 20; // 10px @ 1x (p-2.5)
        const qrImgSize = rightColW - qrPad * 2;
        if (qrImg) {
          ctx.drawImage(
            qrImg,
            rightColX + qrPad,
            qrCardY + qrPad,
            qrImgSize,
            qrImgSize
          );
        }

        ctx.fillStyle = "#0F172A";
        ctx.font = "900 14px ui-sans-serif, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          "GKMixer 扫码还原工程",
          rightColX + rightColW / 2,
          qrCardY + rightColW + 18
        );
        ctx.textAlign = "left";

        const rawDataUrl = canvas.toDataURL("image/png");
        const withEmbeddedChunk = await embedPayloadInPngDataUrl(rawDataUrl, payloadStr);
        if (!cancelled) {
          setPosterDataUrl(withEmbeddedChunk);
        }
      } catch (err) {
        console.error("Failed to generate share poster:", err);
      } finally {
        if (!cancelled) setIsGenerating(false);
      }
    };

    buildPoster();
    return () => {
      cancelled = true;
    };
  }, [isOpen, project, part, catalogPaints, swatchSettings, lang]);

  if (!isOpen) return null;

  const handleDownloadPoster = async () => {
    if (!posterDataUrl) return;
    const filename = `GKMixer-${project.title}-${part.partName}.png`.replace(
      /[\\/:*?"<>|]/g,
      "_"
    );
    const link = document.createElement("a");
    link.href = posterDataUrl;
    link.download = filename;
    link.click();
  };

  const handleSharePoster = async () => {
    if (!posterDataUrl) return;
    const filename = `GKMixer-${project.title}-${part.partName}.png`.replace(
      /[\\/:*?"<>|]/g,
      "_"
    );
    const shared = await shareExportedImage(posterDataUrl, filename);
    if (!shared) {
      handleDownloadPoster();
    }
  };

  const handleCopyPayload = () => {
    if (!qrPayloadStr) return;
    navigator.clipboard?.writeText(qrPayloadStr);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-3 sm:p-5 animate-fadeIn">
      <div className="flex flex-col w-full max-w-2xl max-h-[92dvh] rounded-3xl bg-slate-900 border border-white/15 text-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <QrCodeIcon className="h-5 w-5 text-coral" weight="bold" />
            <div>
              <h3 className="text-sm font-black">涂装项目名片二维码海报</h3>
              <p className="text-[11px] text-slate-400">
                支持 iOS 与 Web 端跨平台扫码还原可二次编辑的悬浮色卡与工序
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Poster Preview */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col items-center bg-slate-950/60">
          {isGenerating ? (
            <div className="my-auto py-20 text-center space-y-2">
              <div className="h-8 w-8 mx-auto rounded-full border-2 border-coral border-t-transparent animate-spin" />
              <p className="text-xs text-slate-400 font-bold">
                正在合成高清涂装名片与 gkm1: 工程二维码…
              </p>
            </div>
          ) : posterDataUrl ? (
            <img
              src={posterDataUrl}
              alt="Project Share Poster"
              className="my-auto w-full max-w-[480px] h-auto block rounded-2xl border border-white/15 shadow-2xl object-contain"
            />
          ) : (
            <p className="my-auto text-xs text-rose-400">海报生成失败，请重试</p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-t border-white/10 bg-slate-900 shrink-0">
          <button
            type="button"
            onClick={handleCopyPayload}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/15 px-3 py-2 text-xs font-bold text-slate-200 transition cursor-pointer"
            title="复制 gkm1: 工程码字符串"
          >
            {copiedCode ? (
              <>
                <CheckIcon className="h-4 w-4 text-emerald-400" weight="bold" />
                <span className="text-emerald-400">已复制 gkm1 工程码</span>
              </>
            ) : (
              <>
                <CopyIcon className="h-4 w-4" />
                <span>复制 gkm1 工程码</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSharePoster}
              disabled={!posterDataUrl || isGenerating}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 px-3.5 py-2 text-xs font-bold text-white disabled:opacity-40 transition cursor-pointer"
            >
              <ShareNetworkIcon className="h-4 w-4" weight="bold" />
              <span>系统分享</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPoster}
              disabled={!posterDataUrl || isGenerating}
              className="inline-flex items-center gap-1.5 rounded-xl bg-coral hover:opacity-95 px-4 py-2 text-xs font-black text-white shadow-md disabled:opacity-40 transition cursor-pointer"
            >
              <DownloadSimpleIcon className="h-4 w-4" weight="bold" />
              <span>保存高清名片 PNG</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectSharePosterModal;
