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
)

object EscPosBuilder {
    fun label(data: LabelData, paper: PaperWidth): ByteArray {
        val out = ByteArrayOutputStream()
        fun raw(vararg b: Int) = out.write(ByteArray(b.size) { b[it].toByte() })
        fun line(s: String) {
            out.write(ascii(s).toByteArray(Charsets.US_ASCII))
            raw(0x0A)
        }
        fun bold(on: Boolean) = raw(0x1B, 0x45, if (on) 1 else 0)

        raw(0x1B, 0x40)                 // ESC @ init
        raw(0x1B, 0x61, 0x01)           // center
        bold(true)
        line("PT UNISON INDUSTRIAL INDONESIA")
        if (data.pending) line("DRAFT - PENDING APPROVAL")
        bold(false)
        line("-".repeat(paper.chars))

        raw(0x1B, 0x61, 0x00)           // left
        wrap(data.itemName, paper.chars).forEach { line(it) }
        line("Gudang  : ${data.warehouseCode}")
        line("Qty     : ${data.qty}")
        line("Operator: ${data.operatorName}")
        line("Waktu   : ${data.printedAt}")

        val code = ascii(data.barcode).trim()
        if (code.isNotEmpty()) {
            val encoded = code.take(60).replace("{", "{{")
            raw(0x1B, 0x61, 0x01)       // center
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
