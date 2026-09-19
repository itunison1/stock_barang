/**
 * Backend API Bridge — PT Unison Industrial Indonesia
 * Menghubungkan aplikasi web ke Database MySQL `produksi` di 192.168.1.159 / 192.168.1.140
 * Kredensial: user 'usr_android' / pass 'zUNSprod'
 */

import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Database Connection Pool
const pool = mysql.createPool({
  host: '192.168.1.159',
  user: 'usr_android',
  password: 'zUNSprod',
  database: 'produksi',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 5000,
});

// 1. Health & Server Status Endpoint
app.get('/api/status', async (req, res) => {
  try {
    const [countResult] = await pool.query('SELECT COUNT(*) as total_items FROM item');
    const [userCount] = await pool.query('SELECT COUNT(*) as total_users FROM user_produksi WHERE user_aktif = 1');
    res.json({
      status: 'ONLINE',
      connected: true,
      host: '192.168.1.159:3306',
      database: 'produksi',
      user: 'usr_android',
      total_items: countResult[0].total_items,
      total_users: userCount[0].total_users,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      connected: false,
      message: error.message,
    });
  }
});

// 2. Search Live Fastener Items
app.get('/api/items', async (req, res) => {
  try {
    const q = req.query.q || req.query.search || '';
    const limit = parseInt(req.query.limit || 50, 10);
    const warehouse = req.query.warehouse || '';

    let query = 'SELECT id, ITCODE, ITNAME, STOCK, UNIT, PRICE, WCODE, PACK, ISI FROM item WHERE 1=1';
    const params = [];

    if (q) {
      query += ' AND (ITCODE LIKE ? OR ITNAME LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }

    if (warehouse && warehouse !== 'ALL') {
      query += ' AND (WCODE LIKE ? OR WCODE IS NOT NULL)';
      params.push(`%${warehouse}%`);
    }

    query += ' ORDER BY ITCODE ASC LIMIT ?';
    params.push(limit);

    const [rows] = await pool.query(query, params);
    
    // Map to WMS product model
    const mapped = rows.map((r) => ({
      id: r.id,
      sku: r.ITCODE,
      barcode: r.ITCODE, // ITCODE is used as scan barcode
      name: r.ITNAME,
      category: r.ITNAME.includes('MUR') ? 'Mur / Nut' : (r.ITNAME.includes('BAUT') ? 'Baut / Bolt' : 'Fasteners'),
      stock_system: parseFloat(r.STOCK) || 0,
      unit: r.UNIT || 'PCS',
      pack: r.PACK || 'DUS',
      isi_per_pack: parseFloat(r.ISI) || 1,
      warehouse_code: r.WCODE || 'U2 GUDANG2',
      rack_code: null,
      shelf_tier: null,
      status: 'active',
      price: parseFloat(r.PRICE) || 0,
      is_live_db: true,
    }));

    res.json({ success: true, count: mapped.length, data: mapped });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Get Locations / Warehouses from wip_lokasi_m
app.get('/api/warehouses', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT kode, nama, active, type, packing_default FROM wip_lokasi_m WHERE active = 1 ORDER BY no_urut ASC'
    );
    res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Get Single Item by Code / Barcode
app.get('/api/item/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const [rows] = await pool.query(
      'SELECT id, ITCODE, ITNAME, STOCK, UNIT, PRICE, WCODE, PACK, ISI FROM item WHERE ITCODE = ? OR ITNAME = ? LIMIT 1',
      [code, code]
    );

    if (rows.length > 0) {
      const r = rows[0];
      const item = {
        id: r.id,
        sku: r.ITCODE,
        barcode: r.ITCODE,
        name: r.ITNAME,
        category: r.ITNAME.includes('MUR') ? 'Mur / Nut' : (r.ITNAME.includes('BAUT') ? 'Baut / Bolt' : 'Fasteners'),
        stock_system: parseFloat(r.STOCK) || 0,
        unit: r.UNIT || 'PCS',
        pack: r.PACK || 'DUS',
        isi_per_pack: parseFloat(r.ISI) || 1,
        warehouse_code: r.WCODE || 'U2 GUDANG2',
        rack_code: null,
        shelf_tier: null,
        status: 'active',
        price: parseFloat(r.PRICE) || 0,
        is_live_db: true,
      };
      res.json({ success: true, found: true, item });
    } else {
      res.json({ success: true, found: false, message: 'Item tidak ditemukan di tabel item' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Get Users from user_produksi
app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT iduser, username, user_divisi, user_level, user_aktif, last_login_at FROM user_produksi WHERE user_aktif = 1 ORDER BY iduser ASC'
    );
    res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`PT Unison WMS Backend API Bridge running on http://localhost:${PORT}`);
});
