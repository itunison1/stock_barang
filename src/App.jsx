import React, { useState } from 'react';
import { WmsProvider } from './services/store';
import { Header } from './components/common/Header';
import { MobileTerminal } from './components/mobile/MobileTerminal';
import { SupervisorDashboard } from './components/dashboard/SupervisorDashboard';
import { ThermalLabelModal } from './components/thermal/ThermalLabelModal';
import { BlueprintModal } from './components/common/BlueprintModal';
import { LiveEventInspector } from './components/inspector/LiveEventInspector';

function AppContent() {
  const [viewMode, setViewMode] = useState('dual'); // 'dual' | 'mobile' | 'dashboard'
  const [isBlueprintModalOpen, setIsBlueprintModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-16">
      {/* App Header */}
      <Header
        viewMode={viewMode}
        setViewMode={setViewMode}
        onOpenBlueprintModal={() => setIsBlueprintModalOpen(true)}
      />

      {/* Main Workspace Area */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-3 sm:p-5 flex flex-col">
        {/* Helper Banner for Workflow Evaluation */}
        <div className="mb-4 p-3 rounded-2xl bg-gradient-to-r from-blue-950/40 via-slate-900 to-amber-950/30 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-slate-200">
              Live Testbed Mode A:
            </span>
            <span className="text-slate-400">
              Scan barang belum terdaftar di HP kiri → Otomatis muncul di antrian approval Web kanan!
            </span>
          </div>
          <button
            onClick={() => setIsBlueprintModalOpen(true)}
            className="text-blue-400 hover:text-blue-300 font-mono text-[11px] underline text-left"
          >
            Lihat Alur 8 Langkah Blueprint →
          </button>
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
