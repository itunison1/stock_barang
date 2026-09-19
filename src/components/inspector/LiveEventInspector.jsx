import React, { useState } from 'react';
import { Icon } from '../common/Icons';
import { useWms } from '../../services/store';

export const LiveEventInspector = () => {
  const { eventLogs } = useWms();
  const [isOpen, setIsOpen] = useState(false);
  const [filterType, setFilterType] = useState('ALL');

  const filteredLogs = eventLogs.filter((log) => {
    if (filterType === 'ALL') return true;
    if (filterType === 'SOCKET' && log.type.includes('PRINTER')) return true;
    if (filterType === 'ROOM' && log.type.includes('ROOM')) return true;
    if (filterType === 'SYNC' && log.type.includes('SYNC')) return true;
    if (filterType === 'GATE' && log.type.includes('SPV')) return true;
    return false;
  });

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 shadow-[0_-10px_25px_rgba(0,0,0,0.5)] transition-all">
      {/* Drawer Header Bar */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="px-6 py-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
            <Icon name="terminal" size={14} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-slate-200">
              LIVE EVENT & SOCKET INSPECTOR
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
              {eventLogs.length} events
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
          <span className="hidden md:inline text-[11px] text-slate-500">
            Real-time ESC/POS socket stream • Room DB writes • WorkManager sync
          </span>
          <div className="flex items-center gap-1 text-blue-400 hover:text-blue-300">
            <span>{isOpen ? 'Sembunyikan' : 'Buka Inspector'}</span>
            <Icon name={isOpen ? 'arrowDown' : 'zap'} size={14} />
          </div>
        </div>
      </div>

      {/* Expanded Logs Body */}
      {isOpen && (
        <div className="p-4 border-t border-slate-800/80 max-h-56 overflow-y-auto space-y-2 bg-slate-950 font-mono text-[11px]">
          {/* Filters Bar */}
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-850">
            <div className="flex gap-1.5 text-[10px]">
              {['ALL', 'SOCKET', 'ROOM', 'SYNC', 'GATE'].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-2 py-0.5 rounded border transition-colors ${
                    filterType === type
                      ? 'bg-blue-600 text-white border-blue-500 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-slate-500">Menampilkan {filteredLogs.length} log</span>
          </div>

          {/* Logs List */}
          <div className="space-y-1">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-2.5 p-1.5 rounded hover:bg-slate-900/60 transition-colors"
              >
                <span className="text-slate-500 text-[10px] shrink-0 pt-0.5">{log.time}</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0 uppercase border ${
                    log.type.includes('PRINTER')
                      ? 'bg-purple-950 text-purple-300 border-purple-800'
                      : log.type.includes('ROOM')
                      ? 'bg-blue-950 text-blue-300 border-blue-800'
                      : log.type.includes('SPV')
                      ? 'bg-amber-950 text-amber-300 border-amber-800'
                      : log.type.includes('WARN') || log.type.includes('ERR')
                      ? 'bg-red-950 text-red-300 border-red-800'
                      : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  }`}
                >
                  {log.type}
                </span>
                <span className="text-slate-300 leading-snug flex-1">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
