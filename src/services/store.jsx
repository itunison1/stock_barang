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

  // Live MySQL Database Bridge (192.168.1.140 via usr_android)
  const [liveDbStatus, setLiveDbStatus] = useState({
    connected: false,
    host: '192.168.1.140:3306',
    database: 'produksi',
    user: 'usr_android',
    total_items: null,
    total_users: null,
    checked: false,
  });

  // Mobile Device Local State (simulating Android Room DB + SharedPreferences + WorkManager)
  const [roomProducts, setRoomProducts] = useState([]); // Cached active products in Room
  const [currentRack, setCurrentRack] = useState(INITIAL_LOCATIONS[1]); // Default: U2 GUDANG2
  const [currentSession, setCurrentSession] = useState(INITIAL_STOCK_SESSIONS[0]);
  const [pendingSyncQueue, setPendingSyncQueue] = useState([]); // Room DB sync queue
  const [isOnline, setIsOnline] = useState(true); // Network toggle: Online vs Blind Spot
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(new Date().toLocaleTimeString());

  // Hardware & Peripheral Simulation (Remote Print Target)
  const [selectedPrinterId, setSelectedPrinterId] = useState(2); // Default: Printer Meja Kantor (192.168.1.140)
  const [activeThermalLabel, setActiveThermalLabel] = useState(null); // Thermal sticker modal
  const [printJobs, setPrintJobs] = useState([]);
  const [eventLogs, setEventLogs] = useState([
    {
      id: 'evt-1',
      time: new Date().toLocaleTimeString(),
      type: 'ROOM_DB',
      message: 'Room DB initialized for PT Unison Industrial Indonesia. Fasteners master cached.',
    },
    {
      id: 'evt-2',
      time: new Date().toLocaleTimeString(),
      type: 'PRINTER_SOCKET',
      message: 'Socket connection established to Printer Meja Kantor SPV (192.168.1.140:9100)',
    },
  ]);

  // Dynamic API URL Helper (supports Apache api.php on 192.168.1.140 and local server.js on 3001)
  const getApiUrl = (endpoint, params = {}) => {
    const isApacheHosted =
      typeof window !== 'undefined' &&
      (window.location.hostname === '192.168.1.140' || window.location.pathname.includes('/stock'));

    if (isApacheHosted) {
      const url = new URL('api.php', window.location.href);
      if (endpoint === 'status') url.searchParams.set('action', 'status');
      else if (endpoint === 'items') {
        url.searchParams.set('action', 'items');
        if (params.q) url.searchParams.set('q', params.q);
        if (params.limit) url.searchParams.set('limit', params.limit);
      } else if (endpoint === 'warehouses') {
        url.searchParams.set('action', 'warehouses');
      }
      return url.toString();
    }

    // Default to local Node server.js or Apache 192.168.1.140
    const base = 'http://localhost:3001';
    if (endpoint === 'status') return `${base}/api/status`;
    if (endpoint === 'items') return `${base}/api/items?q=${encodeURIComponent(params.q || '')}&limit=${params.limit || 30}`;
    if (endpoint === 'warehouses') return `${base}/api/warehouses`;
    return `${base}/api/${endpoint}`;
  };

  // Check Live MySQL Database Status on Mount
  useEffect(() => {
    const checkStatus = async () => {
      // Try local or apache
      const primaryUrl = getApiUrl('status');
      const fallbackUrl = 'http://192.168.1.140/stock_barang/api.php?action=status';

      try {
        const res = await fetch(primaryUrl).catch(() => fetch(fallbackUrl));
        const data = await res.json();
        if (data.connected) {
          setLiveDbStatus({
            connected: true,
            host: data.host,
            database: data.database,
            user: data.user,
            total_items: data.total_items,
            total_users: data.total_users,
            checked: true,
          });
          logEvent(
            'LIVE_DB',
            `Terhubung ke MySQL Server: ${data.database}@${data.host} (${data.total_items.toLocaleString()} item aktif) via usr_android`
          );
          return;
        }
      } catch {
        // Ignored
      }
      setLiveDbStatus((prev) => ({ ...prev, connected: false, checked: true }));
    };

    checkStatus();
  }, []);

  // Search Live Fasteners directly from MySQL database `produksi`
  const searchLiveItems = async (query = '', limit = 30) => {
    try {
      const primaryUrl = getApiUrl('items', { q: query, limit });
      const fallbackUrl = `http://192.168.1.140/stock_barang/api.php?action=items&q=${encodeURIComponent(query)}&limit=${limit}`;
      const res = await fetch(primaryUrl).catch(() => fetch(fallbackUrl));
      const json = await res.json();
      return json.success ? json.data : [];
    } catch {
      return [];
    }
  };

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
    logEvent('ROOM_DB', `Sync Master Berhasil: ${activeOnly.length} item fastener active diunduh ke Room DB lokal`);
    return true;
  };

  // Initial sync on startup
  useEffect(() => {
    syncMasterToDevice();
  }, [products]);

  // Step 2: Scan Rack / Location (Gudang)
  const scanRack = (rackCode) => {
    const loc = locations.find((l) => l.code.toUpperCase() === rackCode.toUpperCase().trim());
    if (!loc) {
      logEvent('SCAN_WARN', `Lokasi gudang tidak dikenali: ${rackCode}`);
      return { success: false, message: `Gudang "${rackCode}" tidak terdaftar di sistem PT Unison!` };
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
        warehouse_code: loc.code,
        operator_id: currentUser.id,
        started_at: new Date().toLocaleString(),
        finished_at: null,
        sync_status: isOnline ? 'synced' : 'local',
        device_id: 'ZEBRA-TC26-WMS-UNISON01',
        notes: `Opname ${loc.code} (${loc.zone})`,
      };
      setStockSessions((prev) => [newSession, ...prev]);
      setCurrentSession(newSession);
    }

    const assignedPrinter = printers.find((p) => p.id === loc.default_printer_id) || printers[0];
    logEvent(
      'SESSION_LOCK',
      `Sesi terkunci di ${loc.code} (${loc.zone}). Target socket default: ${assignedPrinter.name} (${assignedPrinter.ip}:${assignedPrinter.port})`
    );

    return { success: true, location: loc, printer: assignedPrinter };
  };

  // Step 3: Scan Product barcode (checks local Room DB first!)
  const scanProduct = (barcode) => {
    const cleanBarcode = barcode.trim();

    // Check in Room DB (cached master active)
    const activeProduct = roomProducts.find((p) => p.barcode === cleanBarcode);
    if (activeProduct) {
      logEvent('SCAN_SUCCESS', `Fastener terdaftar ditemukan di Room DB: ${activeProduct.name} [ACTIVE] di ${activeProduct.warehouse_code || 'Gudang'}`);
      return { status: 'ACTIVE', product: activeProduct };
    }

    // Check if it's already a pending proposal
    const pendingProduct = products.find((p) => p.barcode === cleanBarcode && p.status === 'pending');
    if (pendingProduct) {
      logEvent('SCAN_PENDING', `Fastener ini masih berstatus PENDING di antrian approval: ${pendingProduct.name}`);
      return { status: 'PENDING', product: pendingProduct };
    }

    // Check if it was previously rejected
    const rejectedProduct = products.find((p) => p.barcode === cleanBarcode && p.status === 'rejected');
    if (rejectedProduct) {
      logEvent('SCAN_REJECTED', `Fastener ini sebelumnya DITOLAK: ${rejectedProduct.rejection_reason}`);
      return { status: 'REJECTED', product: rejectedProduct };
    }

    // NOT FOUND -> Mode A Proposal Flow needed!
    logEvent('SCAN_UNREGISTERED', `Barcode ${cleanBarcode} TIDAK ditemukan di master! Memicu form Mode A Proposal...`);
    return { status: 'NOT_FOUND', barcode: cleanBarcode };
  };

  // Direct ESC/POS Thermal Print Simulator (Remote Print to Office / Desk / Portable via TCP:9100)
  const directPrintThermal = ({
    barcode,
    productName,
    sku,
    category,
    qty,
    rackCode,
    status = 'pending',
    targetPrinterId = null,
  }) => {
    const printerIdToUse = targetPrinterId || selectedPrinterId;
    const targetPrinter = printers.find((p) => p.id === Number(printerIdToUse)) || printers[0];

    const labelData = {
      id: `PRN-${Date.now()}`,
      barcode: barcode || '8992000000000',
      productName: productName || 'FASTENER PROPOSAL',
      sku: sku || `UNS-${Date.now().toString().slice(-4)}`,
      category: category || 'Fasteners',
      qty: qty || 100,
      rackCode: rackCode || currentRack?.code || 'U2 GUDANG2',
      operatorName: currentUser.name,
      printerName: targetPrinter.name,
      printerIp: `${targetPrinter.ip}:${targetPrinter.port}`,
      printerDesc: targetPrinter.location_desc,
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
      entity_id: targetPrinter.id,
      old_value: null,
      new_value: { printer: labelData.printerIp, printerName: targetPrinter.name, barcode: labelData.barcode, status },
      ip_address: '192.168.1.105',
      created_at: new Date().toLocaleString(),
      description: `Remote direct print dari lorong rak ke ${targetPrinter.name} (${targetPrinter.ip}:9100) tanpa hop server`,
    };
    setAuditLogs((prev) => [printAudit, ...prev]);

    logEvent(
      'PRINTER_SOCKET',
      `Direct ESC/POS socket dikirim ke ${targetPrinter.name} (${targetPrinter.ip}:9100) [Item: ${productName} - ${status.toUpperCase()}]`
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
      warehouse_code: currentRack?.code || prod.warehouse_code,
      rack_code: prod.rack_code || 'RAK-01',
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
      description: `Hitung fisik ${prod.name} di ${currentRack?.code}: Sistem ${qtySys}, Fisik ${qtyPhys}, Selisih ${variance >= 0 ? '+' : ''}${variance}`,
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
    proposedQty = 500,
    notes = '',
    locationCode = null,
  }) => {
    const newId = Date.now();
    const newSku = `UNS-PROP-${String(newId).slice(-4)}`;
    const warehouseToUse = locationCode || currentRack?.code || 'U2 GUDANG2';

    const newProposal = {
      id: newId,
      sku: newSku,
      barcode: barcode.trim(),
      name: name.trim(),
      description: description.trim() || 'Fastener baru ditemukan saat opname rak',
      category: category || 'Baut Hexagon',
      status: 'pending', // CRITICAL MODE A: Status strictly PENDING!
      photo_url:
        photoUrl ||
        'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400&q=80',
      stock_system: 0,
      proposed_qty: parseInt(proposedQty, 10) || 500,
      proposed_location: warehouseToUse,
      warehouse_code: warehouseToUse,
      rack_code: 'RAK-BARU-01',
      shelf_tier: 'Tingkat 1',
      created_by: currentUser.id,
      created_by_name: currentUser.name,
      approved_by: null,
      approved_at: null,
      rejection_reason: null,
      created_at: new Date().toLocaleString(),
      updated_at: new Date().toLocaleString(),
      notes,
    };

    // 1. Direct Print Label (Bisa langsung ke meja kantor atau meja operator!)
    directPrintThermal({
      barcode: newProposal.barcode,
      productName: newProposal.name,
      sku: newProposal.sku,
      category: newProposal.category,
      qty: newProposal.proposed_qty,
      rackCode: newProposal.warehouse_code,
      status: 'pending',
    });

    // 2. Save locally into database
    setProducts((prev) => [newProposal, ...prev]);

    // 3. Save to stock detail as pending reference
    const detailRecord = {
      id: Date.now() + 2,
      session_id: currentSession?.id || 1,
      product_id: newProposal.id,
      product_name: newProposal.name,
      barcode: newProposal.barcode,
      warehouse_code: warehouseToUse,
      rack_code: 'RAK-BARU-01',
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
        location: warehouseToUse,
      },
      ip_address: '192.168.1.105',
      created_at: new Date().toLocaleString(),
      description: `Operator mengajukan proposal mur/baut baru & cetak label sticker [PENDING] di ${warehouseToUse}`,
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
      logEvent('SYNC_SUCCESS', `WorkManager berhasil mengirim ${count} payload ke REST API Server (192.168.1.140).`);
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
      ip_address: '192.168.1.140',
      created_at: now,
      description: `Supervisor menyetujui proposal fastener "${prod.name}" (${prod.barcode}) -> STATUS RESMI ACTIVE, stok +${prod.proposed_qty}`,
    };
    setAuditLogs((prev) => [auditRecord, ...prev]);

    logEvent(
      'SPV_APPROVAL',
      `SUPERVISOR GATE PASSED: "${prod.name}" resmi ACTIVE. Dapat di-tracking di seluruh gudang!`
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
      rejection_reason: reason || 'Spesifikasi ulir / material tidak sesuai katalog',
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
      ip_address: '192.168.1.140',
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
          ? 'WiFi terhubung kembali. WorkManager siap sinkronisasi ke server 192.168.1.140.'
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
    setCurrentRack(INITIAL_LOCATIONS[1]);
    setCurrentSession(INITIAL_STOCK_SESSIONS[0]);
    setPendingSyncQueue([]);
    setIsOnline(true);
    setPrintJobs([]);
    setActiveThermalLabel(null);
    setSelectedPrinterId(2);
    logEvent('DB_RESET', 'Database dan antrian lokal PT Unison di-reset ke kondisi awal.');
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
        selectedPrinterId,
        setSelectedPrinterId,
        products,
        stockSessions,
        currentSession,
        stockDetails,
        auditLogs,
        liveDbStatus,
        searchLiveItems,

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
