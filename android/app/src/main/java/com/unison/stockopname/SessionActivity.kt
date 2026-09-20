package com.unison.stockopname

import android.Manifest
import android.app.AlertDialog
import androidx.activity.ComponentActivity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.MediaStore
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.BaseAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import androidx.camera.view.PreviewView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.unison.stockopname.data.db.CountEntity
import com.unison.stockopname.data.db.ItemEntity
import com.unison.stockopname.data.db.OutboxEntity
import com.unison.stockopname.data.db.OutboxStatus
import com.unison.stockopname.data.db.PrinterEntity
import com.unison.stockopname.data.db.ProposalEntity
import com.unison.stockopname.data.db.SessionEntity
import com.unison.stockopname.data.printer.EscPosBuilder
import com.unison.stockopname.data.printer.LabelData
import com.unison.stockopname.data.printer.PaperWidth
import com.unison.stockopname.data.printer.PrinterSeeds
import com.unison.stockopname.data.repo.Hashing
import com.unison.stockopname.data.repo.MasterSyncResult
import com.unison.stockopname.data.repo.SaveCountResult
import com.unison.stockopname.data.repo.ScanOutcome
import com.unison.stockopname.data.repo.ScanResult
import com.unison.stockopname.domain.DuplicateAction
import com.unison.stockopname.domain.VarianceCalculator
import com.unison.stockopname.domain.WatermarkSpec
import com.unison.stockopname.sync.SyncOutcome
import com.unison.stockopname.util.CameraBarcodeScanner
import com.unison.stockopname.util.Watermarker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.max

class SessionActivity : ComponentActivity() {

    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    private var warehouseCode: String = ""
    private var warehouseName: String = ""
    private var currentSession: SessionEntity? = null

    // State
    private var currentScanResult: ScanResult? = null
    private var currentScanItem: ItemEntity? = null
    private var currentPhysicalQty: Int = 0
    private var currentInputSource: String = "MANUAL"
    private var currentPhotoFile: File? = null
    private var photoCaptureUri: Uri? = null

    // Top Header
    private lateinit var textActiveWarehouse: TextView
    private lateinit var textActiveOperator: TextView
    private lateinit var btnEndSession: Button
    private lateinit var btnLogout: Button

    // Outbox Banner
    private lateinit var layoutOutboxBanner: LinearLayout
    private lateinit var textOutboxBanner: TextView
    private lateinit var btnQuickSync: Button

    // Tabs
    private lateinit var btnTabScan: Button
    private lateinit var btnTabProposal: Button
    private lateinit var btnTabPrint: Button
    private lateinit var btnTabSync: Button

    private lateinit var tabContentScan: LinearLayout
    private lateinit var tabContentProposal: LinearLayout
    private lateinit var tabContentPrint: LinearLayout
    private lateinit var tabContentSync: LinearLayout

    // TAB 1 Views
    private lateinit var radioGroupOpnameMode: RadioGroup
    private lateinit var radioModeSku: RadioButton
    private lateinit var radioModeSloc: RadioButton
    private lateinit var textScanSource: TextView
    private lateinit var inputBarcode: EditText
    private lateinit var btnScanManual: Button
    private lateinit var btnScanCamera: Button
    private lateinit var cameraPreviewContainer: FrameLayout
    private lateinit var previewView: PreviewView
    private lateinit var progressScan: ProgressBar
    private var cameraScanner: CameraBarcodeScanner? = null

    private lateinit var cardFoundItem: LinearLayout
    private lateinit var textFoundItemCode: TextView
    private lateinit var textFoundItemName: TextView
    private lateinit var textFoundItemDetails: TextView
    private lateinit var cardMisplacement: LinearLayout
    private lateinit var textMisplacement: TextView
    private lateinit var btnMinus10: Button
    private lateinit var btnMinus1: Button
    private lateinit var inputQtyPhysical: EditText
    private lateinit var btnPlus1: Button
    private lateinit var btnPlus10: Button
    private lateinit var textVariance: TextView
    private lateinit var inputRack: EditText
    private lateinit var inputCountNote: EditText
    private lateinit var btnSaveCount: Button
    private lateinit var btnPrintCountLabel: Button

    private lateinit var cardNotFound: LinearLayout
    private lateinit var textNotFoundMsg: TextView
    private lateinit var btnCreateProposal: Button

    private lateinit var cardPending: LinearLayout
    private lateinit var textPendingMsg: TextView
    private lateinit var btnPrintPendingDraft: Button

    private lateinit var cardRejected: LinearLayout
    private lateinit var textRejectedMsg: TextView
    private lateinit var btnRecreateProposal: Button

    // TAB 2 Views (Proposal)
    private lateinit var inputPropBarcode: EditText
    private lateinit var inputPropName: EditText
    private lateinit var spinnerPropCategory: Spinner
    private lateinit var inputPropQty: EditText
    private lateinit var inputPropNotes: EditText
    private lateinit var btnCapturePhoto: Button
    private lateinit var imagePropPreview: ImageView
    private lateinit var textPropPhotoStatus: TextView
    private lateinit var btnSubmitProposal: Button
    private lateinit var btnPrintDraftProposal: Button

    // TAB 3 Views (Print)
    private lateinit var spinnerPrinters: Spinner
    private lateinit var inputPrintHost: EditText
    private lateinit var inputPrintPort: EditText
    private lateinit var textPrinterStatus: TextView
    private lateinit var dotPrinterStatus: View
    private lateinit var btnCheckPrinter: Button
    private lateinit var inputPrintBarcode: EditText
    private lateinit var inputPrintName: EditText
    private lateinit var inputPrintQty: EditText
    private lateinit var radioGroupLabelType: RadioGroup
    private lateinit var radioPrintOfficial: RadioButton
    private lateinit var radioPrintPending: RadioButton
    private lateinit var btnPrintExecute: Button
    private lateinit var textPrintFeedback: TextView
    private var availablePrinters: List<PrinterEntity> = emptyList()

