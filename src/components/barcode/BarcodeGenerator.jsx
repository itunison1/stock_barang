import React from 'react';

/**
 * Pure SVG Barcode component that generates clean 1D barcode stripes
 * based on input string (Code128 style visual) with human-readable numbers.
 */
export const BarcodeGenerator = ({
  value = '8991001001001',
  width = 240,
  height = 68,
  showText = true,
  status = 'active',
  className = '',
}) => {
  // Generate deterministic pseudo-random barcode line widths based on string characters
  const generateStripePattern = (str) => {
    let pattern = [2, 1, 1, 2, 3, 1]; // Start marker
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      const w1 = (code % 3) + 1;
      const s1 = ((code >> 1) % 2) + 1;
      const w2 = ((code >> 2) % 3) + 1;
      const s2 = ((code >> 3) % 2) + 1;
      pattern.push(w1, s1, w2, s2);
    }
    pattern.push(3, 1, 1, 1, 2, 3); // Stop marker
    return pattern;
  };

  const stripes = generateStripePattern(value || '0000000000000');
  const totalUnits = stripes.reduce((acc, cur) => acc + cur, 0);
  const unitWidth = (width - 16) / totalUnits;

  let currentX = 8;
  const rects = [];

  stripes.forEach((unit, index) => {
    const isBar = index % 2 === 0;
    const barW = unit * unitWidth;
    if (isBar) {
      rects.push(
        <rect
          key={index}
          x={currentX}
          y={4}
          width={barW}
          height={height - (showText ? 20 : 8)}
          fill="#111827"
        />
      );
    }
    currentX += barW;
  });

  return (
    <div className={`inline-flex flex-col items-center bg-white p-2 rounded border border-slate-300 shadow-sm ${className}`}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-hidden"
      >
        {rects}
      </svg>
      {showText && (
        <div className="flex items-center justify-between w-full px-2 mt-1">
          <span className="font-mono text-[11px] font-bold text-slate-800 tracking-wider">
            {value}
          </span>
          {status === 'pending' && (
            <span className="text-[9px] font-mono font-extrabold uppercase px-1 rounded bg-amber-100 text-amber-900 border border-amber-300">
              DRAFT PENDING
            </span>
          )}
          {status === 'active' && (
            <span className="text-[9px] font-mono font-bold uppercase px-1 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
              ACTIVE
            </span>
          )}
        </div>
      )}
    </div>
  );
};
