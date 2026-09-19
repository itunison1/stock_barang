import React from 'react';
import { Icon } from './Icons';

export const Header = ({ viewMode, setViewMode, onOpenBlueprintModal }) => {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-emerald-500 flex items-center justify-center font-black text-xs text-white tracking-widest shadow-lg shadow-blue-950">
            WMS
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-100 tracking-tight flex items-center gap-1.5">
                STOCK OPNAME
                <span className="text-blue-400 font-extrabold">MODE A</span>
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                PROPOSAL APPROVAL
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Operator Draft → Direct Print (9100) → Supervisor Approval Gate
            </p>
          </div>
        </div>

        {/* View Mode Switcher Pills */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex items-center gap-1 text-xs font-mono">
            <button
              onClick={() => setViewMode('dual')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                viewMode === 'dual'
                  ? 'bg-blue-600 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Tampilkan HP Operator dan Web Dashboard berdampingan"
            >
              <Icon name="layers" size={14} />
              <span className="hidden md:inline">Dual View (Side-by-Side)</span>
              <span className="md:hidden">Dual</span>
            </button>

            <button
              onClick={() => setViewMode('mobile')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                viewMode === 'mobile'
                  ? 'bg-blue-600 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Hanya HP Android Operator"
            >
              <Icon name="smartphone" size={14} />
              <span className="hidden md:inline">HP Operator</span>
              <span className="md:hidden">HP</span>
            </button>

            <button
              onClick={() => setViewMode('dashboard')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                viewMode === 'dashboard'
                  ? 'bg-blue-600 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Hanya Web Dashboard Supervisor"
            >
              <Icon name="desktop" size={14} />
              <span className="hidden md:inline">Web Dashboard</span>
              <span className="md:hidden">Web</span>
            </button>
          </div>

          {/* Blueprint Guide Button */}
          <button
            onClick={onOpenBlueprintModal}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono transition-colors"
          >
            <Icon name="terminal" size={14} className="text-amber-400" />
            <span>Alur Blueprint 8 Langkah</span>
          </button>
        </div>
      </div>
    </header>
  );
};
