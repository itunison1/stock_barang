package com.unison.stockopname

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import com.unison.stockopname.data.db.OutboxStatus
import com.unison.stockopname.data.db.SessionEntity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class DashboardActivity : Activity() {
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private var activeSession: SessionEntity? = null
    private var activeWarehouseName: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_dashboard)

        val app = application as StockOpnameApp
        val user = app.container.auth.currentUser()
        val textOperatorInfo = findViewById<TextView>(R.id.textOperatorInfo)
        val btnLogout = findViewById<Button>(R.id.btnLogout)

        val textSessionHeader = findViewById<TextView>(R.id.textSessionHeader)
        val textSessionWarehouse = findViewById<TextView>(R.id.textSessionWarehouse)
        val textSessionDetail = findViewById<TextView>(R.id.textSessionDetail)
        val btnQuickActionSession = findViewById<Button>(R.id.btnQuickActionSession)

        val cardWarehouse = findViewById<LinearLayout>(R.id.cardWarehouse)
        val cardResume = findViewById<LinearLayout>(R.id.cardResume)
        val textResumeSubtitle = findViewById<TextView>(R.id.textResumeSubtitle)
        val cardScan = findViewById<LinearLayout>(R.id.cardScan)
        val cardSync = findViewById<LinearLayout>(R.id.cardSync)
        val badgePendingOutbox = findViewById<TextView>(R.id.badgePendingOutbox)
        val textOutboxStatus = findViewById<TextView>(R.id.textOutboxStatus)
        val cardHistory = findViewById<LinearLayout>(R.id.cardHistory)
        val cardApproval = findViewById<LinearLayout>(R.id.cardApproval)
        val cardPrint = findViewById<LinearLayout>(R.id.cardPrint)
        val cardSettings = findViewById<LinearLayout>(R.id.cardSettings)

        // Operator Info
        textOperatorInfo.text = "Operator: ${user?.username ?: "-"} (${user?.division ?: "Gudang"})"

        // Logout
        btnLogout.setOnClickListener {
            AlertDialog.Builder(this)
                .setTitle("Keluar Akun")
                .setMessage("Apakah Anda ingin keluar dari aplikasi?")
                .setPositiveButton("Ya, Keluar") { _, _ ->
                    app.container.auth.logout()
                    startActivity(Intent(this, LoginActivity::class.java))
                    finish()
                }
                .setNegativeButton("Batal", null)
                .show()
        }

        // Observasi Outbox Flow
        scope.launch {
            app.container.db.outbox().observePending().collectLatest { count ->
                badgePendingOutbox.text = "$count pending"
                if (count > 0) {
                    badgePendingOutbox.setBackgroundResource(R.drawable.bg_card_warning)
                    textOutboxStatus.text = "$count data menunggu kirim"
                } else {
                    badgePendingOutbox.setBackgroundResource(R.drawable.bg_badge_active)
                    textOutboxStatus.text = "Semua data tersinkron"
                }
            }
        }

        // Card 1: Mulai Opname / Pilih Gudang
        cardWarehouse.setOnClickListener {
            startActivity(Intent(this, WarehouseActivity::class.java))
        }

        // Card 2: Lanjutkan Sesi
        val onResumeSession = View.OnClickListener {
            val session = activeSession
            if (session != null && activeWarehouseName != null) {
                val intent = Intent(this, SessionActivity::class.java).apply {
                    putExtra("warehouse_code", session.warehouseCode)
                    putExtra("warehouse_name", activeWarehouseName)
                    putExtra("initial_tab", 0)
                }
                startActivity(intent)
            } else {
                Toast.makeText(this, "Belum ada sesi aktif. Silakan pilih gudang.", Toast.LENGTH_SHORT).show()
                startActivity(Intent(this, WarehouseActivity::class.java))
            }
        }
        cardResume.setOnClickListener(onResumeSession)
        btnQuickActionSession.setOnClickListener(onResumeSession)

        // Card 3: Scan Barang
        cardScan.setOnClickListener {
            val session = activeSession
            if (session != null && activeWarehouseName != null) {
                val intent = Intent(this, SessionActivity::class.java).apply {
                    putExtra("warehouse_code", session.warehouseCode)
                    putExtra("warehouse_name", activeWarehouseName)
                    putExtra("initial_tab", 0)
                    putExtra("start_camera", true)
                }
                startActivity(intent)
            } else {
                Toast.makeText(this, "Pilih gudang terlebih dahulu sebelum scan barang.", Toast.LENGTH_SHORT).show()
                startActivity(Intent(this, WarehouseActivity::class.java))
            }
        }

        // Card 4: Data Belum Sinkron
        cardSync.setOnClickListener {
            val session = activeSession
            if (session != null && activeWarehouseName != null) {
                val intent = Intent(this, SessionActivity::class.java).apply {
                    putExtra("warehouse_code", session.warehouseCode)
                    putExtra("warehouse_name", activeWarehouseName)
                    putExtra("initial_tab", 3)
                }
                startActivity(intent)
            } else {
                showOutboxDialog(app)
            }
        }

        // Card 5: Riwayat Hitung
        cardHistory.setOnClickListener {
            showHistoryDialog(app)
        }

        // Card 6: Status Persetujuan
        cardApproval.setOnClickListener {
            val session = activeSession
            if (session != null && activeWarehouseName != null) {
                val intent = Intent(this, SessionActivity::class.java).apply {
                    putExtra("warehouse_code", session.warehouseCode)
                    putExtra("warehouse_name", activeWarehouseName)
                    putExtra("initial_tab", 1)
                }
                startActivity(intent)
            } else {
                showProposalsDialog(app)
            }
        }

        // Card 7: Cetak Label
        cardPrint.setOnClickListener {
            val session = activeSession
            if (session != null && activeWarehouseName != null) {
                val intent = Intent(this, SessionActivity::class.java).apply {
                    putExtra("warehouse_code", session.warehouseCode)
                    putExtra("warehouse_name", activeWarehouseName)
                    putExtra("initial_tab", 2)
                }
                startActivity(intent)
            } else {
                Toast.makeText(this, "Pilih gudang terlebih dahulu untuk mencetak label sesi.", Toast.LENGTH_SHORT).show()
                startActivity(Intent(this, WarehouseActivity::class.java))
            }
        }

        // Card 8: Pengaturan
        cardSettings.setOnClickListener {
            showSettingsDialog(app)
        }
    }

    override fun onResume() {
        super.onResume()
        refreshActiveSession()
    }

    private fun refreshActiveSession() {
        val app = application as StockOpnameApp
        val username = app.container.auth.currentUser()?.username ?: return
        val textSessionHeader = findViewById<TextView>(R.id.textSessionHeader)
        val textSessionWarehouse = findViewById<TextView>(R.id.textSessionWarehouse)
        val textSessionDetail = findViewById<TextView>(R.id.textSessionDetail)
        val btnQuickActionSession = findViewById<Button>(R.id.btnQuickActionSession)
        val textResumeSubtitle = findViewById<TextView>(R.id.textResumeSubtitle)

        scope.launch {
            val session = app.container.db.sessions().findActive(username)
            activeSession = session
            if (session != null) {
                val wh = app.container.db.warehouses().findByCode(session.warehouseCode)
                activeWarehouseName = wh?.name ?: session.warehouseCode
                textSessionHeader.text = "SESI OPNAME AKTIF"
                textSessionWarehouse.text = "${session.warehouseCode} — $activeWarehouseName"
                val sdf = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
                textSessionDetail.text = "Terkunci sejak ${sdf.format(Date(session.startedAt))}"
                btnQuickActionSession.text = "Lanjutkan Sesi di ${session.warehouseCode}"
                textResumeSubtitle.text = "Gudang: ${session.warehouseCode}"
            } else {
                activeWarehouseName = null
                textSessionHeader.text = "STATUS SESI OPNAME"
                textSessionWarehouse.text = "Belum ada sesi aktif"
                textSessionDetail.text = "Pilih gudang untuk memulai penghitungan fisik."
                btnQuickActionSession.text = "Pilih Lokasi Gudang"
                textResumeSubtitle.text = "Belum ada sesi aktif"
            }
        }
    }

    private fun showHistoryDialog(app: StockOpnameApp) {
        scope.launch {
            val counts = app.container.db.counts().recentCounts()
            val message = if (counts.isEmpty()) {
                "Belum ada riwayat hitung fisik di perangkat ini."
            } else {
                val sdf = SimpleDateFormat("dd/MM HH:mm", Locale.getDefault())
                counts.take(15).joinToString("\n\n") { c ->
                    "[${c.warehouseCode}] ${c.itemCode} - ${c.itemName}\n" +
                    "Fisik: ${c.qtyPhysical} | Sistem: ${c.qtySystem} | Var: ${c.variance} (${sdf.format(Date(c.createdAtDevice))})"
                }
            }
            AlertDialog.Builder(this@DashboardActivity)
                .setTitle("Riwayat Hitung Fisik (15 Terakhir)")
                .setMessage(message)
                .setPositiveButton("Tutup", null)
                .show()
        }
    }

    private fun showProposalsDialog(app: StockOpnameApp) {
        scope.launch {
            val proposals = app.container.db.proposals().recentProposals()
            val message = if (proposals.isEmpty()) {
                "Belum ada proposal barang baru yang dicatat pada perangkat ini.\n\nAlur: Proposal dibuat di Tab Proposal dengan foto fisik wajib ber-watermark. Approval resmi diproses SPV di Web Dashboard."
            } else {
                proposals.take(15).joinToString("\n\n") { p ->
                    "${p.barcode} - ${p.name}\n" +
                    "Qty: ${p.proposedQty} | Status: ${p.status.uppercase()}\n" +
                    if (p.rejectionReason != null) "Alasan: ${p.rejectionReason}" else "Menunggu verifikasi SPV"
                }
            }
            AlertDialog.Builder(this@DashboardActivity)
                .setTitle("Status Proposal Barang")
                .setMessage(message)
                .setPositiveButton("Tutup", null)
                .show()
        }
    }

    private fun showOutboxDialog(app: StockOpnameApp) {
        scope.launch {
            val outbox = app.container.db.outbox().all()
            val pending = outbox.count { it.status == OutboxStatus.PENDING }
            val failed = outbox.count { it.status == OutboxStatus.FAILED }
            val sent = outbox.count { it.status == OutboxStatus.SENT }
            val message = "Antrean Sinkronisasi Outbox:\n\n" +
                "• Pending: $pending record\n" +
                "• Gagal: $failed record\n" +
                "• Terkirim: $sent record\n\n" +
                "Sync berjalan otomatis di background lewat WorkManager ketika terhubung jaringan staging."
            AlertDialog.Builder(this@DashboardActivity)
                .setTitle("Status Outbox Sinkronisasi")
                .setMessage(message)
                .setPositiveButton("Tutup", null)
                .show()
        }
    }

    private fun showSettingsDialog(app: StockOpnameApp) {
        val user = app.container.auth.currentUser()
        val settings = app.container.settings
        val message = "INFORMASI SISTEM & STAGING:\n\n" +
            "• Versi App: v${BuildConfig.VERSION_NAME} (code ${BuildConfig.VERSION_CODE})\n" +
            "• Base URL: ${settings.baseUrl}\n" +
            "• Target Database: 192.168.1.140:3306/stockopname_test\n" +
            "• DB Live (.159): Dilindungi (Read-Only)\n" +
            "• Operator: ${user?.username ?: "-"} (Level ${user?.level ?: 0})\n" +
            "• Scanner: CameraX + ML Kit (Barcode 1D/2D)\n" +
            "• Target Perangkat: Android 10+ (Zebra TC26 & Handphone)"
        AlertDialog.Builder(this)
            .setTitle("Pengaturan & Informasi Sistem")
            .setMessage(message)
            .setPositiveButton("Tutup", null)
            .show()
    }

    override fun onDestroy() {
        super.onDestroy()
        scope.cancel()
    }
}
