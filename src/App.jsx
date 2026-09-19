import React, { useState } from 'react';
import { WmsProvider } from './services/store';
import { Header } from './components/common/Header';
import { MobileTerminal } from './components/mobile/MobileTerminal';
import { SupervisorDashboard } from './components/dashboard/SupervisorDashboard';
import { ThermalLabelModal } from './components/thermal/ThermalLabelModal';
import { BlueprintModal } from './components/common/BlueprintModal';
import { DbConfigModal } from './components/common/DbConfigModal';
import { ExecutivePresentationModal } from './components/common/ExecutivePresentationModal';
import { LiveEventInspector } from './components/inspector/LiveEventInspector';

function AppContent() {
  const [viewMode, setViewMode] = useState('dual'); // 'dual' | 'mobile' | 'dashboard'
  const [isBlueprintModalOpen, setIsBlueprintModalOpen] = useState(false);
  const [isDbConfigModalOpen, setIsDbConfigModalOpen] = useState(false);
  const [isExecutiveModalOpen, setIsExecutiveModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-16">
      {/* App Header */}
      <Header
        viewMode={viewMode}
        setViewMode={setViewMode}
        onOpenBlueprintModal={() => setIsBlueprintModalOpen(true)}
        onOpenDbConfigModal={() => setIsDbConfigModalOpen(true)}
        onOpenExecutiveModal={() => setIsExecutiveModalOpen(true)}
      />

      {/* Main Workspace Area */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-3 sm:p-5 flex flex-col">
        {/* Helper Banner for PT Unison Fasteners & Mode A Workflow */}
        <div className="mb-4 p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/60 via-slate-900 to-amber-950/40 border border-blue-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-lg">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <div>
              <span className="font-bold text-slate-200 mr-2">
                PT UNISON INDUSTRIAL INDONESIA — WMS MODE A (FASTENERS / MUR & BAUT):
              </span>
              <span className="text-slate-400">
                11 Gudang • Direct Socket Print TCP:9100 • Database `produksi` (176.673 Item via usr_android)
              </span>
            </div>
          </div>
          <div className="flex items-center flex-wrap gap-2.5 shrink-0">
            <button
              onClick={() => setIsExecutiveModalOpen(true)}
              className="px-3 py-1 rounded-xl bg-gradient-to-r from-blue-600 to-amber-600 hover:from-blue-500 hover:to-amber-500 text-white font-bold text-[11px] shadow flex items-center gap-1.5 transition-all animate-pulse"
            >
              <span>⭐ Presentasi Direksi (7 Bab)</span>
            </button>
            <button
              onClick={() => setIsDbConfigModalOpen(true)}
              className="text-emerald-400 hover:text-emerald-300 font-mono text-[11px] underline"
            >
              DB Produksi 1.159 →
            </button>
            <button
              onClick={() => setIsBlueprintModalOpen(true)}
              className="text-blue-400 hover:text-blue-300 font-mono text-[11px] underline"
            >
              Blueprint 8 Langkah →
            </button>
          </div>
        </div>

        {/* Dynamic Dual / Single View Layout */}
        {viewMode === 'dual' && (
          <div className="grid grid-cols-1 lg:grid-cols-[410px_1fr] gap-6 items-start">
            {/* Left Column: Handheld Android PDA Terminal */}
            <div className="w-full flex justify-center sticky top-20">
              <MobileTerminal />
            </div>

            {/* Right Column: Web Management Dashboard */}
            <div className="w-full min-w-0">
              <SupervisorDashboard />
            </div>
          </div>
        )}

        {viewMode === 'mobile' && (
          <div className="w-full max-w-md mx-auto py-4">
            <MobileTerminal />
          </div>
        )}

        {viewMode === 'dashboard' && (
          <div className="w-full">
            <SupervisorDashboard />
          </div>
        )}
      </main>

      {/* Modals & Overlays */}
      <ThermalLabelModal />
      <BlueprintModal
        isOpen={isBlueprintModalOpen}
        onClose={() => setIsBlueprintModalOpen(false)}
      />
      <DbConfigModal
        isOpen={isDbConfigModalOpen}
        onClose={() => setIsDbConfigModalOpen(false)}
      />
      <ExecutivePresentationModal
        isOpen={isExecutiveModalOpen}
        onClose={() => setIsExecutiveModalOpen(false)}
      />

      {/* Real-time Event & Socket Inspector */}
      <LiveEventInspector />
    </div>
  );
}

export default function App() {
  return (
    <WmsProvider>
      <AppContent />
    </WmsProvider>
  );
}
