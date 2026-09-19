import React, { useState } from 'react';
import { Icon } from './Icons';
import { UnisonLogo } from './UnisonLogo';
import { UNISON_DB_CONFIG } from '../../config/database';

export const DbConfigModal = ({ isOpen, onClose }) => {
  const [showPass, setShowPass] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-850 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UnisonLogo size="sm" showText={false} />
            <div>
              <h3 className="text-sm font-bold text-slate-100">KONFIGURASI SERVER & DATABASE</h3>
              <p className="text-xs text-slate-400">PT Unison Industrial Indonesia • Fasteners Specialist</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 bg-slate-950 text-xs font-mono">
          {/* Company Profile Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/30 to-slate-900 border border-blue-900/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-300">PROFIL PERUSAHAAN</span>
              <span className="text-[9px] px-2 py-0.5 rounded bg-blue-950 text-blue-200 border border-blue-800">
                STANDARD: DIN • JIS • ISO • ASTM
              </span>
            </div>
            <div className="text-sm font-bold text-slate-100">{UNISON_DB_CONFIG.company.name}</div>
            <p className="text-slate-300 font-sans text-xs leading-relaxed">
              {UNISON_DB_CONFIG.company.specialty}
            </p>
          </div>

          {/* Database Server 1.140 Specs */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Icon name="database" size={16} className="text-emerald-400" />
                <span className="font-bold text-slate-200">Database Server (MySQL / MariaDB)</span>
              </div>
              <span className="text-[10px] text-emerald-400 bg-emerald-950 border border-emerald-900 px-2 py-0.5 rounded">
                ● CONNECTED
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-slate-300">
              <div>
                <span className="text-slate-500 block text-[10px]">HOST / IP SERVER</span>
                <span className="text-slate-100 font-bold">{UNISON_DB_CONFIG.server.host}</span>
                <span className="text-slate-500 text-[10px] block mt-0.5">(fallback: {UNISON_DB_CONFIG.server.fallbackHost})</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">DATABASE</span>
                <span className="text-emerald-400 font-bold">{UNISON_DB_CONFIG.server.database}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">USERNAME</span>
                <span className="text-slate-200">{UNISON_DB_CONFIG.server.username}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">PASSWORD</span>
                <div className="flex items-center gap-2">
                  <span>{showPass ? UNISON_DB_CONFIG.server.password : '••••••••'}</span>
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="text-blue-400 hover:text-blue-300 text-[10px] underline"
                  >
                    {showPass ? 'Sembunyikan' : 'Lihat'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Remote Access (FTP & RDP) */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-slate-200">
              <Icon name="server" size={16} className="text-purple-400" />
              <span>Remote Access Server (IP 192.168.1.140)</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-slate-300">
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-purple-400 font-bold block text-[10px]">FTP ACCESS</span>
                <div>User: <span className="text-slate-100 font-bold">{UNISON_DB_CONFIG.remoteAccess.ftp.user}</span></div>
                <div>Pass: <span className="text-slate-100 font-bold">{UNISON_DB_CONFIG.remoteAccess.ftp.pass}</span></div>
                <div className="text-[9px] text-slate-500">Port: {UNISON_DB_CONFIG.remoteAccess.ftp.port}</div>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-blue-400 font-bold block text-[10px]">RDP ACCESS</span>
                <div>User: <span className="text-slate-100 font-bold">{UNISON_DB_CONFIG.remoteAccess.rdp.user}</span></div>
                <div>Pass: <span className="text-slate-100 font-bold">{UNISON_DB_CONFIG.remoteAccess.rdp.pass}</span></div>
                <div className="text-[9px] text-slate-500">Port: {UNISON_DB_CONFIG.remoteAccess.rdp.port}</div>
              </div>
            </div>
          </div>

          {/* List of 11 Warehouses */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Icon name="layers" size={15} className="text-amber-400" />
                Daftar 11 Gudang PT Unison Industrial Indonesia
              </span>
              <span className="text-slate-400 text-[10px]">{UNISON_DB_CONFIG.warehouses.length} Gudang</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
              {UNISON_DB_CONFIG.warehouses.map((wh) => (
                <div
                  key={wh.id}
                  className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-[10px] leading-tight"
                >
                  <div className="text-amber-400 font-bold">{wh.code}</div>
                  <div className="text-slate-400 text-[9px] truncate">{wh.zone}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-850 border-t border-slate-700 flex justify-between items-center text-xs font-mono text-slate-400">
          <span>PT Unison Industrial Indonesia • WMS System</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
