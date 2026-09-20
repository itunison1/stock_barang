package com.unison.stockopname

import android.app.Activity
import android.app.AlertDialog
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.app.DownloadManager
import android.graphics.Color
import androidx.core.content.ContextCompat
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
    private var updateChecked = false
    private var updateDownloadId: Long? = null
    private var updateApkName: String? = null
    private val updateReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L) == updateDownloadId) {
                updateApkName?.let { (application as StockOpnameApp).container.updates.installDownloadedApk(this@DashboardActivity, it) }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_dashboard)
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            registerReceiver(updateReceiver, IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE), RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("DEPRECATION")
            registerReceiver(updateReceiver, IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE))
        }

        val app = application as StockOpnameApp
        checkForUpdate(app)
        val user = app.container.auth.currentUser()
        findViewById<LinearLayout>(R.id.cardAccounts).apply {
            visibility = if (user?.level == 1) View.VISIBLE else View.GONE
            setOnClickListener { startActivity(Intent(this@DashboardActivity, AccountManagementActivity::class.java)) }
        }
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
        val cardHowItWorks = findViewById<LinearLayout>(R.id.cardHowItWorks)

        // Operator Info
        textOperatorInfo.text = "Operator: ${user?.username ?: "-"} (${user?.division ?: "Gudang"})"

        // Logout
        btnLogout.setOnClickListener {
            AlertDialog.Builder(this, R.style.Theme_StockOpname_Dialog)
                .setTitle("Keluar Akun")
                .setMessage("Apakah Anda ingin keluar dari aplikasi?")
                .setPositiveButton("Ya, Keluar") { _, _ ->
                    app.container.auth.logout()
                    startActivity(Intent(this, LoginActivity::class.java))
                    finish()
                }
                .setNegativeButton("Batal", null)
                .create().also(::showReadableDialog)
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
        // Satu CTA saja untuk sesi aktif; hindari target navigasi ganda.
        cardResume.visibility = View.GONE
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

        // Card 9: Cara Kerja
        cardHowItWorks.setOnClickListener {
            showHowItWorksDialog()
        }
    }

    override fun onResume() {
        super.onResume()
        refreshActiveSession()
        refreshPendingBadge()
    }

    private fun refreshPendingBadge() {
        val app = application as StockOpnameApp
        val badge = findViewById<TextView>(R.id.badgePendingCount)
        scope.launch {
            val count = app.container.db.proposals().countPending()
            if (count > 0) {
                badge.text = if (count > 99) "99+" else count.toString()
                badge.visibility = View.VISIBLE
            } else {
                badge.visibility = View.GONE
            }
        }
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
            AlertDialog.Builder(this@DashboardActivity, R.style.Theme_StockOpname_Dialog)
                .setTitle("Riwayat Hitung Fisik (15 Terakhir)")
                .setMessage(message)
                .setPositiveButton("Tutup", null)
                .create().also(::showReadableDialog)
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
            AlertDialog.Builder(this@DashboardActivity, R.style.Theme_StockOpname_Dialog)
                .setTitle("Status Proposal Barang")
                .setMessage(message)
                .setPositiveButton("Tutup", null)
                .create().also(::showReadableDialog)
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
            AlertDialog.Builder(this@DashboardActivity, R.style.Theme_StockOpname_Dialog)
                .setTitle("Status Outbox Sinkronisasi")
                .setMessage(message)
                .setPositiveButton("Tutup", null)
                .create().also(::showReadableDialog)
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
        AlertDialog.Builder(this, R.style.Theme_StockOpname_Dialog)
            .setTitle("Pengaturan & Informasi Sistem")
            .setMessage(message)
            .setPositiveButton("Tutup", null)
            .create().also(::showReadableDialog)
    }

    private fun showHowItWorksDialog() {
        val operatorGuide = "TUGAS OPERATOR (Level 3):\n\n" +
            "1. SCAN — Arahkan kamera/scanner ke barcode barang. Sistem otomatis mencari nama barang di katalog.\n\n" +
            "2. HITUNG — Masukkan jumlah fisik yang Anda hitung di rak. Sistem otomatis membandingkan dengan stok sistem (Variance).\n\n" +
            "3. Kalau barcode TIDAK ditemukan di katalog — jangan lewati barang itu. Buat 'Proposal Temuan Fisik (Mode A)', wajib foto barang sebagai bukti. Ini menunggu persetujuan Supervisor, tidak langsung masuk ke stok resmi.\n\n" +
            "4. CETAK LABEL — Kalau butuh cetak ulang label yang rusak/hilang, isi barcode dan nama barang lalu kirim ke printer gudang. Nama barang & barcode otomatis terisi kalau Anda baru saja SCAN barang itu di sesi yang sama; kalau ganti HP atau sesi baru, isi/scan ulang.\n\n" +
            "5. SYNC — Data hitungan tersimpan dulu di HP (offline-safe). Tekan SYNC untuk kirim ke server pusat begitu ada sinyal. Jangan tutup app sebelum status 'Terkirim'.\n\n" +
            "6. Riwayat Hitung — daftar 15 hitungan terakhir yang Anda lakukan di HP ini (barang, qty, selisih, waktu). Hanya catatan lokal, bukan laporan resmi perusahaan."

        val supervisorGuide = "TUGAS SUPERVISOR (Level 2) & ADMIN (Level 1):\n\n" +
            "1. Status Persetujuan — pantau semua proposal barang baru dari operator (Mode A). Setiap proposal wajib ada foto bukti sebelum disetujui.\n\n" +
            "2. Persetujuan proposal SAAT INI dilakukan lewat Dashboard Web (bukan dari HP), supaya foto besar bisa diperiksa jelas dan tercatat siapa yang menyetujui.\n\n" +
            "3. Kelola Akun (khusus Admin) — tambah/nonaktifkan user, atur level akses: Admin bisa semua, Supervisor bisa lihat & putuskan proposal, Operator hanya scan & hitung.\n\n" +
            "4. Variance besar (selisih hitung fisik vs sistem jauh berbeda) harus dicek ulang sebelum disetujui — jangan asal approve.\n\n" +
            "5. Data 'DB Live (.159)' di menu Pengaturan bersifat Read-Only untuk semua orang — perubahan stok resmi hanya lewat proses opname yang sudah disetujui, bukan edit langsung."

        val istilah = "ISTILAH DI APLIKASI:\n\n" +
            "• Opname = kegiatan hitung ulang stok fisik di gudang.\n" +
            "• Variance = selisih antara stok sistem dan hasil hitung fisik.\n" +
            "• Proposal Mode A = usulan barang baru yang tidak ada di katalog, wajib foto + approval Supervisor.\n" +
            "• Draft/Pending = label sementara, belum resmi, dicetak sebelum proposal disetujui.\n" +
            "• Label Resmi = label final untuk barang yang statusnya sudah aktif di sistem.\n" +
            "• Sinkron (SYNC) = mengirim data offline dari HP ke server pusat."

        AlertDialog.Builder(this, R.style.Theme_StockOpname_Dialog)
            .setTitle("📖 Cara Kerja Aplikasi")
            .setMessage("$operatorGuide\n\n────────────\n\n$supervisorGuide\n\n────────────\n\n$istilah")
            .setPositiveButton("Tutup", null)
            .create().also(::showReadableDialog)
    }

    private fun showReadableDialog(dialog: AlertDialog) {
        dialog.setOnShowListener {
            val titleId = resources.getIdentifier("alertTitle", "id", "android")
            val textLight = ContextCompat.getColor(this, R.color.text_light)
            val textMuted = ContextCompat.getColor(this, R.color.text_muted)
            val brandBlue = ContextCompat.getColor(this, R.color.brand_orange)
            dialog.findViewById<TextView>(titleId)?.setTextColor(textLight)
            dialog.findViewById<TextView>(android.R.id.message)?.setTextColor(textMuted)
            dialog.getButton(AlertDialog.BUTTON_POSITIVE)?.setTextColor(brandBlue)
            dialog.getButton(AlertDialog.BUTTON_NEGATIVE)?.setTextColor(brandBlue)
            dialog.getButton(AlertDialog.BUTTON_NEUTRAL)?.setTextColor(brandBlue)
        }
        dialog.show()
    }

    private fun checkForUpdate(app: StockOpnameApp) {
        if (updateChecked) return
        updateChecked = true
        scope.launch {
            val info = app.container.updates.checkForUpdate(app.container.settings.baseUrl, BuildConfig.VERSION_CODE) ?: return@launch
            val dialog = AlertDialog.Builder(this@DashboardActivity, R.style.Theme_StockOpname_Dialog)
                .setTitle("Update v${info.versionName} tersedia")
                .setMessage(info.notes.ifBlank { "Versi aplikasi baru tersedia." })
                .setPositiveButton("Update sekarang") { _, _ ->
                    updateApkName = info.apkFileName
                    updateDownloadId = app.container.updates.enqueueDownload(this@DashboardActivity, app.container.settings.baseUrl, info)
                    Toast.makeText(this@DashboardActivity, "Update sedang diunduh", Toast.LENGTH_LONG).show()
                }
                .apply { if (!info.mandatory) setNegativeButton("Nanti", null) }
                .create()
            dialog.setCanceledOnTouchOutside(!info.mandatory)
            dialog.setCancelable(!info.mandatory)
            showReadableDialog(dialog)
        }
    }

    override fun onDestroy() {
        runCatching { unregisterReceiver(updateReceiver) }
        scope.cancel()
        super.onDestroy()
    }
}
