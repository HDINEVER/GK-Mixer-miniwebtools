import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  PlusIcon,
  ArrowClockwiseIcon,
  HashIcon,
  WarningIcon,
  XIcon,
  ArrowElbowDownLeftIcon,
  HandPointingIcon,
} from '@phosphor-icons/react';
import { ColorData, Language } from '../types';
import { getContrastColor, hexToRgb, rgbToCmyk, rgbToHsb, rgbToLab, generateId } from '../utils/colorUtils';
import { isInGamut, getColorSpaceName } from '../utils/colorSpaceConverter';

// Use global anime instance from CDN
declare var anime: any;

interface ColorPaletteProps {
  colors: ColorData[];
  onColorSelect: (color: ColorData) => void;
  selectedColorId?: string;
  onAddManual: () => void;
  onContinuousPick: () => void;
  onDeleteColor: (colorId: string) => void;
  onAddColorByHex?: (hex: string) => void; // New: Add color by hex input
  hasImage?: boolean;
  isPicking?: boolean;
  isContinuousPicking?: boolean;
  lang?: Language;
}

const ColorPalette: React.FC<ColorPaletteProps> = ({ colors, onColorSelect, selectedColorId, onAddManual, onContinuousPick, onDeleteColor, onAddColorByHex, hasImage = false, isPicking = false, isContinuousPicking = false, lang = 'en' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectionIndicatorRef = useRef<HTMLDivElement>(null);
  
  // Hex input state
  const [hexInput, setHexInput] = useState('');
  const [isHexInputValid, setIsHexInputValid] = useState(false);
  const [showHexInput, setShowHexInput] = useState(false);
  const [previewColor, setPreviewColor] = useState<string | null>(null);

  // Validate hex input
  const validateHex = useCallback((hex: string): boolean => {
    const cleanHex = hex.replace('#', '');
    return /^[A-Fa-f0-9]{6}$/.test(cleanHex);
  }, []);

  // Handle hex input change
  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.toUpperCase();
    // Auto-add # if not present
    if (value && !value.startsWith('#')) {
      value = '#' + value;
    }
    setHexInput(value);
    const isValid = validateHex(value);
    setIsHexInputValid(isValid);
    setPreviewColor(isValid ? value : null);
  };

  // Handle add color by hex
  const handleAddHexColor = () => {
    if (!isHexInputValid || !hexInput) return;
    
    const formattedHex = '#' + hexInput.replace('#', '').toUpperCase();
    
    if (onAddColorByHex) {
      onAddColorByHex(formattedHex);
    }
    
    // Reset input and close
    setHexInput('');
    setIsHexInputValid(false);
    setPreviewColor(null);
    setShowHexInput(false);
    
    // Play success animation
    const animeInstance = typeof anime === 'undefined' ? null : anime;
    if (animeInstance) {
      animeInstance({
        targets: '.hex-input-container',
        scale: [1.05, 1],
        duration: 300,
        easing: 'easeOutElastic(1, .6)'
      });
    }
  };

  // Handle key press for enter
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && isHexInputValid) {
      handleAddHexColor();
    }
    if (e.key === 'Escape') {
      setShowHexInput(false);
      setHexInput('');
      setPreviewColor(null);
    }
  };

  // Clean and snappy delete animation
  const handleDeleteWithAnimation = useCallback((colorId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    const target = (event.currentTarget as HTMLElement).closest('.color-card') as HTMLElement;
    if (!target) {
      onDeleteColor(colorId);
      return;
    }

    const animeInstance = typeof anime === 'undefined' ? null : anime;
    if (animeInstance) {
      animeInstance({
        targets: target,
        scale: [1, 0.75],
        opacity: [1, 0],
        duration: 180,
        easing: 'easeOutCubic',
        complete: () => {
          onDeleteColor(colorId);
        }
      });
    } else {
      target.style.transition = 'all 180ms cubic-bezier(0.16, 1, 0.3, 1)';
      target.style.opacity = '0';
      target.style.transform = 'scale(0.75)';
      setTimeout(() => onDeleteColor(colorId), 180);
    }
  }, [onDeleteColor]);

  useEffect(() => {
    if (!containerRef.current) return;
    const animeInstance = typeof anime === 'undefined' ? null : anime;
    if (!animeInstance) return;
    animeInstance({
      targets: containerRef.current.children,
      translateY: [20, 0],
      opacity: [0, 1],
      delay: animeInstance.stagger(40),
      duration: 300,
      easing: 'easeOutExpo'
    });
  }, [colors.length]); // Re-animate if list changes significantly

  // Animate selection indicator when selected color changes
  useEffect(() => {
    if (!selectionIndicatorRef.current) return;
    const animeInstance = typeof anime === 'undefined' ? null : anime;
    if (!animeInstance) return;
    animeInstance({
      targets: selectionIndicatorRef.current,
      scale: [0.3, 1],
      opacity: [0, 1],
      rotate: [-180, 0],
      duration: 500,
      easing: 'easeOutElastic(1, .6)'
    });
  }, [selectedColorId]);

  // Translations
  const t = {
    manualPick: lang === 'zh' ? '手动拾取' : lang === 'ja' ? '手動選択' : 'MANUAL PICK',
    continuous: lang === 'zh' ? '连续取色' : lang === 'ja' ? '連続選択' : 'CONTINUOUS',
    hexInput: lang === 'zh' ? 'HEX输入' : lang === 'ja' ? 'HEX入力' : 'HEX INPUT',
    addColor: lang === 'zh' ? '添加' : lang === 'ja' ? '追加' : 'ADD',
    hexPlaceholder: lang === 'zh' ? '输入颜色代码 如: FF5733' : lang === 'ja' ? 'カラーコード例: FF5733' : 'Enter hex e.g. FF5733',
    uploadFirst: lang === 'zh' ? '请先上传图片' : lang === 'ja' ? '画像をアップロード' : 'Please upload an image first',
    clickToPick: lang === 'zh' ? '点击图片取色' : lang === 'ja' ? '画像をクリック' : 'Click to pick color from image',
    pressEnter: lang === 'zh' ? '按回车添加' : lang === 'ja' ? 'Enterで追加' : 'Press Enter to add',
    invalidHex: lang === 'zh' ? '无效的颜色代码' : lang === 'ja' ? '無効なコード' : 'Invalid hex code',
    deleteColor: lang === 'zh' ? '删除颜色' : lang === 'ja' ? '色を削除' : 'Delete color'
  };

  return (
    <div className="w-full relative">
      
      <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
        <h3 className="text-xs sm:text-sm font-bold text-macaron-blue tracking-wider">DETECTED PALETTE</h3>
        <div className="flex gap-2 flex-wrap">
          {/* HEX Input Toggle Button */}
          <button 
              onClick={() => setShowHexInput(!showHexInput)}
              className={`flex items-center gap-1 text-[10px] sm:text-xs px-2 sm:px-3 py-1 border rounded-full transition-all whitespace-nowrap ${
                showHexInput
                  ? 'border-macaron-purple bg-macaron-purple text-white cursor-pointer shadow-lg'
                  : 'border-macaron-purple text-macaron-purple hover:bg-macaron-purple hover:text-white cursor-pointer'
              }`}
              title={t.hexInput}
          >
              <HashIcon className="w-3 h-3" />
              <span>{t.hexInput}</span>
          </button>
          <button 
              data-pick-control="true"
              onClick={onAddManual}
              disabled={!hasImage}
              className={`flex items-center gap-1 text-[10px] sm:text-xs px-2 sm:px-3 py-1 border rounded-full transition-colors whitespace-nowrap ${
                hasImage 
                  ? isPicking && !isContinuousPicking
                    ? 'border-macaron-green bg-macaron-green text-white cursor-pointer'
                    : 'border-macaron-green text-macaron-green hover:bg-macaron-green hover:text-white cursor-pointer'
                  : 'border-slate-300 text-slate-300 cursor-not-allowed opacity-50'
              }`}
              title={hasImage ? t.clickToPick : t.uploadFirst}
          >
              <PlusIcon className="w-3 h-3" />
              <span>{t.manualPick}</span>
          </button>
          <button 
              data-pick-control="true"
              onClick={onContinuousPick}
              disabled={!hasImage}
              className={`flex items-center gap-1 text-[10px] sm:text-xs px-2 sm:px-3 py-1 border rounded-full transition-colors whitespace-nowrap ${
                hasImage 
                  ? isContinuousPicking
                    ? 'border-macaron-blue bg-macaron-blue text-white cursor-pointer'
                    : 'border-macaron-blue text-macaron-blue hover:bg-macaron-blue hover:text-white cursor-pointer'
                  : 'border-slate-300 text-slate-300 cursor-not-allowed opacity-50'
              }`}
              title={hasImage ? t.continuous : t.uploadFirst}
          >
              <ArrowClockwiseIcon className="w-3 h-3" />
              <span>{t.continuous}</span>
          </button>
        </div>
      </div>

      {/* HEX Input Panel */}
      {showHexInput && (
        <div className="hex-input-container mb-4 p-3 sm:p-4 bg-gradient-to-r from-slate-50 to-purple-50 dark:from-slate-800 dark:to-purple-900/30 rounded-xl border border-purple-200 dark:border-purple-700 shadow-lg animate-in slide-in-from-top duration-300">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            {/* Color Preview */}
            <div 
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg border-2 border-white shadow-md transition-all duration-300 flex-shrink-0 self-center"
              style={{ 
                backgroundColor: previewColor || '#E2E8F0',
                boxShadow: previewColor ? `0 4px 20px ${previewColor}40` : 'none'
              }}
            >
              {!previewColor && (
                <div className="w-full h-full flex items-center justify-center text-slate-400 text-lg">
                  #
                </div>
              )}
            </div>
            
            {/* Input Field */}
            <div className="flex-1 relative">
              <input
                type="text"
                value={hexInput}
                onChange={handleHexInputChange}
                onKeyDown={handleKeyPress}
                placeholder={t.hexPlaceholder}
                maxLength={7}
                className={`w-full px-3 py-2 sm:py-2.5 rounded-lg border-2 font-mono text-sm sm:text-base uppercase transition-all duration-300 outline-none
                  ${isHexInputValid 
                    ? 'border-macaron-green bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' 
                    : hexInput && !isHexInputValid
                      ? 'border-red-300 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300'
                      : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                  }
                  focus:ring-2 focus:ring-macaron-purple/30
                `}
              />
              {hexInput && !isHexInputValid && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-red-500">
                  {t.invalidHex}
                </span>
              )}
              {isHexInputValid && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-green-500 flex items-center gap-0.5">
                  {t.pressEnter} <ArrowElbowDownLeftIcon className="w-3 h-3" />
                </span>
              )}
            </div>
            
            {/* Add Button */}
            <button
              onClick={handleAddHexColor}
              disabled={!isHexInputValid}
              className={`px-4 py-2 sm:py-2.5 rounded-lg font-bold text-sm transition-all duration-300 flex items-center gap-1.5 justify-center ${
                isHexInputValid
                  ? 'bg-gradient-to-r from-macaron-purple to-macaron-blue text-white hover:shadow-lg hover:scale-105 cursor-pointer'
                  : 'bg-slate-200 dark:bg-slate-600 text-slate-400 cursor-not-allowed'
              }`}
            >
              <PlusIcon className="w-4 h-4" weight="bold" />
              <span>{t.addColor}</span>
            </button>
          </div>
          
          {/* Quick Color Suggestions */}
          <div className="flex flex-wrap gap-2 mt-3">
            {['#FF5733', '#3498DB', '#2ECC71', '#9B59B6', '#F1C40F', '#1ABC9C', '#E74C3C', '#34495E'].map(quickHex => (
              <button
                key={quickHex}
                onClick={() => {
                  setHexInput(quickHex);
                  setIsHexInputValid(true);
                  setPreviewColor(quickHex);
                }}
                className="w-6 h-6 rounded-full border-2 border-white shadow-sm hover:scale-125 hover:shadow-lg transition-all duration-200"
                style={{ backgroundColor: quickHex }}
                title={quickHex}
              />
            ))}
          </div>
        </div>
      )}
      
      {colors.length === 0 ? (
        <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs sm:text-sm">
          {showHexInput ? (
            <p className="flex items-center justify-center gap-1"><HandPointingIcon className="w-4 h-4" />{lang === 'zh' ? '输入 HEX 颜色代码添加颜色' : lang === 'ja' ? 'HEXコードを入力して色を追加' : 'Enter a HEX code above to add a color'}</p>
          ) : hasImage ? (
            <p className="flex items-center justify-center gap-1"><HandPointingIcon className="w-4 h-4" />{lang === 'zh' ? '点击"手动拾取"从图片中选择颜色' : lang === 'ja' ? '「手動選択」をクリックして画像から色を選択' : 'Click "MANUAL PICK" to select colors from the image'}</p>
          ) : (
            <p>{lang === 'zh' ? '暂无颜色，上传图片或输入HEX代码' : lang === 'ja' ? '色がありません。画像をアップロードまたはHEXコードを入力' : 'No colors detected. Upload an image or enter HEX code.'}</p>
          )}
        </div>
      ) : (
        <div ref={containerRef} className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 md:gap-4">
        {colors.map((c) => (
          <div 
            key={c.id}
            onClick={() => onColorSelect(c)}
            className={`
              color-card relative p-2 sm:p-3 rounded-lg border-2 cursor-pointer transition-all duration-150 group
              ${selectedColorId === c.id ? 'shadow-md transform -translate-y-1' : 'border-slate-100 dark:border-slate-700 hover:border-macaron-pink'}
            `}
            style={selectedColorId === c.id ? { borderColor: c.hex, boxShadow: `0 4px 12px -2px ${c.hex}40` } : undefined}
          >
            <div 
              className="w-full h-12 sm:h-16 rounded-md mb-2 shadow-inner" 
              style={{ backgroundColor: c.hex }}
            />
            <div className="flex justify-between items-end relative">
                <div className="min-w-0 flex-1">
                    <p className="font-mono text-[10px] sm:text-xs text-slate-600 dark:text-slate-300 font-bold truncate">{c.hex}</p>
                    <p className="font-mono text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500">
                        C{c.cmyk.c} M{c.cmyk.m} Y{c.cmyk.y} K{c.cmyk.k}
                    </p>
                    {/* Color Space Badge & Gamut Warning */}
                    {c.colorSpace && c.colorSpace !== 'srgb' && (
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[8px] bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-1 rounded">
                          {getColorSpaceName(c.colorSpace, 'en')}
                        </span>
                        {!isInGamut(c.rgb, c.colorSpace) && (
                          <span className="inline-flex text-amber-600 dark:text-amber-400" title="Out of gamut"><WarningIcon className="w-3 h-3" /></span>
                        )}
                      </div>
                    )}
                </div>
                <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                    {c.source === 'auto' ? (
                        <span className="text-[9px] sm:text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-300 px-1 rounded">AUTO</span>
                    ) : (
                        <span className="text-[9px] sm:text-[10px] bg-macaron-yellow dark:bg-yellow-700 text-slate-600 dark:text-yellow-200 px-1 rounded">USR</span>
                    )}
                    
                    {/* Selection Indicator - Inside Info Area */}
                    {selectedColorId === c.id && (
                        <div 
                          ref={selectionIndicatorRef}
                          className="w-4 h-4 rounded-full bg-gradient-to-br from-macaron-pink to-macaron-blue border border-white dark:border-slate-600 shadow-md flex items-center justify-center flex-shrink-0"
                        >
                            <div className="w-2 h-2 bg-white rounded-full" />
                        </div>
                    )}
                </div>
            </div>
            
            {/* Concise Delete Button */}
            <button
              type="button"
              onClick={(e) => handleDeleteWithAnimation(c.id, e)}
              className="absolute top-2 right-2 w-7 h-7 sm:w-6 sm:h-6 rounded-full bg-white/95 dark:bg-slate-700/95 border border-slate-200/80 dark:border-slate-600/80 text-slate-400 hover:text-red-500 hover:border-red-400 hover:bg-red-50 dark:hover:text-red-400 dark:hover:border-red-400 dark:hover:bg-red-900/30 flex items-center justify-center opacity-85 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-150 active:scale-90 shadow-xs cursor-pointer z-10"
              title={t.deleteColor}
              aria-label={t.deleteColor}
            >
              <XIcon className="w-3.5 h-3.5" weight="bold" />
            </button>
          </div>
        ))}
        </div>
      )}
    </div>
  );
};

export default ColorPalette;