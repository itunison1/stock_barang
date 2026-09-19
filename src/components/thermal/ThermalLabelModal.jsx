import React, { useState } from 'react';
import { Icon } from '../common/Icons';
import { BarcodeGenerator } from '../barcode/BarcodeGenerator';
import { useWms } from '../../services/store';

export const ThermalLabelModal = () => {
  const { activeThermalLabel, setActiveThermalLabel } = useWms();
  const [showRawBytes, setShowRawBytes] = useState(false);
  const [isSimulatingFeed, setIsSimulatingFeed] = useState(false);

  if (!activeThermalLabel) return null;

  const handlePrint = () => {
    setIsSimulatingFeed(true);
    setTimeout(() => {
      setIsSimulatingFeed(false);
      window.print();
    }, 400);
  };

  const isPending = activeThermalLabel.status === 'pending';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-850 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Icon name="printer" size={16} />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                DIRECT THERMAL ESC/POS
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                  TCP:9100
                </span>
              </div>
              <div className="text-[10px] font-mono text-slate-400">
                PT Unison Industrial Indonesia • No Server Hop
              </div>
            </div>
          </div>
          <button
            onClick={() => setActiveThermalLabel(null)}
            className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* Realistic Thermal Label Paper */}
        <div className="p-6 bg-slate-950 flex flex-col items-center justify-center overflow-y-auto max-h-[65vh]">
          <div
            className={`w-[290px] bg-amber-50 text-slate-900 rounded-sm shadow-xl p-4 border-2 border-dashed border-amber-200 font-mono transition-transform duration-300 ${
              isSimulatingFeed ? 'translate-y-2 scale-[1.02]' : ''
            }`}
            style={{
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
            }}
          >
            {/* Paper Header */}
            <div className="text-center border-b border-slate-800/20 pb-2 mb-2">
              <div className="font-black text-[12px] tracking-wider uppercase text-slate-950">
                PT UNISON INDUSTRIAL INDONESIA
              </div>
              <div className="text-[8.5px] text-slate-600 tracking-wide">
                FASTENER INVENTORY LABEL • MUR & BAUT
              </div>
            </div>

            {/* Status Watermark */}
            <div className="my-1 text-center">
              {isPending ? (
                <div className="bg-amber-100 border border-amber-400 text-amber-950 font-black text-[11px] py-1 px-2 rounded uppercase tracking-wider">
                  ⚠️ DRAFT - PENDING APPROVAL
                </div>
              ) : (
                <div className="bg-emerald-100 border border-emerald-500 text-emerald-950 font-black text-[11px] py-1 px-2 rounded uppercase tracking-wider">
                  ✓ MASTER RESMI - ACTIVE
                </div>
              )}
            </div>

            {/* Product Title & Details */}
            <div className="my-2 text-left">
              <div className="text-[11.5px] font-bold text-slate-950 leading-tight">
                {activeThermalLabel.productName}
              </div>
              <div className="text-[10px] text-slate-700 mt-1 flex justify-between">
                <span>SKU: {activeThermalLabel.sku}</span>
                <span className="font-bold">Qty: {activeThermalLabel.qty} pcs</span>
              </div>
              <div className="text-[10px] text-slate-700 flex justify-between mt-0.5">
                <span>Lokasi: <b>{activeThermalLabel.rackCode}</b></span>
                <span>Kat: {activeThermalLabel.category}</span>
              </div>
              <div className="text-[9px] text-slate-600 flex justify-between mt-0.5 pt-0.5 border-t border-slate-300">
                <span>Lot: <b>{activeThermalLabel.lotNo || 'LOT-2609A'}</b></span>
                <span>Batch/Heat: <b>HT-42B</b></span>
              </div>
            </div>

            {/* Barcode Strip */}
            <div className="my-2 flex justify-center">
              <BarcodeGenerator
                value={activeThermalLabel.barcode}
                width={250}
                height={62}
                status={activeThermalLabel.status}
              />
            </div>

            {/* Paper Footer */}
            <div className="border-t border-slate-800/20 pt-2 text-[8px] text-slate-600 flex justify-between">
              <span>Op: {activeThermalLabel.operatorName}</span>
              <span>{activeThermalLabel.printedAt}</span>
            </div>

            <div className="text-center text-[7px] text-slate-500 mt-1">
              ESC/POS RAW SOCKET • PORT 9100 DIRECT • TARGET: {activeThermalLabel.printerIp}
            </div>
          </div>

          {/* Raw ESC/POS Byte Stream Drawer */}
          {showRawBytes && (
            <div className="w-full max-w-[320px] mt-4 p-3 bg-slate-900 border border-slate-800 rounded-lg text-left">
              <div className="text-[10px] font-mono text-emerald-400 font-semibold mb-1 flex items-center gap-1.5">
                <Icon name="terminal" size={12} />
                RAW ESC/POS HEX STREAM (Socket TCP:9100)
              </div>
              <div className="text-[9px] font-mono text-slate-400 break-all bg-slate-950 p-2 rounded border border-slate-800">
                1B 40 1B 61 01 1B 21 30 55 4E 49 53 4F 4E 20 49 4E 44 55 53 54 52 49 41 4C 0A 1B 61 00 1D 6B 04{' '}
                {activeThermalLabel.barcode} 00 1D 56 42 00
              </div>
              <div className="text-[9px] text-slate-500 mt-1">
                Data dikirim langsung dari IP HP ke socket printer thermal tanpa melalui server backend.
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-5 py-3.5 bg-slate-850 border-t border-slate-700 flex items-center justify-between">
          <button
            onClick={() => setShowRawBytes(!showRawBytes)}
            className="text-[11px] font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1.5 py-1 px-2 rounded hover:bg-slate-800 transition-colors"
          >
            <Icon name="terminal" size={14} />
            {showRawBytes ? 'Tutup Raw Bytes' : 'Lihat Raw ESC/POS'}
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => setActiveThermalLabel(null)}
              className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Selesai
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-950 transition-colors"
            >
              <Icon name="printer" size={14} />
              Cetak Fisik / Print
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
