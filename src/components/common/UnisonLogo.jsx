import React from 'react';

export const UnisonLogo = ({ size = 'md', showText = true, className = '', useImage = true }) => {
  const sizeMap = {
    sm: { img: 'h-7 w-7', textTitle: 'text-[11px]', textSub: 'text-[8px]' },
    md: { img: 'h-9 w-9', textTitle: 'text-xs', textSub: 'text-[9px]' },
    lg: { img: 'h-12 w-12', textTitle: 'text-sm', textSub: 'text-[10px]' },
    xl: { img: 'h-16 w-16', textTitle: 'text-base', textSub: 'text-xs' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Nut & Bolt Interlocking Logo Icon */}
      <div className={`${currentSize.img} rounded-xl bg-slate-900 border border-slate-700/80 p-1 flex items-center justify-center shadow-lg shadow-blue-950/40 overflow-hidden shrink-0`}>
        {useImage ? (
          <img
            src="/unison_logo.png"
            alt="PT Unison Industrial Indonesia"
            className="w-full h-full object-contain rounded-lg"
          />
        ) : (
          <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            {/* Hex Nut */}
            <path
              d="M14 6L24 6L29 15L24 24L14 24L9 15L14 6Z"
              stroke="#38bdf8"
              strokeWidth="2.5"
              fill="#0f172a"
            />
            <circle cx="19" cy="15" r="4.5" stroke="#38bdf8" strokeWidth="2" fill="#0284c7" />
            {/* Bolt Stem */}
            <rect x="25" y="16" width="6" height="15" rx="1.5" fill="#94a3b8" />
            <path d="M25 19H31M25 22H31M25 25H31M25 28H31" stroke="#475569" strokeWidth="1.2" />
            {/* Bolt Head */}
            <path d="M23 31H33L31 35H25L23 31Z" fill="#cbd5e1" />
          </svg>
        )}
      </div>

      {showText && (
        <div className="flex flex-col leading-tight">
          <div className={`font-black text-slate-100 tracking-tight flex items-center gap-1.5 ${currentSize.textTitle}`}>
            PT UNISON INDUSTRIAL
            <span className="text-blue-400 font-extrabold">INDONESIA</span>
          </div>
          <div className={`font-mono text-slate-400 uppercase tracking-wider ${currentSize.textSub}`}>
            FASTENER MANUFACTURING • MUR & BAUT
          </div>
        </div>
      )}
    </div>
  );
};
