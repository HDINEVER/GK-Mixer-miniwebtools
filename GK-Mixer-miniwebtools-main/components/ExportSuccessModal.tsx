import React, { useState } from 'react';
import {
  XIcon,
  CheckCircleIcon,
  DownloadSimpleIcon,
  ShareNetworkIcon,
  InfoIcon,
  CheckIcon,
} from '@phosphor-icons/react';
import { Language } from '../types';
import { ExportResult, shareExportedImage } from '../utils/exportAnnotatedImage';

interface ExportSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: ExportResult | null;
  lang: Language;
}

export const ExportSuccessModal: React.FC<ExportSuccessModalProps> = ({
  isOpen,
  onClose,
  result,
  lang,
}) => {
  const [isSharing, setIsSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  if (!isOpen || !result) return null;

  const handleShare = async () => {
    if (!result.dataUrl) return;
    setIsSharing(true);
    try {
      const ok = await shareExportedImage(result.dataUrl, result.filename);
      if (ok) {
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2500);
      }
    } finally {
      setIsSharing(false);
    }
  };

  const handleDownloadAgain = () => {
    try {
      const link = document.createElement('a');
      link.download = result.filename;
      link.href = result.dataUrl;
      link.click();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <CheckCircleIcon className="h-4 w-4" weight="fill" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                {lang === 'zh'
                  ? '色卡标注图已生成'
                  : lang === 'ja'
                  ? '色見本画像の書き出し完了'
                  : 'Swatch Export Complete'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {result.savedToGallery
                  ? (lang === 'zh'
                      ? '✓ 已自动保存到手机系统相册 (Pictures/GKMixer)'
                      : lang === 'ja'
                      ? '✓ 写真ライブラリ (Pictures/GKMixer) に保存しました'
                      : '✓ Saved to System Gallery (Pictures/GKMixer)')
                  : (lang === 'zh'
                      ? '✓ 已生成并触发下载'
                      : lang === 'ja'
                      ? '✓ ダウンロードを開始しました'
                      : '✓ Generated and downloaded')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <XIcon className="h-4 w-4" weight="bold" />
          </button>
        </div>

        {/* Content & Preview */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Status Badge */}
          {result.savedToGallery ? (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/60">
              <CheckIcon className="h-4 w-4 shrink-0 font-bold" />
              <span>
                {lang === 'zh'
                  ? '已成功保存到手机相册！可前往手机系统「相册/图库」直接查看。'
                  : lang === 'ja'
                  ? '写真ライブラリに保存しました。「写真」アプリで確認できます。'
                  : 'Successfully saved to device photos! Check your Gallery app.'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-sky-50 dark:bg-sky-950/40 px-3 py-2 text-xs font-medium text-sky-700 dark:text-sky-300 border border-sky-200/70 dark:border-sky-800/60">
              <DownloadSimpleIcon className="h-4 w-4 shrink-0 font-bold" />
              <span>
                {lang === 'zh'
                  ? '已触发浏览器下载，您也可以直接在下方预览或长按保存。'
                  : lang === 'ja'
                  ? 'ダウンロードを開始しました。画像長押しでも保存できます。'
                  : 'Download initiated. You can also long-press the image to save.'}
              </span>
            </div>
          )}

          {/* High-res Image Preview */}
          <div className="relative group max-h-[50vh] overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950/90 flex items-center justify-center p-1.5 shadow-inner">
            <img
              src={result.dataUrl}
              alt="Exported swatch visualizer"
              className="max-h-[48vh] w-auto max-w-full rounded object-contain"
            />
          </div>

          {/* Mobile tip */}
          <div className="flex items-start gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2.5 text-[11px] text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
            <InfoIcon className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" weight="fill" />
            <span>
              {lang === 'zh'
                ? '提示：在手机端也可长按上方图片，在系统弹出菜单中选择「存储图像 / 保存到相册」或发送给好友。'
                : lang === 'ja'
                ? 'ヒント：スマートフォンでは画像を長押しして「写真に保存」または共有できます。'
                : 'Tip: On mobile devices, long-press the preview image to save to photos or share.'}
            </span>
          </div>
        </div>

        {/* Action Footer */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 px-4 py-3">
          <button
            type="button"
            onClick={handleShare}
            disabled={isSharing}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-50"
          >
            <ShareNetworkIcon className="h-3.5 w-3.5" weight="bold" />
            <span>
              {shareSuccess
                ? (lang === 'zh' ? '已唤起分享' : 'Shared')
                : (lang === 'zh' ? '系统分享 / 发送' : lang === 'ja' ? '共有' : 'Share Image')}
            </span>
          </button>

          <button
            type="button"
            onClick={handleDownloadAgain}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95"
          >
            <DownloadSimpleIcon className="h-3.5 w-3.5" weight="bold" />
            <span>{lang === 'zh' ? '再次下载' : lang === 'ja' ? '再保存' : 'Download'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center rounded-lg bg-macaron-green px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:brightness-105 transition-all active:scale-95"
          >
            {lang === 'zh' ? '完成' : lang === 'ja' ? '完了' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
};
