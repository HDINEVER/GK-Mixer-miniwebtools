import React, { useCallback, useRef, useState } from 'react';

// Use global anime instance from CDN
declare var anime: any;

interface DropZoneProps {
  onImageLoaded: (file: File, img: HTMLImageElement) => void;
  label?: string;
}

const DropZone: React.FC<DropZoneProps> = ({ onImageLoaded, label = "DRAG & DROP IMAGE" }) => {
  const [isDragging, setIsDragging] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const borderRef = useRef<HTMLDivElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    
    // Anime.js effect
    if (borderRef.current && typeof anime !== 'undefined') {
        anime({
            targets: borderRef.current,
            scale: [1, 1.02],
            duration: 400,
            easing: 'easeOutElastic(1, .8)'
        });
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (borderRef.current && typeof anime !== 'undefined') {
      anime({
        targets: borderRef.current,
        scale: 1,
        duration: 300,
        easing: 'easeOutQuad'
      });
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  }, [onImageLoaded]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        onImageLoaded(file, img);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div 
      className="relative w-full mb-6 group cursor-pointer"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => document.getElementById('fileInput')?.click()}
    >
        <input 
            type="file" 
            id="fileInput" 
            className="hidden" 
            accept="image/*"
            onChange={handleFileInput}
        />
      
      <div 
        ref={borderRef}
        className={`
          w-full h-64 rounded-xl border-2 border-dashed transition-colors duration-300 flex flex-col items-center justify-center
          ${isDragging ? 'border-macaron-blue bg-macaron-blue/10 dark:bg-macaron-blue/5' : 'border-macaron-gray dark:border-slate-600 hover:border-macaron-purple'}
        `}
      >
        <div className="text-5xl text-macaron-purple mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16">
            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
        </div>
        <p className="font-mono text-slate-500 dark:text-slate-400 text-sm">{label}</p>
        <p className="font-mono text-xs text-slate-400 dark:text-slate-500 mt-2">[JPG, PNG]</p>
      </div>
    </div>
  );
};

export default DropZone;