    // TAB 4 Views (Sync)
    private lateinit var textOutboxSummary: TextView
    private lateinit var btnTriggerSync: Button
    private lateinit var btnRetryFailed: Button
    private lateinit var textMasterSummary: TextView
    private lateinit var btnSyncMaster: Button
    private lateinit var progressMasterSync: ProgressBar
    private lateinit var textMasterFeedback: TextView
    private lateinit var layoutOutboxList: LinearLayout

    // Zebra DataWedge BroadcastReceiver
    private val dataWedgeReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent == null) return
            val action = intent.action.orEmpty()
            val barcode = intent.getStringExtra("com.symbol.datawedge.data_string")
                ?: intent.getStringExtra("data_string")
                ?: intent.getStringExtra("barcode")
                ?: intent.getStringExtra("com.symbol.datawedge.data")

            if (!barcode.isNullOrBlank()) {
                currentInputSource = "DATAWEDGE"
                inputBarcode.setText(barcode.trim())
                doScanLookup(barcode.trim(), "DATAWEDGE")
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_session)

        warehouseCode = intent.getStringExtra("warehouse_code").orEmpty()
        warehouseName = intent.getStringExtra("warehouse_name").orEmpty()

        initViews()
        setupListeners()
        setupPrinters()

        val initialTab = intent.getIntExtra("initial_tab", 0)
        if (initialTab in 0..3) {
            switchTab(initialTab)
        }

        val app = application as StockOpnameApp
        val operator = app.container.auth.currentUser()?.username ?: "operator"
        textActiveOperator.text = "Operator: $operator"
        textActiveWarehouse.text = if (warehouseName.isNotEmpty()) "$warehouseCode — $warehouseName" else warehouseCode

        // Ensure session exists
        scope.launch {
            app.container.ensurePrintersSeeded()
            var session = app.container.db.sessions().findOpen(operator, warehouseCode)
            if (session == null) {
                val lockResult = app.container.sessions.lock(operator, warehouseCode)
                if (lockResult is com.unison.stockopname.data.repo.LockResult.Locked) {
                    session = lockResult.session
                }
            }
            currentSession = session
            refreshOutboxStatus()
            refreshMasterStatus()
        }
    }

    private fun initViews() {
        textActiveWarehouse = findViewById(R.id.textActiveWarehouse)
        textActiveOperator = findViewById(R.id.textActiveOperator)
        btnEndSession = findViewById(R.id.btnEndSession)
        btnLogout = findViewById(R.id.btnLogout)

        layoutOutboxBanner = findViewById(R.id.layoutOutboxBanner)
        textOutboxBanner = findViewById(R.id.textOutboxBanner)
        btnQuickSync = findViewById(R.id.btnQuickSync)

        btnTabScan = findViewById(R.id.btnTabScan)
        btnTabProposal = findViewById(R.id.btnTabProposal)
        btnTabPrint = findViewById(R.id.btnTabPrint)
        btnTabSync = findViewById(R.id.btnTabSync)

        tabContentScan = findViewById(R.id.tabContentScan)
        tabContentProposal = findViewById(R.id.tabContentProposal)
        tabContentPrint = findViewById(R.id.tabContentPrint)
        tabContentSync = findViewById(R.id.tabContentSync)

        // TAB 1
        radioGroupOpnameMode = findViewById(R.id.radioGroupOpnameMode)
        radioModeSku = findViewById(R.id.radioModeSku)
        radioModeSloc = findViewById(R.id.radioModeSloc)
        textScanSource = findViewById(R.id.textScanSource)
        inputBarcode = findViewById(R.id.inputBarcode)
        btnScanManual = findViewById(R.id.btnScanManual)
        btnScanCamera = findViewById(R.id.btnScanCamera)
        cameraPreviewContainer = findViewById(R.id.cameraPreviewContainer)
        previewView = findViewById(R.id.previewView)
        progressScan = findViewById(R.id.progressScan)

        cardFoundItem = findViewById(R.id.cardFoundItem)
        textFoundItemCode = findViewById(R.id.textFoundItemCode)
        textFoundItemName = findViewById(R.id.textFoundItemName)
        textFoundItemDetails = findViewById(R.id.textFoundItemDetails)
        cardMisplacement = findViewById(R.id.cardMisplacement)
        textMisplacement = findViewById(R.id.textMisplacement)
        btnMinus10 = findViewById(R.id.btnMinus10)
        btnMinus1 = findViewById(R.id.btnMinus1)
        inputQtyPhysical = findViewById(R.id.inputQtyPhysical)
        btnPlus1 = findViewById(R.id.btnPlus1)
        btnPlus10 = findViewById(R.id.btnPlus10)
        textVariance = findViewById(R.id.textVariance)
        inputRack = findViewById(R.id.inputRack)
        inputCountNote = findViewById(R.id.inputCountNote)
        btnSaveCount = findViewById(R.id.btnSaveCount)
        btnPrintCountLabel = findViewById(R.id.btnPrintCountLabel)

        cardNotFound = findViewById(R.id.cardNotFound)
        textNotFoundMsg = findViewById(R.id.textNotFoundMsg)
        btnCreateProposal = findViewById(R.id.btnCreateProposal)

        cardPending = findViewById(R.id.cardPending)
        textPendingMsg = findViewById(R.id.textPendingMsg)
        btnPrintPendingDraft = findViewById(R.id.btnPrintPendingDraft)

        cardRejected = findViewById(R.id.cardRejected)
        textRejectedMsg = findViewById(R.id.textRejectedMsg)
        btnRecreateProposal = findViewById(R.id.btnRecreateProposal)

        // TAB 2
        inputPropBarcode = findViewById(R.id.inputPropBarcode)
        inputPropName = findViewById(R.id.inputPropName)
        spinnerPropCategory = findViewById(R.id.spinnerPropCategory)
        inputPropQty = findViewById(R.id.inputPropQty)
        inputPropNotes = findViewById(R.id.inputPropNotes)
        btnCapturePhoto = findViewById(R.id.btnCapturePhoto)
        imagePropPreview = findViewById(R.id.imagePropPreview)
        textPropPhotoStatus = findViewById(R.id.textPropPhotoStatus)
        btnSubmitProposal = findViewById(R.id.btnSubmitProposal)
        btnPrintDraftProposal = findViewById(R.id.btnPrintDraftProposal)

        val categories = arrayOf("Baut", "Mur", "Ring / Washer", "Sekrup", "Anchor", "Lainnya")
        spinnerPropCategory.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, categories)

        // TAB 3
        spinnerPrinters = findViewById(R.id.spinnerPrinters)
        inputPrintHost = findViewById(R.id.inputPrintHost)
        inputPrintPort = findViewById(R.id.inputPrintPort)
        textPrinterStatus = findViewById(R.id.textPrinterStatus)
        dotPrinterStatus = findViewById(R.id.dotPrinterStatus)
        btnCheckPrinter = findViewById(R.id.btnCheckPrinter)
        inputPrintBarcode = findViewById(R.id.inputPrintBarcode)
        inputPrintName = findViewById(R.id.inputPrintName)
        inputPrintQty = findViewById(R.id.inputPrintQty)
        radioGroupLabelType = findViewById(R.id.radioGroupLabelType)
        radioPrintOfficial = findViewById(R.id.radioPrintOfficial)
        radioPrintPending = findViewById(R.id.radioPrintPending)
        btnPrintExecute = findViewById(R.id.btnPrintExecute)
        textPrintFeedback = findViewById(R.id.textPrintFeedback)

        // TAB 4
        textOutboxSummary = findViewById(R.id.textOutboxSummary)
        btnTriggerSync = findViewById(R.id.btnTriggerSync)
        btnRetryFailed = findViewById(R.id.btnRetryFailed)
        textMasterSummary = findViewById(R.id.textMasterSummary)
        btnSyncMaster = findViewById(R.id.btnSyncMaster)
        progressMasterSync = findViewById(R.id.progressMasterSync)
        textMasterFeedback = findViewById(R.id.textMasterFeedback)
        layoutOutboxList = findViewById(R.id.layoutOutboxList)
    }

    private fun setupListeners() {
        // Tab Switching
        btnTabScan.setOnClickListener { switchTab(0) }
        btnTabProposal.setOnClickListener { switchTab(1) }
        btnTabPrint.setOnClickListener { switchTab(2) }
        btnTabSync.setOnClickListener { switchTab(3) }

        // Mode Opname Switch (SKU vs SLOC)
        radioGroupOpnameMode.setOnCheckedChangeListener { _, checkedId ->
            if (checkedId == R.id.radioModeSloc) {
                inputRack.hint = "Lokasi / Kode Rak (SLOC) - WAJIB DIISI"
                inputRack.requestFocus()
            } else {
                inputRack.hint = "Lokasi / Kode Rak (opsional)"
            }
        }

        // Quick Sync from Banner
        btnQuickSync.setOnClickListener {
            switchTab(3)
            triggerOutboxSync()
        }

        // Manual Scan
        btnScanManual.setOnClickListener {
            val code = inputBarcode.text.toString().trim()
            if (code.isNotEmpty()) {
                currentInputSource = "MANUAL"
                doScanLookup(code, "MANUAL")
            } else {
                Toast.makeText(this, "Masukkan kode barcode", Toast.LENGTH_SHORT).show()
            }
        }

        btnScanCamera.setOnClickListener {
            if (cameraScanner?.isScanning == true) stopCameraScanner() else requestCameraScanner()
        }

        inputBarcode.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_DONE || actionId == EditorInfo.IME_ACTION_SEARCH) {
                val code = inputBarcode.text.toString().trim()
                if (code.isNotEmpty()) {
                    currentInputSource = "MANUAL"
                    doScanLookup(code, "MANUAL")
                }
                true
            } else false
        }

        // Qty Physical +/- controls
        btnMinus10.setOnClickListener { adjustPhysicalQty(-10) }
        btnMinus1.setOnClickListener { adjustPhysicalQty(-1) }
        btnPlus1.setOnClickListener { adjustPhysicalQty(1) }
        btnPlus10.setOnClickListener { adjustPhysicalQty(10) }

        inputQtyPhysical.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                val parsed = s?.toString()?.toIntOrNull() ?: 0
                currentPhysicalQty = max(0, parsed)
                updateVarianceDisplay()
            }
        })

        // Save Count Button
        btnSaveCount.setOnClickListener {
            saveCurrentCount(action = null)
        }

        // Print Count Label Button
        btnPrintCountLabel.setOnClickListener {
            val item = currentScanItem ?: return@setOnClickListener
            inputPrintBarcode.setText(item.itemCode)
            inputPrintName.setText(item.itemName)
            inputPrintQty.setText(currentPhysicalQty.toString())
            radioPrintOfficial.isChecked = true
            switchTab(2)
        }

        // From Scan -> Create Proposal
        btnCreateProposal.setOnClickListener {
            val raw = inputBarcode.text.toString().trim()
            inputPropBarcode.setText(raw)
            inputPropQty.setText("1")
            switchTab(1)
        }

        btnRecreateProposal.setOnClickListener {
            val raw = inputBarcode.text.toString().trim()
            inputPropBarcode.setText(raw)
            switchTab(1)
        }

        btnPrintPendingDraft.setOnClickListener {
            inputPrintBarcode.setText(inputBarcode.text.toString().trim())
            radioPrintPending.isChecked = true
            switchTab(2)
        }

        // Proposal Tab: Camera & Photo
        btnCapturePhoto.setOnClickListener {
            checkAndLaunchCamera()
        }

        btnSubmitProposal.setOnClickListener {
            submitProposal()
        }

        // Print Tab: Execute Print
        btnPrintExecute.setOnClickListener {
            executePrint()
        }

        btnCheckPrinter.setOnClickListener {
            checkPrinterConnection()
        }

        // Sync Tab: Manual Outbox Sync & Master Sync
        btnTriggerSync.setOnClickListener {
            triggerOutboxSync()
        }

        btnRetryFailed.setOnClickListener {
            scope.launch {
                val app = application as StockOpnameApp
                app.container.db.outbox().resetFailed()
                Toast.makeText(this@SessionActivity, "Data gagal di-reset ke antrean PENDING", Toast.LENGTH_SHORT).show()
                refreshOutboxStatus()
                triggerOutboxSync()
            }
        }

        btnSyncMaster.setOnClickListener {
            triggerMasterSync()
        }

        // Safe Session Ending
        btnEndSession.setOnClickListener {
            AlertDialog.Builder(this, R.style.Theme_StockOpname_Dialog)
                .setTitle("Ganti Gudang / Selesai Sesi")
                .setMessage("Apakah Anda yakin ingin mengakhiri sesi opname di $warehouseCode?")
                .setPositiveButton("Ya, Selesaikan") { _, _ ->
                    finishSessionAndExit()
                }
                .setNegativeButton("Batal", null)
                .show()
        }

        btnLogout.setOnClickListener {
            AlertDialog.Builder(this, R.style.Theme_StockOpname_Dialog)
                .setTitle("Keluar Akun")
                .setMessage("Keluar dari aplikasi dan akhiri sesi aktif?")
                .setPositiveButton("Logout") { _, _ ->
                    logoutAndExit()
                }
                .setNegativeButton("Batal", null)
                .show()
        }
    }

    private fun requestCameraScanner() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            startCameraScanner()
        } else {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.CAMERA), CAMERA_PERMISSION_REQUEST)
        }
    }

    private fun startCameraScanner() {
        cameraPreviewContainer.visibility = View.VISIBLE
        btnScanCamera.text = "STOP"
        textScanSource.text = "Sumber: KAMERA"
        cameraScanner?.release()
        cameraScanner = CameraBarcodeScanner(this, previewView) { barcode ->
            currentInputSource = "CAMERA"
            inputBarcode.setText(barcode)
            stopCameraScanner()
            doScanLookup(barcode, "CAMERA")
        }.also { it.start() }
    }

    private fun stopCameraScanner() {
        cameraScanner?.release()
        cameraScanner = null
        cameraPreviewContainer.visibility = View.GONE
        btnScanCamera.text = "KAMERA"
    }

    private fun switchTab(tabIndex: Int) {
        if (tabIndex != 0) stopCameraScanner()
        btnTabScan.setBackgroundResource(if (tabIndex == 0) R.drawable.bg_tab_selected else R.drawable.bg_tab_unselected)
        btnTabProposal.setBackgroundResource(if (tabIndex == 1) R.drawable.bg_tab_selected else R.drawable.bg_tab_unselected)
        btnTabPrint.setBackgroundResource(if (tabIndex == 2) R.drawable.bg_tab_selected else R.drawable.bg_tab_unselected)
        btnTabSync.setBackgroundResource(if (tabIndex == 3) R.drawable.bg_tab_selected else R.drawable.bg_tab_unselected)

        tabContentScan.visibility = if (tabIndex == 0) View.VISIBLE else View.GONE
        tabContentProposal.visibility = if (tabIndex == 1) View.VISIBLE else View.GONE
        tabContentPrint.visibility = if (tabIndex == 2) View.VISIBLE else View.GONE
        tabContentSync.visibility = if (tabIndex == 3) View.VISIBLE else View.GONE

        if (tabIndex == 3) {
            refreshOutboxStatus()
            refreshMasterStatus()
        }
    }

    private fun adjustPhysicalQty(delta: Int) {
        val newQty = max(0, currentPhysicalQty + delta)
        currentPhysicalQty = newQty
        inputQtyPhysical.setText(newQty.toString())
    }

    private fun updateVarianceDisplay() {
        val item = currentScanItem ?: return
        val variance = VarianceCalculator.variance(currentPhysicalQty, item.stock)
        val fmtVar = if (variance % 1.0 == 0.0) variance.toLong().toString() else variance.toString()

        if (variance == 0.0) {
            textVariance.text = "Selisih: 0 (SESUAI SISTEM)"
            textVariance.setTextColor(Color.parseColor("#2ECC71")) // Green
        } else {
            val pct = VarianceCalculator.variancePercent(currentPhysicalQty, item.stock)
            val color = if (pct < 5.0) Color.parseColor("#F1C40F") else Color.parseColor("#E74C3C") // Yellow <5%, Red >=5%
            if (variance > 0) {
                textVariance.text = "Selisih: +$fmtVar (LEBIH)"
            } else {
                textVariance.text = "Selisih: $fmtVar (KURANG)"
            }
            textVariance.setTextColor(color)
        }
    }

    private fun vibrate(durationMs: Long) {
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createOneShot(durationMs, VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(durationMs)
        }
    }

    private fun doScanLookup(rawBarcode: String, source: String) {
        progressScan.visibility = View.VISIBLE
        cardFoundItem.visibility = View.GONE
        cardNotFound.visibility = View.GONE
        cardPending.visibility = View.GONE
        cardRejected.visibility = View.GONE

        textScanSource.text = "Sumber: $source | Input: $rawBarcode"

        val app = application as StockOpnameApp
        scope.launch {
            val result = app.container.scan.lookup(rawBarcode, warehouseCode)
            progressScan.visibility = View.GONE
            currentScanResult = result

            if (result == null) {
                cardNotFound.visibility = View.VISIBLE
                textNotFoundMsg.text = "❌ Format barcode tidak valid: $rawBarcode"
                return@launch
            }

            when (val outcome = result.outcome) {
                is ScanOutcome.Found -> {
                    vibrate(60)
                    val item = outcome.item
                    currentScanItem = item
                    currentPhysicalQty = 0
                    inputQtyPhysical.setText("0")

                    textFoundItemCode.text = item.itemCode
                    textFoundItemName.text = item.itemName
                    val unitStr = item.unit?.takeIf { it.isNotEmpty() } ?: "PCS"
                    val packStr = if (item.pack.isNullOrEmpty()) "" else " | Pack: ${item.isiPerPack ?: "-"} / ${item.pack}"
                    textFoundItemDetails.text = "Stok Sistem: ${item.stock} $unitStr$packStr"

                    if (outcome.misplacement != null) {
                        cardMisplacement.visibility = View.VISIBLE
                        textMisplacement.text = "⚠️ " + outcome.misplacement.message
                    } else {
                        cardMisplacement.visibility = View.GONE
                    }

                    updateVarianceDisplay()
                    cardFoundItem.visibility = View.VISIBLE

                    // Pre-fill print tab
                    inputPrintBarcode.setText(item.itemCode)
                    inputPrintName.setText(item.itemName)
                    inputPrintQty.setText("0")
                }
                is ScanOutcome.NotFound -> {
                    vibrate(250)
                    cardNotFound.visibility = View.VISIBLE
                    textNotFoundMsg.text = "❌ Barcode '$rawBarcode' tidak ditemukan di katalog lokal."
                }
                is ScanOutcome.Pending -> {
                    cardPending.visibility = View.VISIBLE
                    val p = outcome.proposal
                    textPendingMsg.text = "ℹ️ Barcode '$rawBarcode' memiliki proposal [PENDING]:\n\"${p.name}\" (${p.proposedQty} pcs)\nMenunggu review & persetujuan SPV."
                    inputPrintBarcode.setText(p.barcode)
                    inputPrintName.setText(p.name)
                    inputPrintQty.setText(p.proposedQty.toString())
                }
                is ScanOutcome.Rejected -> {
                    cardRejected.visibility = View.VISIBLE
                    val p = outcome.proposal
                    textRejectedMsg.text = "⚠️ Proposal untuk barcode '$rawBarcode' DITOLAK:\n\"${p.rejectionReason ?: "Tidak ada alasan spesifik"}\""
                    inputPropBarcode.setText(p.barcode)
                    inputPropName.setText(p.name)
                }
            }
        }
    }

    private fun saveCurrentCount(action: DuplicateAction?) {
        val session = currentSession
        val item = currentScanItem
        if (session == null || item == null) {
            Toast.makeText(this, "Tidak ada data barang aktif untuk disimpan", Toast.LENGTH_SHORT).show()
            return
        }

        val mode = if (radioModeSloc.isChecked) "SLOC" else "SKU"
        val rackInput = inputRack.text.toString().trim()
        if (mode == "SLOC" && rackInput.isEmpty()) {
            Toast.makeText(this, "Mode SLOC mewajibkan input kode Lokasi / Rak!", Toast.LENGTH_LONG).show()
            inputRack.requestFocus()
            return
        }

        val userNote = inputCountNote.text.toString().trim()
        val misplaced = !item.warehouseCode.isNullOrBlank() && item.warehouseCode != session.warehouseCode
        if (misplaced && userNote.isBlank()) {
            Toast.makeText(this, "Barang salah lokasi: isi catatan posisi fisik sebelum simpan.", Toast.LENGTH_LONG).show()
            inputCountNote.requestFocus()
            return
        }
        val metaNote = "[MODE:$mode|SRC:$currentInputSource] $userNote".trim()

        val app = application as StockOpnameApp
        scope.launch {
            when (val r = app.container.counts.save(
                session = session,
                item = item,
                qty = currentPhysicalQty,
                rackCode = rackInput.ifEmpty { null },
                note = metaNote,
                action = action,
            )) {
                is SaveCountResult.Saved -> {
                    Toast.makeText(this@SessionActivity, "✓ Hitungan berhasil disimpan secara lokal", Toast.LENGTH_SHORT).show()
                    refreshOutboxStatus()
                    promptPrintAfterCount(r.record)
                }
                is SaveCountResult.NeedsResolution -> {
                    AlertDialog.Builder(this@SessionActivity, R.style.Theme_StockOpname_Dialog)
                        .setTitle("Hitungan Ganda Terdeteksi")
                        .setMessage(
                            "Barang ${item.itemCode} sudah pernah dihitung dalam sesi ini.\n\n" +
                                "Hitungan sebelumnya : ${r.existing.qtyPhysical}\n" +
                                "Hitungan baru diinput : $currentPhysicalQty\n\n" +
                                "Pilih tindakan rekonsiliasi:"
                        )
                        .setPositiveButton("TIMPA (${currentPhysicalQty})") { _, _ ->
                            saveCurrentCount(DuplicateAction.OVERWRITE)
                        }
                        .setNeutralButton("TAMBAH (${r.existing.qtyPhysical + currentPhysicalQty})") { _, _ ->
                            saveCurrentCount(DuplicateAction.ADD)
                        }
                        .setNegativeButton("Batal", null)
                        .show()
                }
            }
        }
    }

    private fun promptPrintAfterCount(record: CountEntity) {
        AlertDialog.Builder(this, R.style.Theme_StockOpname_Dialog)
            .setTitle("Hitungan Tersimpan")
            .setMessage("Data opname ${record.itemCode} berhasil disimpan.\nCetak label fisik sekarang?")
            .setPositiveButton("Cetak Label") { _, _ ->
                inputPrintBarcode.setText(record.itemCode)
                inputPrintName.setText(record.itemName)
                inputPrintQty.setText(record.qtyPhysical.toString())
                radioPrintOfficial.isChecked = true
                switchTab(2)
                executePrint()
            }
            .setNegativeButton("Lanjut Scan", null)
            .show()
    }

    // ================= CAMERA & PROPOSAL =================
    private fun checkAndLaunchCamera() {
        if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.CAMERA), 101)
            return
        }
        launchCamera()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        val granted = grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED
        when (requestCode) {
            CAMERA_PERMISSION_REQUEST -> if (granted) {
                startCameraScanner()
            } else {
                Toast.makeText(this, "Izin kamera diperlukan untuk scan barcode", Toast.LENGTH_SHORT).show()
            }
            101 -> if (granted) {
                launchCamera()
            } else {
                Toast.makeText(this, "Izin kamera diperlukan untuk mengambil foto bukti fisik", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun launchCamera() {
        try {
            val photosDir = File(filesDir, "photos").apply { mkdirs() }
            val photoFile = File(photosDir, "proposal_${System.currentTimeMillis()}.jpg")
            currentPhotoFile = photoFile
            val uri = FileProvider.getUriForFile(this, "${packageName}.fileprovider", photoFile)
            photoCaptureUri = uri

            val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                putExtra(MediaStore.EXTRA_OUTPUT, uri)
                addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            startActivityForResult(intent, 201)
        } catch (e: Exception) {
            Toast.makeText(this, "Gagal membuka kamera: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 201 && resultCode == RESULT_OK) {
            val file = currentPhotoFile ?: return
            if (file.exists() && file.length() > 0) {
                applyWatermarkAndDisplay(file)
            } else {
                Toast.makeText(this, "Foto kosong atau gagal disimpan", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun applyWatermarkAndDisplay(photoFile: File) {
        textPropPhotoStatus.text = "Menerapkan watermark bukti fisik..."
        textPropPhotoStatus.setTextColor(Color.parseColor("#F59E0B"))

        scope.launch {
            withContext(Dispatchers.IO) {
                val timeStr = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(Date())
                val barcode = inputPropBarcode.text.toString().trim().ifEmpty { "UNKNOWN" }
                val op = currentSession?.operator ?: "operator"
                val spec = WatermarkSpec(
                    operator = op,
                    warehouse = warehouseCode,
                    timestamp = timeStr,
                    barcode = barcode,
                )
                Watermarker.applyWatermark(photoFile, photoFile, spec)
            }

            val hash = withContext(Dispatchers.IO) { Hashing.sha256Hex(photoFile) }
            val bitmap = withContext(Dispatchers.IO) { BitmapFactory.decodeFile(photoFile.absolutePath) }

            if (bitmap != null) {
                imagePropPreview.setImageBitmap(bitmap)
                imagePropPreview.visibility = View.VISIBLE
                val sizeKb = photoFile.length() / 1024
                textPropPhotoStatus.text = "✓ Foto siap (${sizeKb} KB) | SHA-256: ${hash.take(12)}..."
                textPropPhotoStatus.setTextColor(Color.parseColor("#2ECC71"))
                btnSubmitProposal.isEnabled = true
            } else {
                textPropPhotoStatus.text = "Gagal memproses bitmap foto"
                textPropPhotoStatus.setTextColor(Color.parseColor("#E74C3C"))
            }
        }
    }

    private fun submitProposal() {
        val session = currentSession
        val photo = currentPhotoFile
        if (session == null || photo == null || !photo.exists() || photo.length() <= 0) {
            Toast.makeText(this, "Foto bukti fisik WAJIB ada sebelum mengajukan proposal", Toast.LENGTH_LONG).show()
            return
        }

        val barcode = inputPropBarcode.text.toString().trim()
        val name = inputPropName.text.toString().trim()
        val category = spinnerPropCategory.selectedItem?.toString().orEmpty()
        val qty = inputPropQty.text.toString().toIntOrNull() ?: 0
        val notes = inputPropNotes.text.toString().trim()

        if (barcode.isEmpty()) {
            Toast.makeText(this, "Barcode wajib diisi", Toast.LENGTH_SHORT).show()
            inputPropBarcode.requestFocus()
            return
        }
        if (name.isEmpty()) {
            Toast.makeText(this, "Nama spesifikasi barang wajib diisi", Toast.LENGTH_SHORT).show()
            inputPropName.requestFocus()
            return
        }
        if (qty <= 0) {
            Toast.makeText(this, "Qty usulan fisik harus lebih dari 0", Toast.LENGTH_SHORT).show()
            inputPropQty.requestFocus()
            return
        }

        val mode = if (radioModeSloc.isChecked) "SLOC" else "SKU"
        val fullNotes = "[MODE:$mode|SRC:$currentInputSource] $notes".trim()

        val app = application as StockOpnameApp
        scope.launch {
            try {
                val prop = app.container.proposals.create(
                    session = session,
                    barcode = barcode,
                    name = name,
                    category = category,
                    proposedQty = qty,
                    notes = fullNotes,
                    photo = photo,
                )
                Toast.makeText(this@SessionActivity, "✓ Proposal PENDING tersimpan di Outbox", Toast.LENGTH_SHORT).show()
                refreshOutboxStatus()

                btnPrintDraftProposal.visibility = View.VISIBLE
                btnPrintDraftProposal.setOnClickListener {
                    inputPrintBarcode.setText(prop.barcode)
                    inputPrintName.setText(prop.name)
                    inputPrintQty.setText(prop.proposedQty.toString())
                    radioPrintPending.isChecked = true
                    switchTab(2)
                    executePrint()
                }

                AlertDialog.Builder(this@SessionActivity, R.style.Theme_StockOpname_Dialog)
                    .setTitle("Proposal Tersimpan")
                    .setMessage("Proposal '${prop.name}' tersimpan di perangkat.\nCetak label DRAFT (Pending Approval)?")
                    .setPositiveButton("Cetak Draft") { _, _ ->
                        btnPrintDraftProposal.performClick()
                    }
                    .setNegativeButton("Selesai", null)
                    .show()
            } catch (e: Exception) {
                Toast.makeText(this@SessionActivity, "Gagal menyimpan proposal: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    // ================= PRINTING =================
    private fun setupPrinters() {
        val app = application as StockOpnameApp
        scope.launch {
            availablePrinters = app.container.db.printers().all()
            if (availablePrinters.isNotEmpty()) {
                val names = availablePrinters.map { "${it.name} (${it.host})" }
                spinnerPrinters.adapter = ArrayAdapter(this@SessionActivity, android.R.layout.simple_spinner_dropdown_item, names)

                val defaultId = PrinterSeeds.defaultPrinterIdFor(warehouseCode)
                val defaultIdx = availablePrinters.indexOfFirst { it.id == defaultId }.takeIf { it >= 0 } ?: 0
                spinnerPrinters.setSelection(defaultIdx)

                inputPrintHost.setText(availablePrinters[defaultIdx].host)
                inputPrintPort.setText(availablePrinters[defaultIdx].port.toString())

                spinnerPrinters.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                    override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                        val p = availablePrinters[position]
                        inputPrintHost.setText(p.host)
                        inputPrintPort.setText(p.port.toString())
                    }
                    override fun onNothingSelected(parent: AdapterView<*>?) {}
                }
            }
        }
    }

    private fun executePrint() {
        val host = inputPrintHost.text.toString().trim()
        val port = inputPrintPort.text.toString().toIntOrNull() ?: 9100
        val barcode = inputPrintBarcode.text.toString().trim()
        val itemName = inputPrintName.text.toString().trim()
        val qty = inputPrintQty.text.toString().toIntOrNull() ?: 0
        val isPending = radioPrintPending.isChecked

        if (host.isEmpty()) {
            Toast.makeText(this, "IP Printer wajib diisi", Toast.LENGTH_SHORT).show()
            return
        }
        if (itemName.isEmpty()) {
            Toast.makeText(this, "Nama barang wajib diisi", Toast.LENGTH_SHORT).show()
            return
        }

        val app = application as StockOpnameApp
        val operator = currentSession?.operator ?: "operator"
        val timeStr = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(Date())

        val labelData = LabelData(
            barcode = barcode,
            itemName = itemName,
            warehouseCode = warehouseCode,
            qty = qty,
            operatorName = operator,
            printedAt = timeStr,
            pending = isPending,
        )

        val bytes = EscPosBuilder.label(labelData, PaperWidth.MM80)
        textPrintFeedback.text = "Mengirim data ke $host:$port..."
        textPrintFeedback.setTextColor(Color.parseColor("#F59E0B"))
        btnPrintExecute.isEnabled = false

        scope.launch {
            val res = app.container.printerClient.send(host, port, bytes)
            btnPrintExecute.isEnabled = true
            if (res.isSuccess) {
                textPrintFeedback.text = "✓ Berhasil mencetak ke $host:$port"
                textPrintFeedback.setTextColor(Color.parseColor("#2ECC71"))
                Toast.makeText(this@SessionActivity, "✓ Perintah cetak terkirim", Toast.LENGTH_SHORT).show()
            } else {
                val msg = res.exceptionOrNull()?.message ?: "Gagal terhubung ke printer"
                textPrintFeedback.text = "❌ $msg"
                textPrintFeedback.setTextColor(Color.parseColor("#E74C3C"))
            }
        }
    }

    private fun setPrinterDot(color: Int) {
        (dotPrinterStatus.background as? GradientDrawable)?.setColor(color)
    }

    private fun checkPrinterConnection() {
        val host = inputPrintHost.text.toString().trim()
        val port = inputPrintPort.text.toString().toIntOrNull() ?: 9100
        if (host.isEmpty()) {
            Toast.makeText(this, "IP Printer wajib diisi", Toast.LENGTH_SHORT).show()
            return
        }
        val app = application as StockOpnameApp
        textPrinterStatus.text = "Mengecek..."
        textPrinterStatus.setTextColor(Color.parseColor("#F59E0B"))
        setPrinterDot(Color.parseColor("#F59E0B"))
        btnCheckPrinter.isEnabled = false
        scope.launch {
            val res = app.container.printerClient.checkConnection(host, port)
            btnCheckPrinter.isEnabled = true
            if (res.isSuccess) {
                textPrinterStatus.text = "Printer terhubung"
                textPrinterStatus.setTextColor(Color.parseColor("#2ECC71"))
                setPrinterDot(Color.parseColor("#2ECC71"))
            } else {
                textPrinterStatus.text = "Printer tidak terjangkau"
                textPrinterStatus.setTextColor(Color.parseColor("#E74C3C"))
                setPrinterDot(Color.parseColor("#E74C3C"))
            }
        }
    }

    // ================= SYNC & OUTBOX =================
    private fun refreshOutboxStatus() {
        val app = application as StockOpnameApp
        scope.launch {
            val allOutbox = app.container.db.outbox().all()
            val pendingCount = allOutbox.count { it.status == OutboxStatus.PENDING }
            val failedCount = allOutbox.count { it.status == OutboxStatus.FAILED }

            textOutboxSummary.text = "Antrean Outbox: $pendingCount Pending | $failedCount Gagal"

            if (pendingCount > 0 || failedCount > 0) {
                layoutOutboxBanner.visibility = View.VISIBLE
                textOutboxBanner.text = "⚠️ $pendingCount data opname/proposal tersimpan lokal & antre kirim"
            } else {
                layoutOutboxBanner.visibility = View.GONE
            }

            btnRetryFailed.visibility = if (failedCount > 0) View.VISIBLE else View.GONE

            // Populate recent outbox items
            layoutOutboxList.removeAllViews()
            val recent = allOutbox.takeLast(10).reversed()
            if (recent.isEmpty()) {
                val tv = TextView(this@SessionActivity).apply {
                    text = "Belum ada antrean outbox."
                    setTextColor(Color.parseColor("#9AA5B1"))
                    textSize = 12f
                    setPadding(8, 8, 8, 8)
                }
                layoutOutboxList.addView(tv)
            } else {
                val inflater = LayoutInflater.from(this@SessionActivity)
                for (item in recent) {
                    val view = inflater.inflate(R.layout.item_outbox, layoutOutboxList, false)
                    view.findViewById<TextView>(R.id.textOutboxType).text = item.type
                    val statusTv = view.findViewById<TextView>(R.id.textOutboxStatus)
                    statusTv.text = "[${item.status}]"
                    if (item.status == OutboxStatus.FAILED) {
                        statusTv.setTextColor(Color.parseColor("#E74C3C"))
                    } else if (item.status == OutboxStatus.SENT) {
                        statusTv.setTextColor(Color.parseColor("#2ECC71"))
                    } else {
                        statusTv.setTextColor(Color.parseColor("#F59E0B"))
                    }
                    view.findViewById<TextView>(R.id.textOutboxAttempts).text = "Coba: ${item.attempts}"
                    view.findViewById<TextView>(R.id.textOutboxUuid).text = "UUID: ${item.clientUuid.take(18)}..."

                    val errTv = view.findViewById<TextView>(R.id.textOutboxError)
                    if (!item.lastError.isNullOrEmpty()) {
                        errTv.text = "Err: ${item.lastError}"
                        errTv.visibility = View.VISIBLE
                    } else {
                        errTv.visibility = View.GONE
                    }
                    layoutOutboxList.addView(view)
                }
            }
        }
    }

    private fun refreshMasterStatus() {
        val app = application as StockOpnameApp
        scope.launch {
            val itemCount = app.container.db.items().count()
            val whCount = app.container.db.warehouses().all().size
            textMasterSummary.text = "Cache Master: $itemCount item barang | $whCount gudang"
        }
    }

    private fun triggerOutboxSync() {
        val app = application as StockOpnameApp
        btnTriggerSync.isEnabled = false
        Toast.makeText(this, "Mengirim antrean outbox...", Toast.LENGTH_SHORT).show()

        scope.launch {
            val processor = app.container.newOutboxProcessor()
            val outcome = processor.runOnce()
            btnTriggerSync.isEnabled = true
            val msg = when (outcome) {
                SyncOutcome.DONE -> "Semua antrean outbox terkirim"
                SyncOutcome.RETRY -> "Beberapa tertunda (akan dicoba lagi)"
                SyncOutcome.AUTH_EXPIRED -> "Sesi login berakhir"
            }
            Toast.makeText(this@SessionActivity, msg, Toast.LENGTH_SHORT).show()
            refreshOutboxStatus()
        }
    }

    private fun triggerMasterSync() {
        val app = application as StockOpnameApp
        progressMasterSync.visibility = View.VISIBLE
        btnSyncMaster.isEnabled = false
        textMasterFeedback.text = "Mengunduh master data dari server..."

        scope.launch {
            val syncService = app.container.newMasterSync()
            val whRes = syncService.syncWarehouses()
            val itemRes = syncService.syncItems()

            progressMasterSync.visibility = View.GONE
            btnSyncMaster.isEnabled = true

            val msg = StringBuilder()
            when (whRes) {
                is MasterSyncResult.Ok -> msg.append("Gudang: ${whRes.itemsWritten} diperbarui. ")
                is MasterSyncResult.Failed -> msg.append("Gudang gagal: ${whRes.message}. ")
                is MasterSyncResult.AuthExpired -> msg.append("Sesi login berakhir. ")
            }
            when (itemRes) {
                is MasterSyncResult.Ok -> msg.append("Item: ${itemRes.itemsWritten} diperbarui.")
                is MasterSyncResult.Failed -> msg.append("Item gagal: ${itemRes.message}.")
                is MasterSyncResult.AuthExpired -> msg.append("Sesi login berakhir.")
            }
            textMasterFeedback.text = msg.toString()
            refreshMasterStatus()
        }
    }

    // ================= SESSION & LIFECYCLE =================
    private fun finishSessionAndExit() {
        val session = currentSession
        val app = application as StockOpnameApp
        scope.launch {
            if (session != null) {
                app.container.db.sessions().finish(session.uuid, System.currentTimeMillis())
            }
            val intent = Intent(this@SessionActivity, DashboardActivity::class.java)
            intent.flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            startActivity(intent)
            finish()
        }
    }

    private fun logoutAndExit() {
        val session = currentSession
        val app = application as StockOpnameApp
        scope.launch {
            if (session != null) {
                app.container.db.sessions().finish(session.uuid, System.currentTimeMillis())
            }
            app.container.auth.logout()
            startActivity(Intent(this@SessionActivity, LoginActivity::class.java))
            finish()
        }
    }

    override fun onResume() {
        super.onResume()
        val filter = IntentFilter().apply {
            addAction("com.unison.stockopname.SCAN")
            addAction("com.symbol.datawedge.api.ACTION_RESULT_NOTIFICATION")
            addAction("com.symbol.datawedge.ACTION")
            addAction("com.zebra.action.BARCODE")
            addAction(Intent.ACTION_DEFAULT)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(dataWedgeReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(dataWedgeReceiver, filter)
        }
        refreshOutboxStatus()
    }

    override fun onPause() {
        stopCameraScanner()
        super.onPause()
        try {
            unregisterReceiver(dataWedgeReceiver)
        } catch (_: IllegalArgumentException) {}
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        val barcode = intent?.getStringExtra("com.symbol.datawedge.data_string")
            ?: intent?.getStringExtra("data_string")
            ?: intent?.getStringExtra("barcode")
        if (!barcode.isNullOrBlank()) {
            currentInputSource = "DATAWEDGE"
            inputBarcode.setText(barcode.trim())
            doScanLookup(barcode.trim(), "DATAWEDGE")
        }
    }

    override fun onBackPressed() {
        startActivity(Intent(this, DashboardActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        })
        finish()
    }

    override fun onDestroy() {
        cameraScanner?.release()
        cameraScanner = null
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        private const val CAMERA_PERMISSION_REQUEST = 2001
    }
}
