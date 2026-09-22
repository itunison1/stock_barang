package com.unison.stockopname.data.printer

import java.io.ByteArrayOutputStream

enum class PaperWidth(val chars: Int) { MM80(48), MM58(32) }

data class LabelData(
    val barcode: String,
    val itemName: String,
    val warehouseCode: String,
    val qty: Int,
    val operatorName: String,
    val printedAt: String,
    val pending: Boolean,
    /** Opsional: SKU/part number untuk baris detail (kosong = dilewati). */
    val sku: String? = null,
    /** Opsional: kategori/baris detail bebas (mis. "Kelas: A / Lokasi: R3-B2"). */
    val category: String? = null,
    /** Opsional: nomor lot/batch. */
    val lotNo: String? = null,
)

object EscPosBuilder {
    // Raster 1-bit 64x24 px: icon gudang (24px) + jarak (16px) + icon baut (24px).
    // Digambar programatik lalu di-bake konstanta agar tidak butuh resource file.
    private val ICON_ROW = intArrayOf(
        0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x08,0x00,0x00,0x08,0x00,0x00,0x00,0x00,0x3E,0x00,0x00,0x14,0x00,0x00,0x00,0x00,0xC9,0x80,0x00,0x63,0x00,0x00,0x00,0x03,0x08,0x60,0x00,0x80,0x80,0x00,0x00,0x04,0x08,0x10,0x01,0x00,0x40,0x00,0x00,0x04,0x08,0x10,0x02,0x00,0x20,0x00,0x00,0x04,0x08,0x10,0x04,0x00,0x10,0x00,0x00,0x04,0x08,0x10,0x18,0x00,0x0C,0x00,0x00,0x04,0x08,0x10,0x20,0x00,0x02,0x00,0x00,0x04,0x08,0x10,0x40,0x00,0x01,0x00,0x00,0x04,0x08,0x10,0xFF,0xFF,0xFF,0x00,0x00,0x04,0x08,0x10,0x10,0x00,0x04,0x00,0x00,0x03,0x08,0x60,0x10,0x00,0x04,0x00,0x00,0x00,0xC9,0x80,0x17,0x00,0x74,0x00,0x00,0x00,0x3E,0x00,0x15,0x7F,0x54,0x00,0x00,0x00,0x7F,0x00,0x17,0x7F,0x74,0x00,0x00,0x00,0x55,0x00,0x10,0x7F,0x04,0x00,0x00,0x00,0x7F,0x00,0x10,0x7F,0x04,0x00,0x00,0x00,0x55,0x00,0x10,0x7F,0x04,0x00,0x00,0x00,0x7F,0x00,0x10,0x7F,0x04,0x00,0x00,0x00,0x55,0x00,0x1F,0xFF,0xFC,0x00,0x00,0x00,0x7F,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    ).map { it.toByte() }.toByteArray()

