import React, { useState } from 'react';
import { Icon } from '../common/Icons';
import { useWms } from '../../services/store';
import { QUICK_BARCODES } from '../../services/mockData';
import { ProposalModal } from './ProposalModal';

export const MobileTerminal = () => {
  const {
    currentUser,
    users,
    switchUser,
    isOnline,
    toggleNetwork,
    roomProducts,
    currentRack,
    scanRack,
    scanProduct,
    saveStockCount,
    pendingSyncQueue,
    isSyncing,
    triggerWorkManagerSync,
    lastSyncTime,
    directPrintThermal,
    printers,
    selectedPrinterId,
    setSelectedPrinterId,
    products,
  } = useWms();

  // Workflow step: 1 = scan/pilih gudang, 2 = scan & hitung rak, 3 = cari lokasi barang (locator)
  const [currentTab, setCurrentTab] = useState('scan'); // 'scan' | 'locator'
  const [currentStep, setCurrentStep] = useState(2); // default step 2 since warehouse is pre-locked
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanResult, setScanResult] = useState(null); // { status, product, barcode }
  const [physicalQtyInput, setPhysicalQtyInput] = useState('');
  const [countNoteInput, setCountNoteInput] = useState('');
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [proposalBarcode, setProposalBarcode] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [locatorSearch, setLocatorSearch] = useState('');

  // Fastener Scale / Timbangan Calculator Modal
  const [showScaleModal, setShowScaleModal] = useState(false);
  const [scaleGrossWeight, setScaleGrossWeight] = useState(''); // kg
  const [scaleTareWeight, setScaleTareWeight] = useState('0.5'); // kg (peti/karung)
  const [scaleWeightPer100Pcs, setScaleWeightPer100Pcs] = useState('1.2'); // kg per 100 pcs

  // Handle barcode submission (from input, physical laser scanner, or quick buttons)
  const handleScan = (codeToScan) => {
    const code = (codeToScan || barcodeInput).trim();
    if (!code) return;

    setSaveSuccessMsg('');

    // If on Step 1 (Pilih Gudang / Lokasi Rak)
    if (currentStep === 1) {
      const res = scanRack(code);
      if (res.success) {
        setBarcodeInput('');
        setCurrentStep(2);
        setScanResult(null);
      } else {
        alert(res.message);
      }
      return;
    }

    // Check if code contains structured 2D barcode format (e.g. ITEM_CODE|LOT_NO|QTY|DATE)
    let itemBarcode = code;
    let lotNo = '';
    let extractedQty = null;
    let prodDate = '';

    if (code.includes('|')) {
      const parts = code.split('|').map((s) => s.trim());
      itemBarcode = parts[0] || code;
      lotNo = parts[1] || '';
      extractedQty = parts[2] || null;
      prodDate = parts[3] || '';
    }

    // Step 2: Scan Barcode Barang yang sudah tertempel di kardus/rak
    const result = scanProduct(itemBarcode);
    setBarcodeInput('');

    if (result.status === 'NOT_FOUND') {
      setProposalBarcode(itemBarcode);
      setShowProposalModal(true);
      setScanResult(null);
    } else if (result.status === 'ACTIVE') {
      setScanResult(result);
      setPhysicalQtyInput(extractedQty || result.product.stock_system.toString());
      setCountNoteInput(lotNo ? `Lot: ${lotNo}${prodDate ? ` (Prod: ${prodDate})` : ''}` : '');
    } else if (result.status === 'PENDING') {
      setScanResult(result);
      setPhysicalQtyInput(extractedQty || (result.product.proposed_qty || 100).toString());
      setCountNoteInput(lotNo ? `Proposal Lot: ${lotNo}` : 'Barang proposal pending');
    } else if (result.status === 'REJECTED') {
      alert(`Barcode ${itemBarcode} DITOLAK: ${result.product.rejection_reason}`);
    }
  };

  // Submit physical count for active product
  const handleSaveCount = (e) => {
    e.preventDefault();
    if (!scanResult || !scanResult.product) return;

    const saved = saveStockCount(scanResult.product.id, physicalQtyInput, countNoteInput);
    setSaveSuccessMsg(
      `✓ Hasil scan & hitung ${scanResult.product.name} berhasil disimpan ke data (${saved.qty_physical} pcs)`
    );
    setScanResult(null);
    setPhysicalQtyInput('');
    setCountNoteInput('');
  };

  const targetPrinter = printers.find((p) => p.id === Number(selectedPrinterId)) || printers[0];

  return (
    <div className="relative mx-auto w-full max-w-[400px] rounded-[38px] p-3 bg-slate-900 border-[6px] border-slate-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] flex flex-col min-h-[760px]">
      {/* Enterprise Handheld Device Notch & Speaker */}
      <div className="flex items-center justify-between px-6 pt-1 pb-2">
        <div className="text-[10px] font-mono text-slate-500 font-bold tracking-widest">
          ZEBRA TC26 • PT UNISON
        </div>
        <div className="w-16 h-1.5 bg-slate-800 rounded-full" />
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Scanner Ready" />
          <span className="text-[9px] font-mono text-slate-400 font-bold">100%</span>
        </div>
      </div>

      {/* Screen Container */}
      <div className="flex-1 bg-slate-950 rounded-[28px] overflow-hidden flex flex-col border border-slate-850">
        {/* Android Status Bar */}
        <div className="bg-slate-900/90 backdrop-blur px-4 py-2 border-b border-slate-800 flex items-center justify-between text-[11px] font-mono">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleNetwork}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
                isOnline
                  ? 'bg-emerald-950 border border-emerald-800 text-emerald-300'
                  : 'bg-red-950 border border-red-800 text-red-300 animate-pulse'
              }`}
              title="Klik untuk simulasi online/offline"
            >
              <Icon name={isOnline ? 'wifi' : 'wifiOff'} size={12} />
              {isOnline ? 'WIFI ONLINE' : 'OFFLINE (BLIND SPOT)'}
            </button>
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            {pendingSyncQueue.length > 0 && (
              <span
                onClick={triggerWorkManagerSync}
                className="cursor-pointer flex items-center gap-1 bg-amber-950 text-amber-300 border border-amber-800 px-1.5 py-0.5 rounded text-[9px] font-bold"
                title="Klik untuk pemicu sync WorkManager manual"
              >
                <Icon name="refresh" size={10} className={isSyncing ? 'animate-spin' : ''} />
                {pendingSyncQueue.length} queue
              </span>
            )}
            <span className="text-slate-300 font-bold">14:35</span>
          </div>
        </div>

        {/* App Bar / User Profile */}
        <div className="bg-gradient-to-r from-blue-950/60 to-slate-900 p-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-blue-600 border border-blue-400 flex items-center justify-center text-white font-bold text-xs">
              <Icon name="user" size={16} />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                {currentUser.name}
                <span className="text-[8px] font-mono uppercase px-1.5 py-0.2 rounded bg-blue-900/60 text-blue-200 border border-blue-800">
                  {currentUser.role}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                Gudang: <b className="text-slate-200">{currentRack?.code || 'U2 GUDANG2'}</b>
              </div>
            </div>
          </div>

          <select
            value={currentUser.id}
            onChange={(e) => switchUser(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 text-[10px] rounded px-1.5 py-1 focus:outline-none"
            title="Ganti Operator"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>
        </div>

        {/* Navigation Mode: Scan Rak vs Cari Lokasi (Locator) */}
        <div className="grid grid-cols-2 bg-slate-900 border-b border-slate-800 text-[11px] font-mono">
          <button
            onClick={() => setCurrentTab('scan')}
            className={`py-2 text-center font-bold flex items-center justify-center gap-1.5 transition-colors ${
              currentTab === 'scan' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon name="scan" size={14} />
            Scan di Rak
          </button>
          <button
            onClick={() => setCurrentTab('locator')}
            className={`py-2 text-center font-bold flex items-center justify-center gap-1.5 transition-colors ${
              currentTab === 'locator' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon name="search" size={14} />
            Cari Lokasi Barang
          </button>
        </div>

        {/* Remote Print Destination Selector (Per Rule 2) */}
        <div className="bg-slate-900/70 px-3 py-2 border-b border-slate-800 flex items-center justify-between text-[10px] font-mono">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Icon name="printer" size={13} className="text-purple-400 shrink-0" />
            <span>Target Print:</span>
          </div>
          <select
            value={selectedPrinterId}
            onChange={(e) => setSelectedPrinterId(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-purple-300 rounded px-2 py-0.5 text-[10px] font-bold focus:outline-none max-w-[200px] truncate"
            title="Pilih tujuan cetak: Meja Kantor SPV atau Meja Operator"
          >
            {printers.map((prn) => (
              <option key={prn.id} value={prn.id}>
                {prn.name} ({prn.ip})
              </option>
            ))}
          </select>
        </div>

        {/* Main Operational Area */}
        <div className="flex-1 p-3 overflow-y-auto space-y-3">
          {/* ============================================================ */}
          {/* TAB 1: SCAN DI RAK OPERATOR (RULES 1 & 2) */}
          {/* ============================================================ */}
          {currentTab === 'scan' && (
            <div className="space-y-3 animate-fade-in">
              {/* Gudang Switcher Pill */}
              <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <Icon name="mapPin" size={13} className="text-blue-400 shrink-0" />
                  <span className="text-slate-400 font-mono">Posisi:</span>
                  <span className="font-mono font-bold text-emerald-400">{currentRack?.code || 'U2 GUDANG2'}</span>
                </div>
                <button
                  onClick={() => setCurrentStep(currentStep === 1 ? 2 : 1)}
                  className="text-[10px] text-blue-400 hover:text-blue-300 font-mono underline"
                >
                  {currentStep === 1 ? 'Lanjut Scan' : 'Ganti Gudang'}
                </button>
              </div>

              {/* STEP 1: PILIH / GANTI GUDANG DARI 11 GUDANG */}
              {currentStep === 1 && (
                <div className="space-y-2 animate-fade-in">
                  <div className="text-[10px] font-mono text-slate-400">Pilih Gudang Sesi Opname (11 Gudang):</div>
                  <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
                    {QUICK_BARCODES.filter((b) => b.type === 'rack').map((b) => (
                      <button
                        key={b.barcode}
                        onClick={() => handleScan(b.barcode)}
                        className={`p-2 rounded-xl border text-left text-[11px] transition-colors ${
                          currentRack?.code === b.barcode
                            ? 'bg-blue-600 text-white font-bold border-blue-500'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="font-mono font-bold">{b.barcode}</div>
                        <div className="text-[9px] opacity-75 truncate">{b.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 2: SCAN BARCODE BARANG DI RAK */}
              {currentStep === 2 && (
                <div className="space-y-3">
                  {/* Scanner Laser Viewfinder */}
                  <div className="relative rounded-2xl border border-blue-900/50 bg-slate-900/80 p-3 overflow-hidden shadow-inner">
                    <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_#ef4444] animate-pulse top-1/2 -translate-y-1/2 pointer-events-none" />

                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono text-blue-300 flex items-center gap-1">
                        <Icon name="scan" size={12} /> SCANNER DI LORONG RAK
                      </span>
                      <span className="text-[9px] font-mono text-purple-300 bg-purple-950 px-1.5 py-0.5 rounded border border-purple-900">
                        REMOTE PRINT OK
                      </span>
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleScan();
                      }}
                      className="relative"
                    >
                      <input
                        type="text"
                        value={barcodeInput}
                        onChange={(e) => setBarcodeInput(e.target.value)}
                        placeholder="Scan barcode mur/baut tertempel di rak"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                      />
                      <button
                        type="submit"
                        className="absolute right-1 top-1 bottom-1 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1 transition-colors"
                      >
                        <Icon name="search" size={13} /> Cari
                      </button>
                    </form>
                  </div>

                  {/* Quick Presets Fasteners */}
                  <div className="space-y-1">
                    <div className="text-[10px] font-mono text-slate-400 flex justify-between">
                      <span>Barcode Sampel Tertempel:</span>
                      <span className="text-amber-400 text-[9px]">*Klik merah untuk Mode A</span>
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                      {QUICK_BARCODES.filter((b) => b.type === 'product').map((b) => (
                        <button
                          key={b.barcode}
                          onClick={() => handleScan(b.barcode)}
                          className={`w-full p-1.5 rounded-lg border text-left flex items-center justify-between text-[11px] transition-colors ${
                            b.status === 'unregistered'
                              ? 'bg-amber-950/20 border-amber-800/50 hover:border-amber-500 text-amber-200'
                              : b.status === 'pending'
                              ? 'bg-blue-950/20 border-blue-800/40 text-blue-200'
                              : 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-300'
                          }`}
                        >
                          <div className="truncate">
                            <span className="font-mono font-bold mr-1.5">{b.barcode.slice(-6)}</span>
                            <span>{b.label}</span>
                          </div>
                          <span
                            className={`text-[9px] font-mono uppercase px-1 rounded ${
                              b.status === 'unregistered'
                                ? 'bg-amber-600 text-white font-bold'
                                : b.status === 'pending'
                                ? 'bg-blue-800 text-blue-200'
                                : 'bg-emerald-950 text-emerald-300'
                            }`}
                          >
                            {b.status}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Save Notification */}
                  {saveSuccessMsg && (
                    <div className="p-2.5 rounded-xl bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
                      <Icon name="checkCircle" size={16} className="shrink-0 text-emerald-400" />
                      <span>{saveSuccessMsg}</span>
                    </div>
                  )}

                  {/* HASIL SCAN: DETAIL LOKASI GUDANG & RAK (RULE 1) */}
                  {scanResult && scanResult.status === 'ACTIVE' && (
                    <div className="rounded-2xl border border-emerald-900/60 bg-gradient-to-b from-emerald-950/20 to-slate-900 p-3.5 space-y-3 animate-fade-in">
                      {/* Product Header */}
                      <div className="flex gap-3">
                        <img
                          src={scanResult.product.photo_url}
                          alt={scanResult.product.name}
                          className="w-16 h-16 rounded-xl object-cover border border-slate-700 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                              MASTER RESMI
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 font-bold">
                              {scanResult.product.sku}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-100 leading-tight mt-1">
                            {scanResult.product.name}
                          </h4>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Kemasan: <b className="text-slate-200">{scanResult.product.pack || '—'}</b> • Satuan:{' '}
                            <b className="text-slate-200">{scanResult.product.unit || '—'}</b>
                          </div>
                        </div>
                      </div>

                      {/* INFO LETAK GUDANG & RAK (Per Rule 1) */}
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs font-mono">
                        <div className="text-[10px] uppercase font-bold text-blue-300 flex items-center gap-1.5">
                          <Icon name="mapPin" size={12} />
                          LETAK GUDANG & POSISI RAK:
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <span className="text-slate-500 block text-[9px]">Gudang:</span>
                            <span className="font-bold text-amber-400">
                              {scanResult.product.warehouse_code || '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px]">Nomor Rak:</span>
                            <span className="font-bold text-emerald-400">
                              {scanResult.product.rack_code || 'RAK-01'}
                            </span>
                          </div>
                          <div className="col-span-2 text-slate-400 text-[10px]">
                            Tingkat: <span className="text-slate-200">{scanResult.product.shelf_tier || 'Tingkat 1'}</span>
                            {scanResult.product.bin_code && ` • Bin: ${scanResult.product.bin_code}`}
                          </div>
                        </div>

                        {/* Relocation warning if scanned in another warehouse */}
                        {currentRack &&
                          scanResult.product.warehouse_code &&
                          currentRack.code !== scanResult.product.warehouse_code && (
                            <div className="mt-1 p-1.5 rounded bg-amber-950/40 border border-amber-800/60 text-[10px] text-amber-300 flex items-center gap-1">
                              <Icon name="alertTriangle" size={12} className="shrink-0" />
                              <span>
                                Perhatian: Barang terdaftar di <b>{scanResult.product.warehouse_code}</b>, tetapi di-scan di{' '}
                                <b>{currentRack.code}</b>.
                              </span>
                            </div>
                          )}
                      </div>

                      {/* Physical Count Form */}
                      <form onSubmit={handleSaveCount} className="space-y-2 pt-1 border-t border-slate-800">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-mono text-slate-300 mb-0.5">
                              Stok Sistem
                            </label>
                            <input
                              type="text"
                              disabled
                              value={`${scanResult.product.stock_system} ${scanResult.product.unit || 'pcs'}`}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-400 font-mono"
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-0.5">
                              <label className="text-[10px] font-mono text-emerald-300 font-bold">
                                Qty Fisik di Rak *
                              </label>
                              <button
                                type="button"
                                onClick={() => setShowScaleModal(true)}
                                className="text-[9px] font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 hover:border-emerald-500 px-1.5 py-0.2 rounded transition-colors flex items-center gap-0.5"
                                title="Gunakan kalkulator timbangan untuk konversi berat ke pcs"
                              >
                                <span>⚖️ Timbang KG</span>
                              </button>
                            </div>
                            <input
                              type="number"
                              required
                              min="0"
                              value={physicalQtyInput}
                              onChange={(e) => setPhysicalQtyInput(e.target.value)}
                              className="w-full bg-slate-950 border border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono font-bold focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Live Variance Calculation */}
                        <div className="flex justify-between items-center bg-slate-950 p-2 rounded-lg text-xs font-mono">
                          <span className="text-slate-400 text-[11px]">Selisih (Variance):</span>
                          <span
                            className={`font-bold ${
                              parseInt(physicalQtyInput, 10) - scanResult.product.stock_system < 0
                                ? 'text-red-400'
                                : parseInt(physicalQtyInput, 10) - scanResult.product.stock_system > 0
                                ? 'text-emerald-400'
                                : 'text-slate-300'
                            }`}
                          >
                            {parseInt(physicalQtyInput || 0, 10) - scanResult.product.stock_system >= 0 ? '+' : ''}
                            {parseInt(physicalQtyInput || 0, 10) - scanResult.product.stock_system} pcs
                          </span>
                        </div>

                        <div>
                          <input
                            type="text"
                            value={countNoteInput}
                            onChange={(e) => setCountNoteInput(e.target.value)}
                            placeholder="Catatan kondisi (ex: karung utuh, 20 pcs berkarat)"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none"
                          />
                        </div>

                        {/* REMOTE PRINT & SAVE BUTTONS (RULE 2) */}
                        <div className="space-y-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              directPrintThermal({
                                barcode: scanResult.product.barcode,
                                productName: scanResult.product.name,
                                sku: scanResult.product.sku,
                                category: scanResult.product.category,
                                qty: physicalQtyInput,
                                rackCode: `${scanResult.product.warehouse_code} - ${scanResult.product.rack_code}`,
                                status: 'active',
                                targetPrinterId: selectedPrinterId,
                              })
                            }
                            className="w-full py-2 rounded-lg border border-purple-800/80 bg-purple-950/40 hover:bg-purple-900/50 text-purple-200 text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-colors shadow"
                            title="Remote print langsung dari tengah rak ke meja kantor atau meja operator"
                          >
                            <Icon name="printer" size={14} className="text-purple-400" />
                            <span>Remote Print ke {targetPrinter.name}</span>
                          </button>

                          <button
                            type="submit"
                            className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950 transition-colors"
                          >
                            <Icon name="check" size={14} />
                            Simpan Hasil Scan ke Data
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* PENDING Product Result */}
                  {scanResult && scanResult.status === 'PENDING' && (
                    <div className="rounded-2xl border border-amber-900/60 bg-amber-950/20 p-3.5 space-y-2 animate-fade-in">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-bold uppercase">
                          PROPOSAL PENDING
                        </span>
                        <span className="text-[10px] text-amber-400/80 font-mono">Menunggu Approval SPV</span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-100">{scanResult.product.name}</h4>
                      <div className="text-[11px] font-mono text-slate-400">
                        Lokasi: <b className="text-amber-300">{scanResult.product.proposed_location}</b> • Qty:{' '}
                        {scanResult.product.proposed_qty} pcs
                      </div>
                      <button
                        onClick={() =>
                          directPrintThermal({
                            barcode: scanResult.product.barcode,
                            productName: scanResult.product.name,
                            sku: scanResult.product.sku,
                            category: scanResult.product.category,
                            qty: scanResult.product.proposed_qty,
                            rackCode: scanResult.product.proposed_location,
                            status: 'pending',
                            targetPrinterId: selectedPrinterId,
                          })
                        }
                        className="w-full py-1.5 rounded-lg border border-amber-800 bg-amber-950/40 text-amber-300 hover:bg-amber-900/40 text-xs flex items-center justify-center gap-1.5 transition-colors font-mono font-bold"
                      >
                        <Icon name="printer" size={14} />
                        Cetak Ulang Draft ke {targetPrinter.name}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 2: FASTENER LOCATOR / CARI LOKASI BARANG (RULE 3) */}
          {/* ============================================================ */}
          {currentTab === 'locator' && (
            <div className="space-y-3 animate-fade-in">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                  <Icon name="search" size={15} className="text-blue-400" />
                  Pencarian Lokasi Barang di 11 Gudang
                </div>
                <input
                  type="text"
                  value={locatorSearch}
                  onChange={(e) => setLocatorSearch(e.target.value)}
                  placeholder="Ketik nama baut/mur, spesifikasi, atau SKU..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              {/* Locator Results */}
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {products
                  .filter((p) => {
                    if (!locatorSearch.trim()) return true;
                    const query = locatorSearch.toLowerCase();
                    return (
                      p.name.toLowerCase().includes(query) ||
                      p.sku.toLowerCase().includes(query) ||
                      p.barcode.includes(query) ||
                      (p.warehouse_code && p.warehouse_code.toLowerCase().includes(query))
                    );
                  })
                  .map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl border border-slate-800 bg-slate-900/80 space-y-2 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-blue-950 text-blue-300 border border-blue-900 font-bold">
                              {item.sku}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">{item.barcode}</span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-100 mt-1">{item.name}</h4>
                        </div>
                        <span
                          className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-bold ${
                            item.status === 'active'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>

                      {/* Location Badge */}
                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-850 grid grid-cols-2 gap-1 text-[10px] font-mono">
                        <div>
                          <span className="text-slate-500">Gudang:</span>{' '}
                          <b className="text-amber-400">{item.warehouse_code || '—'}</b>
                        </div>
                        <div>
                          <span className="text-slate-500">Rak:</span>{' '}
                          <b className="text-emerald-400">{item.rack_code || 'RAK-01'}</b>
                        </div>
                        <div className="col-span-2 text-slate-400">
                          Posisi: {item.shelf_tier || '—'} • Stok: <b>{item.stock_system} {item.unit || ''}</b>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setCurrentTab('scan');
                            handleScan(item.barcode);
                          }}
                          className="flex-1 py-1 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-[10px] font-bold font-mono transition-colors"
                        >
                          Pilih untuk Hitung Opname
                        </button>
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
                          className="px-2 py-1 rounded bg-purple-950 hover:bg-purple-900 border border-purple-800 text-purple-300 text-[10px] font-mono transition-colors"
                          title="Print remote ke meja kantor/operator"
                        >
                          <Icon name="printer" size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Handheld Device Bottom Bar */}
        <div className="bg-slate-900 p-2.5 border-t border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-400">
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            <span>Sync: {lastSyncTime}</span>
          </div>
          <button
            onClick={triggerWorkManagerSync}
            disabled={isSyncing || !isOnline}
            className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-bold disabled:opacity-40"
          >
            <Icon name="refresh" size={11} className={isSyncing ? 'animate-spin' : ''} />
            {isSyncing ? 'Syncing...' : 'WorkManager Sync'}
          </button>
        </div>
      </div>

      {/* Mode A Proposal Modal Popup */}
      {showProposalModal && (
        <ProposalModal
          barcode={proposalBarcode}
          onClose={() => setShowProposalModal(false)}
          onSuccess={(newProduct) => {
            setShowProposalModal(false);
            setSaveSuccessMsg(
              `✓ Proposal Mode A diajukan untuk "${newProduct.name}"! Status: PENDING (Label thermal terkirim ke ${targetPrinter.name}).`
            );
          }}
        />
      )}

      {/* Fastener Scale / Timbangan Calculator Modal Popup */}
      {showScaleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-emerald-500/50 rounded-2xl p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-base">⚖️</span>
                <h4 className="text-xs font-bold text-emerald-300 font-mono">
                  KALKULATOR TIMBANGAN FASTENER
                </h4>
              </div>
              <button
                onClick={() => setShowScaleModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <Icon name="x" size={16} />
              </button>
            </div>

            <div className="text-[11px] text-slate-400">
              Konversi otomatis berat timbangan ke estimasi Qty (Pcs/Set) untuk kemasan Karung / Peti kayu:
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div>
                <label className="block text-[10px] text-slate-300 mb-0.5">
                  1. Berat Total Kotor / Gross (Kg):
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Contoh: 30.5"
                  value={scaleGrossWeight}
                  onChange={(e) => setScaleGrossWeight(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">
                    Tare Kemasan (Kg):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={scaleTareWeight}
                    onChange={(e) => setScaleTareWeight(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-300 focus:outline-none"
                    title="Berat kosong karung (0.3-0.5 kg) atau peti (1.5-3 kg)"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">
                    Berat / 100 Pcs (Kg):
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={scaleWeightPer100Pcs}
                    onChange={(e) => setScaleWeightPer100Pcs(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-300 focus:outline-none"
                    title="Berat standar sampel 100 biji mur/baut"
                  />
                </div>
              </div>

              {/* Calculated Result */}
              {(() => {
                const gross = parseFloat(scaleGrossWeight) || 0;
                const tare = parseFloat(scaleTareWeight) || 0;
                const net = Math.max(0, gross - tare);
                const sample = parseFloat(scaleWeightPer100Pcs) || 1;
                const calculatedPcs = Math.round((net / sample) * 100);

                return (
                  <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/80 space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Berat Bersih (Netto):</span>
                      <span className="text-slate-200 font-bold">{net.toFixed(2)} Kg</span>
                    </div>
                    <div className="flex justify-between text-xs items-center pt-1 border-t border-emerald-900/60">
                      <span className="text-emerald-300 font-bold">Hasil Estimasi:</span>
                      <span className="text-base text-emerald-400 font-bold">
                        {calculatedPcs.toLocaleString()} PCS
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={calculatedPcs <= 0}
                      onClick={() => {
                        setPhysicalQtyInput(calculatedPcs.toString());
                        setCountNoteInput(`Dihitung Timbangan (Gross: ${gross}kg, Net: ${net.toFixed(2)}kg)`);
                        setShowScaleModal(false);
                      }}
                      className="w-full mt-2 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow"
                    >
                      <Icon name="check" size={14} />
                      Terapkan {calculatedPcs.toLocaleString()} Pcs ke Form
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
