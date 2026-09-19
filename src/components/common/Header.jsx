import React from 'react';
import { Icon } from './Icons';
import { UnisonLogo } from './UnisonLogo';
import { useWms } from '../../services/store';

export const Header = ({
  viewMode,
  setViewMode,
  onOpenBlueprintModal,
  onOpenDbConfigModal,
  onOpenExecutiveModal,
}) => {
  const { liveDbStatus } = useWms();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/85 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Company Branding & Logo */}
        <div className="flex items-center gap-3">
          <UnisonLogo size="md" />
          <div className="hidden xl:block h-6 w-px bg-slate-800" />
          <div className="hidden xl:flex items-center gap-2 text-[10px] font-mono text-slate-400">
            <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-900">
              WMS MODE A
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
              11 GUDANG
            </span>
            {liveDbStatus?.connected && (
              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                176K ITEM (usr_android)
              </span>
            )}
          </div>
        </div>

        {/* View Mode Switcher & Navigation */}
        <div className="flex items-center gap-2">
          {/* Rule & Alur Kerja Button */}
          <button
            onClick={onOpenExecutiveModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-500/50 bg-blue-950/40 hover:bg-blue-900/50 text-blue-300 text-xs font-mono font-bold transition-all shadow"
            title="Buka Panduan Rule & Alur Kerja Lengkap Sistem WMS (7 Bab)"
          >
            <Icon name="layers" size={14} className="text-blue-400" />
            <span className="hidden sm:inline">Rule & Alur Kerja</span>
            <span className="sm:hidden">Alur Kerja</span>
          </button>

          {/* Server Config Button */}
          <button
            onClick={onOpenDbConfigModal}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono transition-colors"
            title="Lihat Konfigurasi Database Server 192.168.1.159 / 1.140"
          >
            <span className={`h-2 w-2 rounded-full ${liveDbStatus?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-[11px]">DB 1.159</span>
          </button>

          {/* View Mode Pills */}
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
              <span className="hidden md:inline">Dual View</span>
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
            <span>Blueprint 8 Langkah</span>
          </button>
        </div>
      </div>
    </header>
  );
};
