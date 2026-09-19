import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  INITIAL_USERS,
  INITIAL_LOCATIONS,
  INITIAL_PRINTERS,
  INITIAL_PRODUCTS,
  INITIAL_STOCK_SESSIONS,
  INITIAL_STOCK_DETAILS,
  INITIAL_AUDIT_LOGS,
} from './mockData';

const WmsContext = createContext(null);

export const WmsProvider = ({ children }) => {
  // Database tables (simulating central company database)
  const [users, setUsers] = useState(INITIAL_USERS);
  const [currentUser, setCurrentUser] = useState(INITIAL_USERS[0]); // default: operator1
  const [locations, setLocations] = useState(INITIAL_LOCATIONS);
  const [printers, setPrinters] = useState(INITIAL_PRINTERS);
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [stockSessions, setStockSessions] = useState(INITIAL_STOCK_SESSIONS);
  const [stockDetails, setStockDetails] = useState(INITIAL_STOCK_DETAILS);
  const [auditLogs, setAuditLogs] = useState(INITIAL_AUDIT_LOGS);

  // Mobile Device Local State (simulating Android Room DB + SharedPreferences + WorkManager)
  const [roomProducts, setRoomProducts] = useState([]); // Cached active products in Room
  const [currentRack, setCurrentRack] = useState(INITIAL_LOCATIONS[0]); // Current locked rack
  const [currentSession, setCurrentSession] = useState(INITIAL_STOCK_SESSIONS[0]);
  const [pendingSyncQueue, setPendingSyncQueue] = useState([]); // Room DB sync queue
  const [isOnline, setIsOnline] = useState(true); // Network toggle: Online vs Blind Spot
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(new Date().toLocaleTimeString());

  // Hardware & Peripheral Simulation
  const [activeThermalLabel, setActiveThermalLabel] = useState(null); // Thermal sticker modal
  const [printJobs, setPrintJobs] = useState([]);
  const [eventLogs, setEventLogs] = useState([
    {
      id: 'evt-1',
      time: new Date().toLocaleTimeString(),
      type: 'ROOM_DB',
      message: 'Room DB initialized on Android device. 4 active products cached.',
    },
    {
      id: 'evt-2',
      time: new Date().toLocaleTimeString(),
      type: 'PRINTER_SOCKET',
      message: 'Socket connection established to Thermal LAN 192.168.1.50:9100',
    },
  ]);

  // Push an event log to the real-time inspector
  const logEvent = (type, message, data = null) => {
    const newLog = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      time: new Date().toLocaleTimeString(),
      type,
      message,
      data,
    };
    setEventLogs((prev) => [newLog, ...prev.slice(0, 49)]); // keep last 50
  };

  // Step 1: Sync active master to device Room DB
  const syncMasterToDevice = () => {
    if (!isOnline) {
      logEvent('NETWORK_ERR', 'Gagal sync master: Perangkat sedang offline (blind spot)');
      return false;
    }
    const activeOnly = products.filter((p) => p.status === 'active');
    setRoomProducts(activeOnly);
    setLastSyncTime(new Date().toLocaleTimeString());
    logEvent('ROOM_DB', `Sync Master Berhasil: ${activeOnly.length} barang active diunduh ke Room DB lokal`);
    return true;
  };

  // Initial sync on startup
  useEffect(() => {
    syncMasterToDevice();
  }, [products]);

  // Step 2: Scan Rack / Location
  const scanRack = (rackCode) => {
    const loc = locations.find((l) => l.code.toUpperCase() === rackCode.toUpperCase().trim());
    if (!loc) {
      logEvent('SCAN_WARN', `Lokasi rak tidak dikenali: ${rackCode}`);
      return { success: false, message: `Rak "${rackCode}" tidak terdaftar di sistem!` };
    }

    setCurrentRack(loc);

    // Create or assign stock session for this rack
    const existingSession = stockSessions.find(
      (s) => s.location_id === loc.id && s.operator_id === currentUser.id && !s.finished_at
    );

    if (existingSession) {
      setCurrentSession(existingSession);
    } else {
      const newSession = {
        id: Date.now(),
        location_id: loc.id,
        operator_id: currentUser.id,
        started_at: new Date().toLocaleString(),
        finished_at: null,
        sync_status: isOnline ? 'synced' : 'local',
        device_id: 'ZEBRA-TC26-WMS-01',
        notes: `Opname ${loc.code}`,
      };
      setStockSessions((prev) => [newSession, ...prev]);
      setCurrentSession(newSession);
    }

    const assignedPrinter = printers.find((p) => p.id === loc.default_printer_id) || printers[0];
    logEvent(
      'SESSION_LOCK',
      `Sesi terkunci di ${loc.code} (${loc.zone}). Default printer socket: ${assignedPrinter.ip}:${assignedPrinter.port}`
    );

    return { success: true, location: loc, printer: assignedPrinter };
  };

  // Step 3: Scan Product barcode (checks local Room DB first!)
  const scanProduct = (barcode) => {
    const cleanBarcode = barcode.trim();

    // Check in Room DB (cached master active)
    const activeProduct = roomProducts.find((p) => p.barcode === cleanBarcode);
    if (activeProduct) {
      logEvent('SCAN_SUCCESS', `Barang terdaftar ditemukan di Room DB: ${activeProduct.name} [ACTIVE]`);
      return { status: 'ACTIVE', product: activeProduct };
    }

    // Check if it's already a pending proposal
    const pendingProduct = products.find((p) => p.barcode === cleanBarcode && p.status === 'pending');
    if (pendingProduct) {
      logEvent('SCAN_PENDING', `Barang ini masih berstatus PENDING di antrian approval: ${pendingProduct.name}`);
      return { status: 'PENDING', product: pendingProduct };
    }

    // Check if it was previously rejected
    const rejectedProduct = products.find((p) => p.barcode === cleanBarcode && p.status === 'rejected');
    if (rejectedProduct) {
      logEvent('SCAN_REJECTED', `Barang ini sebelumnya DITOLAK: ${rejectedProduct.rejection_reason}`);
      return { status: 'REJECTED', product: rejectedProduct };
    }

    // NOT FOUND -> Mode A Proposal Flow needed!
    logEvent('SCAN_UNREGISTERED', `Barcode ${cleanBarcode} TIDAK ditemukan di master! Memicu form Mode A Proposal...`);
    return { status: 'NOT_FOUND', barcode: cleanBarcode };
  };

  // Direct ESC/POS Thermal Print Simulator (HP -> Thermal Printer directly via TCP:9100)
  const directPrintThermal = ({
    barcode,
    productName,
    sku,
    category,
    qty,
    rackCode,
    status = 'pending',
  }) => {
    const assignedPrinter = printers.find((p) => p.location_id === currentRack?.id) || printers[0];

    const labelData = {
      id: `PRN-${Date.now()}`,
      barcode: barcode || '8990000000000',
      productName: productName || 'BARANG PROPOSAL',
      sku: sku || `SKU-${Date.now().toString().slice(-4)}`,
      category: category || 'General',
      qty: qty || 1,
      rackCode: rackCode || currentRack?.code || 'RAK-A-01',
      operatorName: currentUser.name,
      printerIp: `${assignedPrinter.ip}:${assignedPrinter.port}`,
      printedAt: new Date().toLocaleString(),
      status: status, // 'pending' or 'active'
      rawEscPosHex: `1B 40 1B 61 01 1D 6B 04 ${barcode} 00 1D 56 00`,
    };

    setPrintJobs((prev) => [labelData, ...prev]);
    setActiveThermalLabel(labelData);

    // Record audit log for direct print
    const printAudit = {
      id: Date.now() + Math.random(),
      user_id: currentUser.id,
      user_name: currentUser.name,
      action: 'print',
      entity_type: 'printer_socket',
      entity_id: assignedPrinter.id,
      old_value: null,
      new_value: { printer: labelData.printerIp, barcode: labelData.barcode, status },
      ip_address: '192.168.1.105',
      created_at: new Date().toLocaleString(),
      description: `Direct TCP:9100 Print ke ${assignedPrinter.name} (${assignedPrinter.ip}) tanpa hop server`,
    };
    setAuditLogs((prev) => [printAudit, ...prev]);

    logEvent(
      'PRINTER_SOCKET',
      `Direct ESC/POS socket bytes sent to ${assignedPrinter.ip}:9100 [Label: ${productName} - ${status.toUpperCase()}]`
    );

    return labelData;
  };

  // Step 4: Input physical quantity for existing active product
  const saveStockCount = (productId, physicalQty, note = '') => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    const qtySys = prod.stock_system;
    const qtyPhys = parseInt(physicalQty, 10) || 0;
    const variance = qtyPhys - qtySys;

    const detailRecord = {
      id: Date.now(),
      session_id: currentSession.id,
      product_id: prod.id,
      product_name: prod.name,
      barcode: prod.barcode,
      qty_system: qtySys,
      qty_physical: qtyPhys,
      variance,
      note,
      created_at: new Date().toLocaleString(),
      sync_status: isOnline ? 'synced' : 'local',
    };

    setStockDetails((prev) => [detailRecord, ...prev]);

    if (!isOnline) {
      setPendingSyncQueue((prev) => [
        ...prev,
        { type: 'STOCK_COUNT', data: detailRecord, timestamp: new Date().toLocaleString() },
      ]);
    }

    // Audit log
    const countAudit = {
      id: Date.now() + 1,
      user_id: currentUser.id,
      user_name: currentUser.name,
      action: 'stock_count',
      entity_type: 'stock_details',
      entity_id: detailRecord.id,
      old_value: { qty_system: qtySys },
      new_value: { qty_physical: qtyPhys, variance, note },
      ip_address: '192.168.1.105',
      created_at: new Date().toLocaleString(),
      description: `Hitung stok ${prod.name}: Sistem ${qtySys}, Fisik ${qtyPhys}, Selisih ${variance >= 0 ? '+' : ''}${variance}`,
    };
    setAuditLogs((prev) => [countAudit, ...prev]);

    logEvent(
      'STOCK_COUNT',
      `Stok ${prod.name} disimpan: Fisik=${qtyPhys}, Sistem=${qtySys}, Selisih=${variance}`
    );

    return detailRecord;
  };

  // Step 5: Mode A Proposal Creation (Barang Tidak Ditemukan -> PENDING)
  const createProposal = ({
    barcode,
    name,
    category,
    description = '',
    photoUrl = null,
    proposedQty = 1,
    notes = '',
  }) => {
    const newId = Date.now();
    const newSku = `SKU-P${String(newId).slice(-4)}`;

    const newProposal = {
      id: newId,
      sku: newSku,
      barcode: barcode.trim(),
      name: name.trim(),
      description: description.trim() || 'Barang baru ditemukan saat opname rak',
      category: category || 'Umum',
      status: 'pending', // CRITICAL MODE A: Status strictly PENDING!
      photo_url:
        photoUrl ||
        'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80',
      stock_system: 0,
      proposed_qty: parseInt(proposedQty, 10) || 1,
      proposed_location: currentRack?.code || 'RAK-A-01',
      created_by: currentUser.id,
      created_by_name: currentUser.name,
      approved_by: null,
      approved_at: null,
      rejection_reason: null,
      created_at: new Date().toLocaleString(),
      updated_at: new Date().toLocaleString(),
      notes,
    };

    // 1. Direct Print Label (Sticker fisik tertempel di kardus langsung di lorong rak)
    directPrintThermal({
      barcode: newProposal.barcode,
      productName: newProposal.name,
      sku: newProposal.sku,
      category: newProposal.category,
      qty: newProposal.proposed_qty,
      rackCode: currentRack?.code,
      status: 'pending',
    });

    // 2. Save locally into database
    setProducts((prev) => [newProposal, ...prev]);

    // 3. Save to stock detail as pending reference (not counted in official stock yet)
    const detailRecord = {
      id: Date.now() + 2,
      session_id: currentSession?.id || 1,
      product_id: newProposal.id,
      product_name: newProposal.name,
      barcode: newProposal.barcode,
      qty_system: 0,
      qty_physical: newProposal.proposed_qty,
      variance: newProposal.proposed_qty,
      note: `[PROPOSAL PENDING] ${notes}`,
      created_at: new Date().toLocaleString(),
      sync_status: isOnline ? 'synced' : 'local',
    };
    setStockDetails((prev) => [detailRecord, ...prev]);

    // 4. If offline, push to Room DB sync queue
    if (!isOnline) {
      setPendingSyncQueue((prev) => [
        ...prev,
        { type: 'PROPOSAL_NEW', data: newProposal, timestamp: new Date().toLocaleString() },
      ]);
    }

    // 5. Audit Log
    const auditRecord = {
      id: Date.now() + 3,
      user_id: currentUser.id,
      user_name: currentUser.name,
      action: 'create_proposal',
      entity_type: 'product',
      entity_id: newProposal.id,
      old_value: null,
      new_value: {
        barcode: newProposal.barcode,
        name: newProposal.name,
        status: 'pending',
        proposed_qty: newProposal.proposed_qty,
        location: currentRack?.code,
      },
      ip_address: '192.168.1.105',
      created_at: new Date().toLocaleString(),
      description: `Operator membuat proposal barang baru & cetak label sticker [PENDING] di ${currentRack?.code}`,
    };
    setAuditLogs((prev) => [auditRecord, ...prev]);

    logEvent(
      'PROPOSAL_CREATED',
      `Proposal dibuat: "${newProposal.name}" (${newProposal.barcode}) [STATUS: PENDING] -> Menunggu Approval SPV`
    );

    return newProposal;
  };

  // Step 6: Simulated WorkManager Sync (Room DB -> Server REST API)
  const triggerWorkManagerSync = () => {
    if (!isOnline) {
      logEvent('SYNC_WARN', 'WorkManager dicegah: Kondisi perangkat OFFLINE (Blind spot)');
      return;
    }

    if (pendingSyncQueue.length === 0) {
      logEvent('SYNC_INFO', 'WorkManager check: Semua data lokal sudah tersinkronisasi');
      return;
    }

    setIsSyncing(true);
    logEvent(
      'WORKMANAGER_RUN',
      `WorkManager mengeksekusi background sync untuk ${pendingSyncQueue.length} antrian lokal...`
    );

    setTimeout(() => {
      setStockDetails((prev) => prev.map((d) => ({ ...d, sync_status: 'synced' })));
      setStockSessions((prev) => prev.map((s) => ({ ...s, sync_status: 'synced' })));
      const count = pendingSyncQueue.length;
      setPendingSyncQueue([]);
      setIsSyncing(false);
      setLastSyncTime(new Date().toLocaleTimeString());
      logEvent('SYNC_SUCCESS', `WorkManager berhasil mengirim ${count} payload ke REST API Server.`);
    }, 1200);
  };

  // Step 7 & 8: Supervisor Approval Gate (APPROVE / REJECT)
  const approveProposal = (productId) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    const now = new Date().toLocaleString();
    const supervisor = users.find((u) => u.role === 'supervisor') || currentUser;

    const updatedProduct = {
      ...prod,
      status: 'active', // Gate passed! Now active
      approved_by: supervisor.id,
      approved_by_name: supervisor.name,
      approved_at: now,
      stock_system: prod.proposed_qty || prod.stock_system,
      updated_at: now,
    };

    setProducts((prev) => prev.map((p) => (p.id === productId ? updatedProduct : p)));

    // Update Room DB active cache if online
    setRoomProducts((prev) => [updatedProduct, ...prev.filter((p) => p.id !== productId)]);

    // Audit Log
    const auditRecord = {
      id: Date.now(),
      user_id: supervisor.id,
      user_name: supervisor.name,
      action: 'approve',
      entity_type: 'product',
      entity_id: prod.id,
      old_value: { status: 'pending' },
      new_value: { status: 'active', stock_system: updatedProduct.stock_system },
      ip_address: '192.168.1.20',
      created_at: now,
      description: `Supervisor menyetujui proposal "${prod.name}" (${prod.barcode}) -> STATUS RESMI ACTIVE, stok +${prod.proposed_qty}`,
    };
    setAuditLogs((prev) => [auditRecord, ...prev]);

    logEvent(
      'SPV_APPROVAL',
      `SUPERVISOR GATE PASSED: "${prod.name}" resmi ACTIVE. Dapat di-tracking di seluruh HP!`
    );

    return updatedProduct;
  };

  const rejectProposal = (productId, reason) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    const now = new Date().toLocaleString();
    const supervisor = users.find((u) => u.role === 'supervisor') || currentUser;

    const updatedProduct = {
      ...prod,
      status: 'rejected',
      approved_by: supervisor.id,
      approved_by_name: supervisor.name,
      approved_at: now,
      rejection_reason: reason || 'Tidak sesuai spesifikasi gudang resmi',
      updated_at: now,
    };

    setProducts((prev) => prev.map((p) => (p.id === productId ? updatedProduct : p)));

    // Audit Log
    const auditRecord = {
      id: Date.now(),
      user_id: supervisor.id,
      user_name: supervisor.name,
      action: 'reject',
      entity_type: 'product',
      entity_id: prod.id,
      old_value: { status: 'pending' },
      new_value: { status: 'rejected', rejection_reason: updatedProduct.rejection_reason },
      ip_address: '192.168.1.20',
      created_at: now,
      description: `Supervisor MENOLAK proposal "${prod.name}". Alasan: "${updatedProduct.rejection_reason}"`,
    };
    setAuditLogs((prev) => [auditRecord, ...prev]);

    logEvent(
      'SPV_REJECTION',
      `SUPERVISOR REJECTED: "${prod.name}" ditolak. Alasan: ${updatedProduct.rejection_reason}`
    );

    return updatedProduct;
  };

  // Toggle Network Online / Offline
  const toggleNetwork = () => {
    setIsOnline((prev) => {
      const next = !prev;
      logEvent(
        'NETWORK_TOGGLE',
        next
          ? 'WiFi terhubung kembali. WorkManager siap sinkronisasi.'
          : 'WiFi terputus! Mode Offline (Blind Spot) aktif. Semua aksi disimpan di Room DB.'
      );
      if (next) {
        setTimeout(triggerWorkManagerSync, 500);
      }
      return next;
    });
  };

  // Switch User / Role
  const switchUser = (userId) => {
    const u = users.find((item) => item.id === Number(userId));
    if (u) {
      setCurrentUser(u);
      logEvent('AUTH_CHANGE', `Berganti pengguna aktif: ${u.name} (${u.role.toUpperCase()})`);
    }
  };

  // Reset database to initial seed
  const resetDatabase = () => {
    setUsers(INITIAL_USERS);
    setCurrentUser(INITIAL_USERS[0]);
    setLocations(INITIAL_LOCATIONS);
    setPrinters(INITIAL_PRINTERS);
    setProducts(INITIAL_PRODUCTS);
    setStockSessions(INITIAL_STOCK_SESSIONS);
    setStockDetails(INITIAL_STOCK_DETAILS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setRoomProducts(INITIAL_PRODUCTS.filter((p) => p.status === 'active'));
    setCurrentRack(INITIAL_LOCATIONS[0]);
    setCurrentSession(INITIAL_STOCK_SESSIONS[0]);
    setPendingSyncQueue([]);
    setIsOnline(true);
    setPrintJobs([]);
    setActiveThermalLabel(null);
    logEvent('DB_RESET', 'Database dan antrian lokal di-reset ke kondisi awal (Initial Seed).');
  };

  return (
    <WmsContext.Provider
      value={{
        // DB tables
        users,
        currentUser,
        switchUser,
        locations,
        currentRack,
        printers,
        products,
        stockSessions,
        currentSession,
        stockDetails,
        auditLogs,

        // Mobile / Offline State
        roomProducts,
        pendingSyncQueue,
        isOnline,
        isSyncing,
        lastSyncTime,
        toggleNetwork,
        syncMasterToDevice,
        triggerWorkManagerSync,

        // Step Actions
        scanRack,
        scanProduct,
        saveStockCount,
        createProposal,
        directPrintThermal,

        // Supervisor Actions
        approveProposal,
        rejectProposal,

        // Hardware & Log Inspector
        activeThermalLabel,
        setActiveThermalLabel,
        printJobs,
        eventLogs,
        logEvent,
        resetDatabase,
      }}
    >
      {children}
    </WmsContext.Provider>
  );
};

export const useWms = () => {
  const context = useContext(WmsContext);
  if (!context) {
    throw new Error('useWms must be used within a WmsProvider');
  }
  return context;
};
