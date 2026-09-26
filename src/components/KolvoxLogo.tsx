import React, { useState } from 'react';

interface KolvoxLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  onClick?: () => void;
}

export const KolvoxLogo: React.FC<KolvoxLogoProps> = ({
  className = '',
  size = 'md',
  showSubtitle = false,
  onClick,
}) => {
  const [imageError, setImageError] = useState(false);

  // Sizing definitions for the logo image (ampliado e com transparência total)
  const sizeMap = {
    xs: { h: 'h-10 sm:h-12', maxW: 'max-w-[180px]' },
    sm: { h: 'h-14 sm:h-16', maxW: 'max-w-[240px]' },
    md: { h: 'h-20 sm:h-24', maxW: 'max-w-[340px]' },
    lg: { h: 'h-28 sm:h-34', maxW: 'max-w-[460px]' },
    xl: { h: 'h-36 sm:h-48', maxW: 'max-w-[600px]' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  return (
    <div
      onClick={onClick}
      className={`inline-flex flex-col items-center justify-center select-none bg-transparent ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {!imageError ? (
        <img
          src="/kolvox-logo.png"
          alt="KOLVOX"
          onError={(e) => {
            if ((e.target as HTMLImageElement).src.endsWith('.png')) {
              (e.target as HTMLImageElement).src = '/kolvox-logo.svg';
            } else {
              setImageError(true);
            }
          }}
          className={`${currentSize.h} ${currentSize.maxW} w-auto object-contain transition-transform duration-200 hover:scale-[1.03] bg-transparent`}
        />
      ) : (
        <div className="font-orbitron font-black text-cyan-400 tracking-wider text-2xl drop-shadow-[0_0_10px_rgba(0,229,255,0.6)]">
          KOLVOX
        </div>
      )}

      {showSubtitle && (
        <span className="text-[10px] sm:text-[11px] tracking-[0.3em] text-[#00e5ff] uppercase font-mono mt-1 opacity-90 font-bold drop-shadow-[0_0_8px_#00e5ff]">
          Seu palco • Suas músicas • Sua voz
        </span>
      )}
    </div>
  );
};
