package com.unison.stockopname.util

import androidx.activity.ComponentActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.barcode.BarcodeScanner
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.Executors

class CameraBarcodeScanner(
    private val activity: ComponentActivity,
    private val previewView: PreviewView,
    private val onBarcodeScanned: (barcode: String) -> Unit,
) {
    private val cameraExecutor = Executors.newSingleThreadExecutor()
    private var cameraProvider: ProcessCameraProvider? = null
    var isScanning = false
        private set

    private var lastBarcode: String? = null
    private var lastScanTime: Long = 0L
    private val debounceMs = 1500L

    private val barcodeScanner: BarcodeScanner = BarcodeScanning.getClient(
        BarcodeScannerOptions.Builder()
            .setBarcodeFormats(
                Barcode.FORMAT_QR_CODE,
                Barcode.FORMAT_CODE_128,
                Barcode.FORMAT_EAN_13,
                Barcode.FORMAT_EAN_8,
            )
            .build()
    )

    fun start() {
        if (isScanning) return
        isScanning = true
        val cameraProviderFuture = ProcessCameraProvider.getInstance(activity)
        cameraProviderFuture.addListener({
            try {
                val provider = cameraProviderFuture.get()
                cameraProvider = provider
                bindCamera(provider)
            } catch (_: Exception) {
                isScanning = false
            }
        }, ContextCompat.getMainExecutor(activity))
    }

    private fun bindCamera(provider: ProcessCameraProvider) {
        val preview = Preview.Builder().build().also {
            it.setSurfaceProvider(previewView.surfaceProvider)
        }

        val analysis = ImageAnalysis.Builder()
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .build()

        analysis.setAnalyzer(cameraExecutor) { imageProxy ->
            val mediaImage = imageProxy.image
            if (mediaImage != null && isScanning) {
                val inputImage = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
                barcodeScanner.process(inputImage)
                    .addOnSuccessListener { barcodes ->
                        val now = System.currentTimeMillis()
                        for (barcode in barcodes) {
                            val raw = barcode.rawValue?.trim() ?: continue
                            if (raw.isNotEmpty()) {
                                if (raw == lastBarcode && (now - lastScanTime) < debounceMs) {
                                    continue
                                }
                                lastBarcode = raw
                                lastScanTime = now
                                activity.runOnUiThread {
                                    onBarcodeScanned(raw)
                                }
                                break
                            }
                        }
                    }
                    .addOnCompleteListener {
                        imageProxy.close()
                    }
            } else {
                imageProxy.close()
            }
        }

        val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA
        try {
            provider.unbindAll()
            provider.bindToLifecycle(activity, cameraSelector, preview, analysis)
        } catch (_: Exception) {
            isScanning = false
        }
    }

    fun stop() {
        isScanning = false
        try {
            cameraProvider?.unbindAll()
        } catch (_: Exception) {}
    }

    fun release() {
        stop()
        cameraExecutor.shutdown()
        barcodeScanner.close()
    }
}
