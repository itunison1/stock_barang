import React, { useState } from 'react';
import { Icon } from '../common/Icons';
import { useWms } from '../../services/store';
import { BarcodeGenerator } from '../barcode/BarcodeGenerator';
import { WAREHOUSES } from '../../services/mockData';

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
    selectedPrinterId,
    setSelectedPrinterId,
    resetDatabase,
    liveDbStatus,
    searchLiveItems,
  } = useWms();

  const [activeTab, setActiveTab] = useState('tracking'); // 'tracking' | 'pending' | 'sessions' | 'livedb' | 'printers' | 'audit'
  const [rejectModalItem, setRejectModalItem] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [zoomedPhoto, setZoomedPhoto] = useState(null);
  const [catalogFilter, setCatalogFilter] = useState('all'); // 'all' | 'active' | 'pending' | 'rejected'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState('ALL');

  // Live Database search state (176.673 items via usr_android)
  const [liveSearchQuery, setLiveSearchQuery] = useState('BAUT');
  const [liveItems, setLiveItems] = useState([]);
  const [isLoadingLive, setIsLoadingLive] = useState(false);

  const fetchLiveSearch = async (q = '') => {
    setIsLoadingLive(true);
    const results = await searchLiveItems(q, 40);
    setLiveItems(results);
    setIsLoadingLive(false);
  };

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
    setRejectionReason('Spesifikasi ulir atau material tidak sesuai master resmi PT Unison.');
  };

  const handleConfirmReject = (e) => {
    e.preventDefault();
    if (rejectModalItem) {
      rejectProposal(rejectModalItem.id, rejectionReason);
      setRejectModalItem(null);
      setRejectionReason('');
    }
  };

  const targetPrinter = printers.find((p) => p.id === Number(selectedPrinterId)) || printers[0];

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
              <h2 className="text-base font-bold tracking-tight text-white">PORTAL SUPERVISOR WMS</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-950 border border-blue-800 text-blue-300 font-bold">
                PT UNISON INDUSTRIAL INDONESIA
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Pelacakan Lokasi Barang • Remote Direct Print (TCP:9100) • Approval Gate Mode A
            </p>
          </div>
        </div>

        {/* User Role Switcher & Remote Printer Selector */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Target Printer for Remote Print */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-mono">
            <Icon name="printer" size={13} className="text-purple-400" />
            <span className="text-slate-400 text-[10px]">Print Target:</span>
            <select
              value={selectedPrinterId}
              onChange={(e) => setSelectedPrinterId(e.target.value)}
              className="bg-transparent text-purple-300 font-bold focus:outline-none cursor-pointer text-[11px] max-w-[170px] truncate"
              title="Pilih printer target untuk remote print"
            >
              {printers.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-slate-100">
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* User Switcher */}
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs">
            <Icon name="user" size={14} className="text-amber-400" />
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
            title="Reset Data Demo"
          >
            <Icon name="refresh" size={16} />
          </button>
        </div>
      </div>

      {/* Quick Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-6 border-b border-slate-800/80 bg-slate-900/30">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase text-slate-400">Total Fasteners Resmi</div>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">{activeList.length} SKU</div>
            <div className="text-[10px] text-emerald-400/80 mt-0.5">Tercatat di 11 Gudang</div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <Icon name="checkCircle" size={20} />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase text-slate-400">Antrian Proposal Mode A</div>
            <div className="text-2xl font-bold font-mono text-amber-400 mt-1">{pendingList.length}</div>
            <div className="text-[10px] text-amber-400/80 mt-0.5">Menunggu Verifikasi SPV</div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
            <Icon name="alertTriangle" size={20} />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase text-slate-400">Selisih Opname (Variance)</div>
            <div className="text-2xl font-bold font-mono text-blue-400 mt-1">{totalVarianceDiscrepancies}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Item butuh rekonsiliasi</div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
            <Icon name="layers" size={20} />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase text-slate-400">Gudang Aktif PT Unison</div>
            <div className="text-2xl font-bold font-mono text-slate-200 mt-1">
              {WAREHOUSES.length} Gudang
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">U2 G1-G6, F29, UCP, Jaya, D30, U1</div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center border border-slate-700">
            <Icon name="mapPin" size={20} />
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-800 px-6 bg-slate-900/40 overflow-x-auto gap-2 text-xs font-mono">
        <button
          onClick={() => setActiveTab('tracking')}
          className={`py-3 px-4 font-bold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'tracking'
              ? 'border-blue-500 text-blue-400 bg-blue-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Icon name="mapPin" size={15} />
          Pelacakan Lokasi Barang (Rule 1 & 3)
        </button>

        <button
          onClick={() => setActiveTab('pending')}
          className={`py-3 px-4 font-bold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'pending'
              ? 'border-amber-500 text-amber-400 bg-amber-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Icon name="alertTriangle" size={15} />
          Antrian Approval Mode A
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
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Icon name="layers" size={15} />
          Hasil Scan & Variance
        </button>

        <button
          onClick={() => {
            setActiveTab('livedb');
            if (liveItems.length === 0) fetchLiveSearch(liveSearchQuery);
          }}
          className={`py-3 px-4 font-bold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'livedb'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <Icon name="database" size={15} />
          Live DB Produksi (176k)
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
          Remote Printer Meja & Kantor (Rule 2)
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
        {/* TAB 1: PELACAKAN LOKASI BARANG (FASTENER TRACKER - RULES 1 & 3) */}
        {/* ============================================================ */}
        {activeTab === 'tracking' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Icon name="search" size={16} className="text-blue-400" />
                  PELACAKAN LOKASI & DETAIL BARANG (11 GUDANG)
                </h3>
                <p className="text-xs text-slate-400">
                  Scan barcode di rak atau cari nama baut/mur untuk melihat letak gudang, nomor rak, baris tingkat, dan stok sistem.
                </p>
              </div>

              {/* Warehouse Filter */}
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-slate-400 text-[11px]">Filter Gudang:</span>
                <select
                  value={selectedWarehouseFilter}
                  onChange={(e) => setSelectedWarehouseFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-bold"
                >
                  <option value="ALL">Semua 11 Gudang</option>
                  {WAREHOUSES.map((wh) => (
                    <option key={wh.id} value={wh.code}>
                      {wh.code} ({wh.name})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search Input Bar */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama baut/mur, diameter ulir (M8/M10), kode SKU (AB6C50), atau barcode..."
                className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 pl-10 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono shadow-inner"
              />
              <Icon
                name="search"
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
              />
            </div>

            {/* Fasteners Table Tracking Grid */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden shadow-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-[10px] font-mono text-slate-400 uppercase">
                    <th className="py-3 px-4">Spesifikasi Mur / Baut</th>
                    <th className="py-3 px-4">Letak Gudang & Rak</th>
                    <th className="py-3 px-4">Kemasan & Satuan</th>
                    <th className="py-3 px-4 text-center">Stok Terdata</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Aksi Print</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {products
                    .filter((p) => {
                      if (selectedWarehouseFilter !== 'ALL' && p.warehouse_code !== selectedWarehouseFilter) {
                        return false;
                      }
                      if (
                        searchQuery &&
                        !p.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
                        !p.sku.toLowerCase().includes(searchQuery.toLowerCase()) &&
                        !p.barcode.includes(searchQuery) &&
                        !(p.warehouse_code && p.warehouse_code.toLowerCase().includes(searchQuery.toLowerCase()))
                      ) {
                        return false;
                      }
                      return true;
                    })
                    .map((item) => (
                      <tr key={item.id} className="hover:bg-slate-900/60 transition-colors">
                        {/* Name & SKU */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-100 text-xs">{item.name}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="text-blue-400 font-bold">{item.sku}</span>
                            <span>• Barcode: {item.barcode}</span>
                            {item.thread_spec && <span>• Spec: {item.thread_spec}</span>}
                          </div>
                        </td>

                        {/* Location Details (Rule 1) */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <Icon name="mapPin" size={13} className="text-amber-400 shrink-0" />
                            <span className="font-bold text-amber-400">{item.warehouse_code || '—'}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Rak: <b className="text-emerald-400">{item.rack_code || 'RAK-01'}</b> •{' '}
                            {item.shelf_tier || '—'}
                          </div>
                        </td>

                        {/* Packaging */}
                        <td className="py-3 px-4 text-slate-300 text-[11px]">
                          <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-bold">
                            {item.pack || '—'}
                          </span>
                          <span className="text-[10px] text-slate-500 ml-1.5">({item.unit || ''})</span>
                        </td>

                        {/* Stock */}
                        <td className="py-3 px-4 text-center font-bold text-slate-100 text-xs">
                          {item.status === 'active' ? item.stock_system.toLocaleString() : (item.proposed_qty || 0).toLocaleString()} {item.unit || ''}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                              item.status === 'active'
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                : 'bg-amber-950 text-amber-300 border-amber-800'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>

                        {/* Remote Print Action (Rule 2) */}
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() =>
                              directPrintThermal({
                                barcode: item.barcode,
                                productName: item.name,
                                sku: item.sku,
                                category: item.category,
                                qty: item.stock_system,
                                rackCode: `${item.warehouse_code} - ${item.rack_code}`,
                                status: item.status,
                                targetPrinterId: selectedPrinterId,
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-purple-950 hover:bg-purple-900 border border-purple-800 text-purple-200 text-[10px] font-bold font-mono inline-flex items-center gap-1 transition-colors"
                            title={`Cetak remote ke ${targetPrinter.name}`}
                          >
                            <Icon name="printer" size={12} className="text-purple-400" />
                            Print Remote
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: PROPOSAL APPROVAL QUEUE (MODE A GATE) */}
        {/* ============================================================ */}
        {activeTab === 'pending' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                  ANTRIAN PROPOSAL FASTENER BARU (MODE A)
                </h3>
                <p className="text-xs text-slate-400">
                  Supervisor wajib memeriksa foto fisik spesifikasi ulir baut/mur sebelum menekan Approve.
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
                  Tidak ada antrian proposal pending. Anda dapat membuat proposal mur/baut baru melalui simulator HP Operator di sebelah kiri.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {pendingList.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-amber-500/30 bg-slate-900/90 overflow-hidden shadow-xl flex flex-col hover:border-amber-500/60 transition-colors"
                  >
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
                          Gudang: <b className="text-emerald-400">{item.warehouse_code || item.proposed_location}</b>
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 block">
                          {item.created_at}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 space-y-3 flex-1">
                      <div className="flex gap-4">
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

                        <div className="flex-1 space-y-1.5 text-xs font-mono">
                          <div className="flex justify-between border-b border-slate-800 pb-1">
                            <span className="text-slate-400">Pengaju:</span>
                            <span className="text-slate-200">
                              {users.find((u) => u.id === item.created_by)?.name || 'Operator Gudang'}
                            </span>
                          </div>
                          <div className="flex justify-between border-b border-slate-800 pb-1">
                            <span className="text-slate-400">Kategori:</span>
                            <span className="text-slate-200">{item.category}</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-800 pb-1">
                            <span className="text-slate-400">Qty Diajukan:</span>
                            <span className="font-bold text-emerald-400">
                              {item.proposed_qty || 100} pcs
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 italic pt-1 font-sans">
                            "{item.notes || 'Ditemukan saat opname rak'}"
                          </div>
                        </div>
                      </div>

                      {/* Barcode Strip Preview & Remote Print */}
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
                              rackCode: item.warehouse_code || item.proposed_location,
                              status: 'pending',
                              targetPrinterId: selectedPrinterId,
                            })
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-purple-950 hover:bg-purple-900 border border-purple-800 text-purple-200 text-xs flex items-center gap-1 transition-colors font-mono font-bold"
                          title="Cetak ulang label draft ke printer target"
                        >
                          <Icon name="printer" size={13} />
                          Print Draft
                        </button>
                      </div>
                    </div>

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
        {/* TAB 3: HASIL SCAN & VARIANCE */}
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
                    <th className="py-3 px-4">Gudang & Rak</th>
                    <th className="py-3 px-4 text-center">Stok Sistem</th>
                    <th className="py-3 px-4 text-center">Qty Fisik</th>
                    <th className="py-3 px-4 text-center">Selisih</th>
                    <th className="py-3 px-4">Catatan</th>
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
                      <td className="py-3 px-4 text-amber-300 font-bold">
                        {detail.warehouse_code || '—'}
                        <span className="text-slate-400 text-[10px] block font-normal">{detail.rack_code || 'RAK-01'}</span>
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
        {/* TAB 4: REMOTE PRINTER MEJA & KANTOR (RULE 2) */}
        {/* ============================================================ */}
        {activeTab === 'printers' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-100">MANAJEMEN REMOTE PRINTER THERMAL LAN (TCP:9100)</h3>
                <p className="text-xs text-slate-400">
                  Operator yang berada di tengah-tengah lorong rak barang dapat mengirim hasil cetak langsung ke printer meja kantor ini via raw TCP socket.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      <span className="text-[10px] font-mono text-slate-500">{prn.ping_ms}ms ping</span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-100">{prn.name}</h4>
                    <div className="text-xs font-mono font-bold text-purple-300 mt-1">
                      IP: {prn.ip}:{prn.port}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Lokasi Fisik: <b className="text-slate-200">{prn.location_desc}</b>
                    </div>

                    <div className="mt-3 space-y-1 text-[11px] text-slate-400 font-mono">
                      <div>Protocol: {prn.protocol}</div>
                      <div>Lebar Kertas: {prn.paper_width}</div>
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      directPrintThermal({
                        barcode: '8992001001001',
                        productName: 'TEST PRINT ESC/POS - PT UNISON',
                        sku: 'TEST-01',
                        category: 'Test Socket',
                        qty: 100,
                        rackCode: 'U2 GUDANG2',
                        status: 'active',
                        targetPrinterId: prn.id,
                      })
                    }
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 hover:text-white text-xs font-bold font-mono flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
                  >
                    <Icon name="printer" size={14} />
                    Test Remote Print ke {prn.name}
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
                <h3 className="text-sm font-bold text-slate-100">AUDIT TRAIL LOGS PT UNISON INDUSTRIAL INDONESIA</h3>
                <p className="text-xs text-slate-400">
                  Seluruh aktivitas hitung fisik di rak, remote print ke kantor, dan approval tercatat permanen.
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

        {/* ============================================================ */}
        {/* TAB 4: LIVE MYSQL DATABASE PRODUKSI (176.673 ITEMS VIA usr_android) */}
        {/* ============================================================ */}
        {activeTab === 'livedb' && (
          <div className="space-y-4 animate-fade-in">
            {/* Live Database Header Status */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-blue-950/30 border border-emerald-800/60 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
                  <Icon name="database" size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">LIVE SERVER DATABASE PRODUKSI</h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      AKTIF / TERKONEKSI
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Server: <b className="text-slate-200">{liveDbStatus.host}</b> • DB: <b className="text-emerald-300">{liveDbStatus.database}</b> • User: <b className="text-slate-200">{liveDbStatus.user}</b> • Total: <b className="text-amber-400 font-bold">{liveDbStatus.total_items != null ? liveDbStatus.total_items.toLocaleString() : '—'} Fasteners</b>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchLiveSearch(liveSearchQuery)}
                  disabled={isLoadingLive}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-colors shadow disabled:opacity-40"
                >
                  <Icon name="refresh" size={13} className={isLoadingLive ? 'animate-spin' : ''} />
                  <span>{isLoadingLive ? 'Mengambil Data...' : 'Refresh DB'}</span>
                </button>
              </div>
            </div>

            {/* Live Search Input & Fastener Quick Keywords */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={liveSearchQuery}
                    onChange={(e) => setLiveSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchLiveSearch(liveSearchQuery)}
                    placeholder="Cari dari 176.673 barang: ketik kode (AB6C50) atau nama (BAUT, MUR, STUD, SS304)..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  {isLoadingLive && (
                    <div className="absolute right-3 top-2.5 text-emerald-400 text-xs font-mono animate-pulse">
                      Mencari...
                    </div>
                  )}
                </div>
                <button
                  onClick={() => fetchLiveSearch(liveSearchQuery)}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs font-mono flex items-center justify-center gap-1.5 transition-colors shadow"
                >
                  <Icon name="search" size={14} />
                  <span>Cari di MySQL</span>
                </button>
              </div>

              {/* Quick Preset Buttons for Live DB */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
                <span className="text-[10px] text-slate-400 mr-1">Keyword Populer:</span>
                {['BAUT', 'MUR', 'STUD', 'AB6', 'HEX', 'CEMET', 'WASHER', 'M10'].map((kw) => (
                  <button
                    key={kw}
                    onClick={() => {
                      setLiveSearchQuery(kw);
                      fetchLiveSearch(kw);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] transition-colors border ${
                      liveSearchQuery === kw
                        ? 'bg-emerald-600 text-white border-emerald-500 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {kw}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Database Items Table */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
              <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between text-xs font-mono bg-slate-950/60">
                <span className="text-slate-300">
                  Ditemukan: <b className="text-emerald-400">{liveItems.length} barang</b> dari tabel <code>item</code> (Maksimal 40 record ditampilkan)
                </span>
                <span className="text-slate-500 text-[10px]">
                  Target Printer: <b className="text-purple-300">{targetPrinter.name}</b>
                </span>
              </div>

              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="sticky top-0 bg-slate-950 text-slate-400 text-[10px] uppercase border-b border-slate-800 z-10">
                    <tr>
                      <th className="py-2.5 px-4">ITCODE (SKU / Barcode)</th>
                      <th className="py-2.5 px-4">Nama Barang (ITNAME)</th>
                      <th className="py-2.5 px-4">Kemasan & Satuan</th>
                      <th className="py-2.5 px-4">Stok Terdaftar</th>
                      <th className="py-2.5 px-4">Posisi Gudang / Bin</th>
                      <th className="py-2.5 px-4 text-right">Aksi Direct Print</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {liveItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-slate-500">
                          {isLoadingLive ? 'Sedang memuat data dari database produksi...' : 'Ketik kata kunci lalu tekan "Cari di MySQL"'}
                        </td>
                      </tr>
                    ) : (
                      liveItems.map((item) => (
                        <tr key={`${item.id}-${item.sku}`} className="hover:bg-slate-850/60 transition-colors">
                          <td className="py-2.5 px-4">
                            <span className="font-bold text-amber-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                              {item.sku}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-sans font-medium text-slate-100 max-w-xs truncate">
                            {item.name}
                          </td>
                          <td className="py-2.5 px-4 text-[11px] text-slate-400">
                            <span className="text-slate-200 font-bold">{item.pack || '—'}</span>
                            {item.isi_per_pack > 1 && ` (${item.isi_per_pack.toLocaleString()} ${item.unit})`}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-emerald-400">
                            {item.stock_system} {item.unit}
                          </td>
                          <td className="py-2.5 px-4 text-[11px]">
                            <span className="text-blue-300 font-bold">{item.warehouse_code}</span>
                            <span className="text-slate-500 block text-[9px]">{item.rack_code}</span>
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <button
                              onClick={() =>
                                directPrintThermal({
                                  barcode: item.barcode,
                                  productName: item.name,
                                  sku: item.sku,
                                  category: item.category,
                                  qty: item.stock_system || 100,
                                  rackCode: `${item.warehouse_code} - ${item.rack_code}`,
                                  status: 'active',
                                  targetPrinterId: selectedPrinterId,
                                })
                              }
                              className="px-2.5 py-1 rounded-lg bg-purple-950 hover:bg-purple-900 border border-purple-800 text-purple-300 text-[10px] font-bold transition-colors inline-flex items-center gap-1 shadow"
                              title="Kirim instruksi cetak thermal via soket TCP:9100 ke printer kantor"
                            >
                              <Icon name="printer" size={12} />
                              <span>Cetak Label TCP:9100</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
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
