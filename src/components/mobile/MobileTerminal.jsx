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
  } = useWms();

  // Workflow step: 1 = scan rack, 2 = scan products & count
  const [currentStep, setCurrentStep] = useState(1);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanResult, setScanResult] = useState(null); // { status, product, barcode }
  const [physicalQtyInput, setPhysicalQtyInput] = useState('');
  const [countNoteInput, setCountNoteInput] = useState('');
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [proposalBarcode, setProposalBarcode] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Handle barcode submission (from input or quick buttons)
  const handleScan = (codeToScan) => {
    const code = (codeToScan || barcodeInput).trim();
    if (!code) return;

    setSaveSuccessMsg('');

    // If on Step 1 (Scan Rak)
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

    // If on Step 2 (Scan Product)
    const result = scanProduct(code);
    setBarcodeInput('');

    if (result.status === 'NOT_FOUND') {
      setProposalBarcode(code);
      setShowProposalModal(true);
      setScanResult(null);
    } else if (result.status === 'ACTIVE') {
      setScanResult(result);
      setPhysicalQtyInput(result.product.stock_system.toString());
      setCountNoteInput('');
    } else if (result.status === 'PENDING') {
      setScanResult(result);
      setPhysicalQtyInput((result.product.proposed_qty || 1).toString());
      setCountNoteInput('Barang proposal pending');
    } else if (result.status === 'REJECTED') {
      alert(`Barcode ${code} DITOLAK: ${result.product.rejection_reason}`);
    }
  };

  // Submit physical count for active product
  const handleSaveCount = (e) => {
    e.preventDefault();
    if (!scanResult || !scanResult.product) return;

    const saved = saveStockCount(scanResult.product.id, physicalQtyInput, countNoteInput);
    setSaveSuccessMsg(
      `✓ Hitung fisik ${scanResult.product.name} disimpan (${saved.qty_physical} pcs, selisih ${saved.variance >= 0 ? '+' : ''}${saved.variance})`
    );
    setScanResult(null);
    setPhysicalQtyInput('');
    setCountNoteInput('');
  };

  return (
    <div className="relative mx-auto w-full max-w-[390px] rounded-[38px] p-3 bg-slate-900 border-[6px] border-slate-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] flex flex-col min-h-[720px]">
      {/* Enterprise Handheld Device Notch & Speaker */}
      <div className="flex items-center justify-between px-6 pt-1 pb-2">
        <div className="text-[10px] font-mono text-slate-500 font-bold tracking-widest">ZEBRA TC26</div>
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
                Room DB: {roomProducts.length} master cached
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

        {/* Locked Rack Bar */}
        <div className="bg-slate-900/40 px-3 py-1.5 border-b border-slate-800/80 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5">
            <Icon name="mapPin" size={13} className="text-blue-400 shrink-0" />
            <span className="text-slate-400 font-mono">Lokasi Rak:</span>
            <span className="font-mono font-bold text-emerald-400">{currentRack?.code || 'Belum Terkunci'}</span>
          </div>
          {currentStep === 2 && (
            <button
              onClick={() => {
                setCurrentStep(1);
                setScanResult(null);
              }}
              className="text-[10px] text-blue-400 hover:text-blue-300 font-mono underline"
            >
              Ganti Rak
            </button>
          )}
        </div>

        {/* Main Operational Workflow Screen */}
        <div className="flex-1 p-3 overflow-y-auto space-y-3">
          {/* Step Indicator Tabs */}
          <div className="grid grid-cols-2 gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[10px] font-mono">
            <button
              onClick={() => setCurrentStep(1)}
              className={`py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 transition-colors ${
                currentStep === 1 ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>1.</span> Scan Lokasi Rak
            </button>
            <button
              onClick={() => {
                if (currentRack) setCurrentStep(2);
                else alert('Silakan scan lokasi rak terlebih dahulu!');
              }}
              className={`py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 transition-colors ${
                currentStep === 2 ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>2.</span> Scan & Hitung Barang
            </button>
          </div>

          {/* STEP 1: SCAN RACK */}
          {currentStep === 1 && (
            <div className="space-y-3 animate-fade-in">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3.5 text-center">
                <div className="h-12 w-12 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center mx-auto mb-2">
                  <Icon name="layers" size={24} />
                </div>
                <h3 className="text-xs font-bold text-slate-100">Scan Barcode / QR Rak</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Arahkan scanner ke label kode rak untuk memulai sesi opname lorong ini.
                </p>
              </div>

              {/* Input Barcode Manual / Scanner Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleScan();
                }}
                className="space-y-2"
              >
                <div className="relative">
                  <input
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    placeholder="Ketik / Scan kode rak (ex: RAK-A-01)"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono uppercase"
                  />
                  <button
                    type="submit"
                    className="absolute right-1.5 top-1.5 bottom-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1 transition-colors"
                  >
                    <Icon name="scan" size={13} />
                    Kunci
                  </button>
                </div>
              </form>

              {/* Quick Presets for Rak */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[10px] font-mono text-slate-400">Quick Scan Lokasi Rak:</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {QUICK_BARCODES.filter((b) => b.type === 'rack').map((b) => (
                    <button
                      key={b.barcode}
                      onClick={() => handleScan(b.barcode)}
                      className="p-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-blue-500/50 text-left transition-colors"
                    >
                      <div className="text-[11px] font-mono font-bold text-blue-300">{b.barcode}</div>
                      <div className="text-[9px] text-slate-400 truncate">{b.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: SCAN PRODUCTS & COUNT */}
          {currentStep === 2 && (
            <div className="space-y-3 animate-fade-in">
              {/* Simulated Scanner Viewfinder */}
              <div className="relative rounded-2xl border border-blue-900/50 bg-slate-900/80 p-3 overflow-hidden shadow-inner">
                {/* Laser animation bar */}
                <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_#ef4444] animate-pulse top-1/2 -translate-y-1/2 pointer-events-none" />

                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-blue-300 flex items-center gap-1">
                    <Icon name="scan" size={12} /> ML KIT SCANNER READY
                  </span>
                  <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-900">
                    DIRECT TCP:9100 READY
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
                    placeholder="Scan barcode produk (EAN13 / Code128)"
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

              {/* Quick Presets for Products */}
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-slate-400 flex justify-between">
                  <span>Simulasi Scan Barcode:</span>
                  <span className="text-amber-400 text-[9px]">*Klik merah untuk uji Mode A</span>
                </div>
                <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
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

              {/* Success Notification */}
              {saveSuccessMsg && (
                <div className="p-2.5 rounded-xl bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
                  <Icon name="checkCircle" size={16} className="shrink-0 text-emerald-400" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              {/* Result: ACTIVE Product Found Form */}
              {scanResult && scanResult.status === 'ACTIVE' && (
                <div className="rounded-2xl border border-emerald-900/60 bg-gradient-to-b from-emerald-950/20 to-slate-900 p-3.5 space-y-3 animate-fade-in">
                  <div className="flex gap-3">
                    <img
                      src={scanResult.product.photo_url}
                      alt={scanResult.product.name}
                      className="w-16 h-16 rounded-xl object-cover border border-slate-700 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                          TERDAFTAR RESMI
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 truncate">
                          {scanResult.product.sku}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-100 leading-tight mt-1 truncate">
                        {scanResult.product.name}
                      </h4>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                        Stok Sistem: <b className="text-blue-300">{scanResult.product.stock_system} pcs</b>
                      </div>
                    </div>
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
                          value={`${scanResult.product.stock_system} pcs`}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-400 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-emerald-300 font-bold mb-0.5">
                          Qty Fisik (Hitung) *
                        </label>
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
                        placeholder="Catatan (ex: 2 pcs rusak)"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          directPrintThermal({
                            barcode: scanResult.product.barcode,
                            productName: scanResult.product.name,
                            sku: scanResult.product.sku,
                            category: scanResult.product.category,
                            qty: physicalQtyInput,
                            rackCode: currentRack?.code,
                            status: 'active',
                          })
                        }
                        className="px-2.5 py-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:text-white text-xs flex items-center gap-1 transition-colors"
                        title="Re-print sticker label rak"
                      >
                        <Icon name="printer" size={14} />
                      </button>
                      <button
                        type="submit"
                        className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950 transition-colors"
                      >
                        <Icon name="check" size={14} />
                        Simpan Hasil Hitung
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Result: PENDING Product Found */}
              {scanResult && scanResult.status === 'PENDING' && (
                <div className="rounded-2xl border border-amber-900/60 bg-amber-950/20 p-3.5 space-y-2 animate-fade-in">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-bold uppercase">
                      PROPOSAL PENDING
                    </span>
                    <span className="text-[10px] text-amber-400/80 font-mono">Menunggu Approval SPV</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-100">{scanResult.product.name}</h4>
                  <p className="text-[11px] text-slate-400">
                    Barang ini sudah diajukan sebagai proposal dan label sticker draft sudah dicetak. Stok resmi
                    akan diperbarui begitu disetujui Supervisor di web dashboard.
                  </p>
                  <button
                    onClick={() =>
                      directPrintThermal({
                        barcode: scanResult.product.barcode,
                        productName: scanResult.product.name,
                        sku: scanResult.product.sku,
                        category: scanResult.product.category,
                        qty: scanResult.product.proposed_qty,
                        rackCode: currentRack?.code,
                        status: 'pending',
                      })
                    }
                    className="w-full py-1.5 rounded-lg border border-amber-800 bg-amber-950/40 text-amber-300 hover:bg-amber-900/40 text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Icon name="printer" size={14} />
                    Cetak Ulang Label Draft (TCP:9100)
                  </button>
                </div>
              )}
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
              `✓ Proposal Mode A berhasil dibuat untuk "${newProduct.name}"! Status: PENDING (Label sticker draft otomatis tercetak).`
            );
          }}
        />
      )}
    </div>
  );
};
