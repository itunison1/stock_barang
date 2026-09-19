import React, { useState } from 'react';
import { Icon } from '../common/Icons';
import { useWms } from '../../services/store';
import { BarcodeGenerator } from '../barcode/BarcodeGenerator';

export const SupervisorDashboard = () => {
  const {
    products,
    approveProposal,
    rejectProposal,
    stockDetails,
    stockSessions,
    locations,
    printers,
    auditLogs,
    currentUser,
    users,
    switchUser,
    directPrintThermal,
    resetDatabase,
  } = useWms();

  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'sessions' | 'catalog' | 'printers' | 'audit'
  const [rejectModalItem, setRejectModalItem] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [zoomedPhoto, setZoomedPhoto] = useState(null);
  const [catalogFilter, setCatalogFilter] = useState('all'); // 'all' | 'active' | 'pending' | 'rejected'
  const [searchQuery, setSearchQuery] = useState('');

  // Pending proposals list
  const pendingList = products.filter((p) => p.status === 'pending');
  const activeList = products.filter((p) => p.status === 'active');
  const rejectedList = products.filter((p) => p.status === 'rejected');

  // Variances calculation
  const totalVarianceDiscrepancies = stockDetails.filter((d) => d.variance !== 0).length;

  const handleApprove = (productId) => {
    approveProposal(productId);
  };

  const handleOpenReject = (item) => {
    setRejectModalItem(item);
    setRejectionReason('Barcode atau nama barang tidak sesuai standar gudang.');
  };

  const handleConfirmReject = (e) => {
    e.preventDefault();
    if (rejectModalItem) {
      rejectProposal(rejectModalItem.id, rejectionReason);
      setRejectModalItem(null);
      setRejectionReason('');
    }
  };

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 rounded-[24px] border border-slate-800 shadow-2xl flex flex-col overflow-hidden">
      {/* Top Navigation Header */}
      <div className="border-b border-slate-800 bg-slate-900/70 backdrop-blur px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Icon name="shield" size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight text-white">SUPERVISOR DASHBOARD</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950 border border-amber-800 text-amber-300 font-bold">
                MODE A GATEWAY
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Web Portal Approval Gate • Verifikasi Foto Fisik & Integritas Master Stok
            </p>
          </div>
        </div>

        {/* User Role Switcher & Reset Button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs">
            <Icon name="user" size={14} className="text-amber-400" />
            <span className="text-slate-400">Login sbg:</span>
            <select
              value={currentUser.id}
              onChange={(e) => switchUser(e.target.value)}
              className="bg-transparent text-slate-200 font-bold focus:outline-none cursor-pointer text-xs"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id} className="bg-slate-900 text-slate-100">
                  {u.name} ({u.role.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={resetDatabase}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Reset Data Demo ke Kondisi Awal"
          >
            <Icon name="refresh" size={16} />
          </button>
        </div>
      </div>

      {/* Quick Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-6 border-b border-slate-800/80 bg-slate-900/30">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase text-slate-400">Antrian Proposal</div>
            <div className="text-2xl font-bold font-mono text-amber-400 mt-1">{pendingList.length}</div>
            <div className="text-[10px] text-amber-400/80 mt-0.5">Menunggu Approval SPV</div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
            <Icon name="alertTriangle" size={20} />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase text-slate-400">Master Aktif Resmi</div>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">{activeList.length}</div>
            <div className="text-[10px] text-emerald-400/80 mt-0.5">Tersinkron di HP</div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <Icon name="checkCircle" size={20} />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase text-slate-400">Selisih Fisik (Variance)</div>
            <div className="text-2xl font-bold font-mono text-blue-400 mt-1">{totalVarianceDiscrepancies}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Item butuh rekonsiliasi</div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
            <Icon name="layers" size={20} />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase text-slate-400">Printer LAN Socket</div>
            <div className="text-2xl font-bold font-mono text-slate-200 mt-1">
              {printers.filter((p) => p.is_active).length} Online
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Port 9100 Direct</div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center border border-slate-700">
            <Icon name="printer" size={20} />
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-800 px-6 bg-slate-900/40 overflow-x-auto gap-2 text-xs font-mono">
        <button
          onClick={() => setActiveTab('pending')}
          className={`py-3 px-4 font-bold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'pending'
              ? 'border-amber-500 text-amber-400 bg-amber-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Icon name="alertTriangle" size={15} />
          Antrian Approval Proposal
          {pendingList.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-extrabold text-[10px]">
              {pendingList.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('sessions')}
          className={`py-3 px-4 font-bold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'sessions'
              ? 'border-blue-500 text-blue-400 bg-blue-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Icon name="layers" size={15} />
          Monitoring Opname & Variance
        </button>

        <button
          onClick={() => setActiveTab('catalog')}
          className={`py-3 px-4 font-bold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'catalog'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Icon name="package" size={15} />
          Katalog Master Produk ({products.length})
        </button>

        <button
          onClick={() => setActiveTab('printers')}
          className={`py-3 px-4 font-bold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'printers'
              ? 'border-purple-500 text-purple-400 bg-purple-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Icon name="printer" size={15} />
          Printer LAN Thermal (9100)
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`py-3 px-4 font-bold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'audit'
              ? 'border-slate-400 text-slate-200 bg-slate-800/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Icon name="history" size={15} />
          Audit Logs ({auditLogs.length})
        </button>
      </div>

      {/* Tab Content Area */}
      <div className="flex-1 p-6 overflow-y-auto">
        {/* ============================================================ */}
        {/* TAB 1: PROPOSAL APPROVAL QUEUE (MODE A GATE) */}
        {/* ============================================================ */}
        {activeTab === 'pending' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                  DAFTAR PROPOSAL BARANG BARU (MODE A)
                </h3>
                <p className="text-xs text-slate-400">
                  Supervisor wajib memeriksa foto fisik barang dan memastikan barcode tidak duplikat sebelum menekan Approve.
                </p>
              </div>
              <div className="text-xs font-mono text-amber-300/80 bg-amber-950/30 border border-amber-900/50 rounded-xl px-3 py-1.5">
                Role Gate: {currentUser.role === 'supervisor' || currentUser.role === 'admin' ? '✓ Akses Supervisor Aktif' : '⚠️ Hanya Supervisor / Admin yang dapat Approve'}
              </div>
            </div>

            {pendingList.length === 0 ? (
              <div className="p-12 text-center rounded-2xl border border-slate-800 bg-slate-900/40">
                <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-3 border border-emerald-500/20">
                  <Icon name="checkCircle" size={24} />
                </div>
                <h4 className="text-sm font-bold text-slate-200">Semua Proposal Sudah Disetujui!</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Tidak ada antrian proposal pending. Anda dapat membuat proposal baru melalui simulator HP Operator di sebelah kiri.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {pendingList.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-amber-500/30 bg-slate-900/90 overflow-hidden shadow-xl flex flex-col hover:border-amber-500/60 transition-colors"
                  >
                    {/* Proposal Card Header */}
                    <div className="p-4 bg-gradient-to-r from-amber-950/30 to-slate-900 border-b border-slate-800 flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                            PENDING APPROVAL
                          </span>
                          <span className="text-xs font-mono font-bold text-amber-400">
                            {item.barcode}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-100 mt-1 leading-snug">
                          {item.name}
                        </h4>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-mono text-slate-400 block">
                          Rak: <b className="text-emerald-400">{item.proposed_location || 'RAK-A-01'}</b>
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 block">
                          {item.created_at}
                        </span>
                      </div>
                    </div>

                    {/* Proposal Card Body */}
                    <div className="p-4 space-y-3 flex-1">
                      <div className="flex gap-4">
                        {/* Physical Photo with Zoom Trigger */}
                        <div
                          onClick={() => setZoomedPhoto(item.photo_url)}
                          className="w-28 h-28 rounded-xl border-2 border-amber-500/40 overflow-hidden shrink-0 relative cursor-pointer group bg-slate-950"
                        >
                          <img
                            src={item.photo_url}
                            alt={item.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold gap-1">
                            <Icon name="eye" size={16} /> Zoom
                          </div>
                          <div className="absolute bottom-0 inset-x-0 bg-amber-950/90 text-amber-300 text-[8px] font-mono text-center py-0.5 font-bold">
                            FOTO FISIK WAJIB
                          </div>
                        </div>

                        {/* Specs & Proposer info */}
                        <div className="flex-1 space-y-1.5 text-xs">
                          <div className="flex justify-between border-b border-slate-800 pb-1">
                            <span className="text-slate-400">Pengaju:</span>
                            <span className="font-mono text-slate-200">
                              {users.find((u) => u.id === item.created_by)?.name || 'Operator Lapangan'}
                            </span>
                          </div>
                          <div className="flex justify-between border-b border-slate-800 pb-1">
                            <span className="text-slate-400">Kategori:</span>
                            <span className="text-slate-200">{item.category}</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-800 pb-1">
                            <span className="text-slate-400">Qty Fisik Terhitung:</span>
                            <span className="font-mono font-bold text-emerald-400">
                              {item.proposed_qty || 1} pcs
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 italic pt-1">
                            "{item.notes || 'Ditemukan saat opname rak'}"
                          </div>
                        </div>
                      </div>

                      {/* Barcode Strip Preview */}
                      <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 flex items-center justify-between">
                        <BarcodeGenerator
                          value={item.barcode}
                          width={200}
                          height={46}
                          status="pending"
                          showText={false}
                        />
                        <button
                          onClick={() =>
                            directPrintThermal({
                              barcode: item.barcode,
                              productName: item.name,
                              sku: item.sku,
                              category: item.category,
                              qty: item.proposed_qty,
                              rackCode: item.proposed_location,
                              status: 'pending',
                            })
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs flex items-center gap-1 transition-colors"
                          title="Cetak ulang label sticker thermal"
                        >
                          <Icon name="printer" size={13} />
                          Print Draft
                        </button>
                      </div>
                    </div>

                    {/* Action Gate Buttons */}
                    <div className="p-4 bg-slate-900/60 border-t border-slate-800 flex gap-2">
                      <button
                        onClick={() => handleOpenReject(item)}
                        className="flex-1 py-2 rounded-xl border border-red-900/60 bg-red-950/20 hover:bg-red-900/40 text-red-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Icon name="xCircle" size={14} />
                        Tolak (Reject)
                      </button>

                      <button
                        onClick={() => handleApprove(item.id)}
                        className="flex-1 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950 transition-all"
                      >
                        <Icon name="checkCircle" size={15} />
                        Setujui (Approve)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: MONITORING SESI OPNAME & VARIANCE */}
        {/* ============================================================ */}
        {activeTab === 'sessions' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-100">MONITORING HASIL OPNAME & SELISIH STOK</h3>
                <p className="text-xs text-slate-400">
                  Data hitung fisik yang dikirim oleh operator via WorkManager sync.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-[10px] font-mono text-slate-400 uppercase">
                    <th className="py-3 px-4">Waktu</th>
                    <th className="py-3 px-4">Produk & Barcode</th>
                    <th className="py-3 px-4 text-center">Stok Sistem</th>
                    <th className="py-3 px-4 text-center">Qty Fisik</th>
                    <th className="py-3 px-4 text-center">Selisih (Variance)</th>
                    <th className="py-3 px-4">Status & Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {stockDetails.map((detail) => (
                    <tr key={detail.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-3 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                        {detail.created_at}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-200">{detail.product_name}</div>
                        <div className="text-[10px] text-slate-500">{detail.barcode}</div>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-300">
                        {detail.qty_system}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-100">
                        {detail.qty_physical}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            detail.variance < 0
                              ? 'bg-red-950 text-red-300 border border-red-800'
                              : detail.variance > 0
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {detail.variance > 0 ? `+${detail.variance}` : detail.variance}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300 text-[11px]">
                        {detail.note || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: KATALOG MASTER PRODUK */}
        {/* ============================================================ */}
        {activeTab === 'catalog' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Filter Pills */}
              <div className="flex gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-mono">
                {[
                  { key: 'all', label: `Semua (${products.length})` },
                  { key: 'active', label: `Resmi Active (${activeList.length})` },
                  { key: 'pending', label: `Pending (${pendingList.length})` },
                  { key: 'rejected', label: `Rejected (${rejectedList.length})` },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setCatalogFilter(tab.key)}
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      catalogFilter === tab.key
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama, SKU, barcode..."
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 pl-8 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-64"
                />
                <Icon
                  name="search"
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
                />
              </div>
            </div>

            {/* Catalog Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {products
                .filter((p) => {
                  if (catalogFilter !== 'all' && p.status !== catalogFilter) return false;
                  if (
                    searchQuery &&
                    !p.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
                    !p.barcode.includes(searchQuery) &&
                    !p.sku.toLowerCase().includes(searchQuery.toLowerCase())
                  ) {
                    return false;
                  }
                  return true;
                })
                .map((prod) => (
                  <div
                    key={prod.id}
                    className="p-3.5 rounded-2xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between space-y-2 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex gap-3">
                      <img
                        src={prod.photo_url}
                        alt={prod.name}
                        className="w-16 h-16 rounded-xl object-cover border border-slate-700 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded border ${
                              prod.status === 'active'
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                : prod.status === 'pending'
                                ? 'bg-amber-950 text-amber-300 border-amber-800'
                                : 'bg-red-950 text-red-300 border-red-800'
                            }`}
                          >
                            {prod.status}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">{prod.sku}</span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-100 truncate mt-1">{prod.name}</h4>
                        <div className="text-[10px] font-mono text-slate-400">{prod.barcode}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono pt-2 border-t border-slate-800/80">
                      <span className="text-slate-400">
                        Stok:{' '}
                        <b className="text-slate-100">
                          {prod.status === 'active' ? prod.stock_system : prod.proposed_qty || 0} pcs
                        </b>
                      </span>
                      <button
                        onClick={() =>
                          directPrintThermal({
                            barcode: prod.barcode,
                            productName: prod.name,
                            sku: prod.sku,
                            category: prod.category,
                            qty: prod.stock_system,
                            status: prod.status,
                          })
                        }
                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-colors"
                        title="Print Label"
                      >
                        <Icon name="printer" size={14} />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 4: PRINTER LAN CONFIGURATION (PORT 9100) */}
        {/* ============================================================ */}
        {activeTab === 'printers' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-100">MANAJEMEN PRINTER THERMAL LAN (TCP:9100)</h3>
                <p className="text-xs text-slate-400">
                  HP Android mencetak langsung ke IP statis ini melalui socket RAW TCP tanpa melalui backend server.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {printers.map((prn) => (
                <div
                  key={prn.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
                          <Icon name="printer" size={16} />
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                          ● {prn.status}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">{prn.ping_ms}ms</span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-100">{prn.name}</h4>
                    <div className="text-xs font-mono font-bold text-purple-300 mt-1">
                      {prn.ip}:{prn.port}
                    </div>

                    <div className="mt-3 space-y-1 text-[11px] text-slate-400 font-mono">
                      <div>Protocol: {prn.protocol}</div>
                      <div>Lebar Kertas: {prn.paper_width}</div>
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      directPrintThermal({
                        barcode: '8991001001001',
                        productName: 'TEST PRINT ESC/POS',
                        sku: 'TEST-01',
                        category: 'Hardware Test',
                        qty: 1,
                        status: 'active',
                      })
                    }
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold font-mono flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Icon name="printer" size={14} />
                    Test Print Socket (9100)
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 5: AUDIT LOG TRAIL */}
        {/* ============================================================ */}
        {activeTab === 'audit' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-100">AUDIT TRAIL LOGS PERUSAHAAN</h3>
                <p className="text-xs text-slate-400">
                  Semua aktivitas operator, cetak socket thermal, dan approval supervisor tercatat permanen.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3 space-y-2 max-h-[500px] overflow-y-auto">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-850 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                          log.action === 'approve'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : log.action === 'reject'
                            ? 'bg-red-950 text-red-300 border border-red-800'
                            : log.action === 'create_proposal'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : log.action === 'print'
                            ? 'bg-purple-950 text-purple-300 border border-purple-800'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {log.action}
                      </span>
                      <span className="font-bold text-slate-200">{log.user_name}</span>
                      <span className="text-[10px] font-mono text-slate-500">{log.ip_address}</span>
                    </div>
                    <div className="text-slate-300 text-[11px]">{log.description}</div>
                  </div>

                  <div className="text-[10px] font-mono text-slate-500 whitespace-nowrap">
                    {log.created_at}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      {rejectModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-red-800 rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-red-400">
              <Icon name="xCircle" size={20} />
              <h3 className="text-sm font-bold text-slate-100">Tolak Proposal Barang</h3>
            </div>
            <p className="text-xs text-slate-300">
              Anda akan menolak proposal "<b>{rejectModalItem.name}</b>" ({rejectModalItem.barcode}). Silakan masukkan alasan penolakan untuk catatan audit dan feedback ke operator.
            </p>
            <form onSubmit={handleConfirmReject} className="space-y-3">
              <textarea
                required
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Alasan penolakan (misal: barcode ganda, foto blur, bukan stok resmi)..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-red-500"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setRejectModalItem(null)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-950"
                >
                  Konfirmasi Tolak
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Photo Zoom Modal */}
      {zoomedPhoto && (
        <div
          onClick={() => setZoomedPhoto(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 cursor-pointer animate-fade-in"
        >
          <div className="relative max-w-lg w-full bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden p-2">
            <img src={zoomedPhoto} alt="Zoom" className="w-full h-auto rounded-xl object-contain" />
            <div className="text-center py-2 text-xs font-mono text-slate-400">
              Klik di mana saja untuk menutup
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