    fun label(data: LabelData, paper: PaperWidth): ByteArray {
        val out = ByteArrayOutputStream()
        fun raw(vararg b: Int) = out.write(ByteArray(b.size) { b[it].toByte() })
        fun line(s: String) {
            out.write(ascii(s).toByteArray(Charsets.US_ASCII))
            raw(0x0A)
        }
        fun bold(on: Boolean) = raw(0x1B, 0x45, if (on) 1 else 0)
        fun size(doubleOn: Boolean) = raw(0x1D, 0x21, if (doubleOn) 0x11 else 0x00)

        raw(0x1B, 0x40)                 // ESC @ init
        raw(0x1B, 0x61, 0x01)           // center

        // === Header visual: [icon gudang] PT UNISON [icon baut] ===
        raster(out, ICON_ROW, widthPx = 64, heightPx = 24)
        size(true)                      // double width + height
        bold(true)
        line("PT UNISON")
        size(false)
        line("INDUSTRIAL INDONESIA")
        bold(false)
        line("FASTENER - MUR & BAUT")
        if (data.pending) {
            bold(true)
            line("DRAFT - PENDING APPROVAL")
            bold(false)
        }
        line("-".repeat(paper.chars))

        // === Detail barang ===
        raw(0x1B, 0x61, 0x00)           // left
        wrap(data.itemName, paper.chars).forEach { line(it) }
        data.sku?.takeIf { it.isNotBlank() }?.let { line("SKU     : ${it.trim()}") }
        line("Gudang  : ${data.warehouseCode}")
        line("Qty     : ${data.qty}")
        data.category?.takeIf { it.isNotBlank() }?.let { line("Kategori: ${it.trim()}") }
        data.lotNo?.takeIf { it.isNotBlank() }?.let { line("Lot/Batch: ${it.trim()}") }
        line("Operator: ${data.operatorName}")
        line("Waktu   : ${data.printedAt}")
        line("-".repeat(paper.chars))

        val code = ascii(data.barcode).trim()
        if (code.isNotEmpty()) {
            raw(0x1B, 0x61, 0x01)       // center
            // 1) QR 2D (kotak) — scanner 2D di meja
            qr(out, code.take(120))
            line(" ")
            // 2) Code128 1D (batang) — HP operator / scanner 1D
            val encoded = code.take(60).replace("{", "{{")
            raw(0x1D, 0x68, 80)         // height
            raw(0x1D, 0x77, 2)          // width
            raw(0x1D, 0x48, 2)          // HRI below
            raw(0x1D, 0x6B, 0x49, encoded.length + 2, '{'.code, 'B'.code)
            out.write(encoded.toByteArray(Charsets.US_ASCII))
            raw(0x0A)
        }

        raw(0x1B, 0x64, 0x04)           // feed 4 lines
        raw(0x1D, 0x56, 0x42, 0x00)     // partial cut
        return out.toByteArray()
    }

    /** Cetak raster 1-bit sejajar kiri via GS v 0 (0x1D 0x76 0x30 m xL xH yL yH ...). */
    private fun raster(out: ByteArrayOutputStream, bytes: ByteArray, widthPx: Int, heightPx: Int) {
        val wBytes = widthPx / 8
        out.write(byteArrayOf(0x1D, 0x76, 0x30, 0x00,
            (wBytes and 0xFF).toByte(), ((wBytes shr 8) and 0xFF).toByte(),
            (heightPx and 0xFF).toByte(), ((heightPx shr 8) and 0xFF).toByte()))
        out.write(bytes)
        out.write(0x0A)
    }

    /** QR Code model 2 via GS ( k (0x1D 0x28 0x6B): ukuran modul 6, koreksi M. */
    private fun qr(out: ByteArrayOutputStream, data: String) {
        val bytes = data.toByteArray(Charsets.US_ASCII)
        val len = bytes.size + 3
        val pl = (len and 0xFF).toByte()
        val ph = ((len shr 8) and 0xFF).toByte()
        // 1) pilih model 2
        out.write(byteArrayOf(0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00))
        // 2) ukuran modul 6 (sekitar 1.5 cm di 203 dpi)
        out.write(byteArrayOf(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x06))
        // 3) koreksi error level M
        out.write(byteArrayOf(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31))
        // 4) simpan data
        out.write(byteArrayOf(0x1D, 0x28, 0x6B, pl, ph, 0x31, 0x50, 0x30))
        out.write(bytes)
        // 5) cetak
        out.write(byteArrayOf(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30))
    }

    private fun ascii(s: String): String =
        s.map { if (it.code in 32..126) it else if (it == '\n' || it == '\r') ' ' else '?' }.joinToString("")

    private fun wrap(text: String, width: Int): List<String> {
        val words = ascii(text).trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
        val lines = mutableListOf<String>()
        var cur = StringBuilder()
        for (w in words) {
            var word = w
            while (word.length > width) {
                if (cur.isNotEmpty()) { lines += cur.toString(); cur = StringBuilder() }
                lines += word.take(width)
                word = word.drop(width)
            }
            if (cur.isEmpty()) cur.append(word)
            else if (cur.length + 1 + word.length <= width) cur.append(' ').append(word)
            else { lines += cur.toString(); cur = StringBuilder(word) }
        }
        if (cur.isNotEmpty()) lines += cur.toString()
        return lines
    }
}
