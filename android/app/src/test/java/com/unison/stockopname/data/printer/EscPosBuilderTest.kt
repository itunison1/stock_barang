package com.unison.stockopname.data.printer

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class EscPosBuilderTest {
    private fun label(
        pending: Boolean = true,
        name: String = "BAUT 3/8 x 50 CEMET",
        barcode: String = "AB6C50",
    ) = LabelData(
        barcode = barcode, itemName = name, warehouseCode = "U2 GUDANG3", qty = 500,
        operatorName = "Kirana", printedAt = "2026-09-19 10:00", pending = pending,
    )

    private fun text(bytes: ByteArray) = String(bytes, Charsets.ISO_8859_1)

    private fun indexOf(bytes: ByteArray, vararg seq: Int): Int {
        val pattern = seq.map { it.toByte() }
        for (i in 0..bytes.size - pattern.size) {
            if (pattern.indices.all { bytes[i + it] == pattern[it] }) return i
        }
        return -1
    }

    @Test fun startsWithInitCommand() {
        val b = EscPosBuilder.label(label(), PaperWidth.MM80)
        assertEquals(0x1B.toByte(), b[0])
        assertEquals(0x40.toByte(), b[1])
    }

    @Test fun endsWithPartialCut() {
        val b = EscPosBuilder.label(label(), PaperWidth.MM80)
        val tail = b.takeLast(4).map { it.toInt() and 0xFF }
        assertEquals(listOf(0x1D, 0x56, 0x42, 0x00), tail)
    }

    @Test fun pendingLabelCarriesDraftWatermark() {
        assertTrue(text(EscPosBuilder.label(label(pending = true), PaperWidth.MM80)).contains("DRAFT - PENDING APPROVAL"))
    }

    @Test fun activeLabelHasNoDraftWatermark() {
        assertFalse(text(EscPosBuilder.label(label(pending = false), PaperWidth.MM80)).contains("DRAFT"))
    }

    @Test fun containsItemFieldsAndCompanyHeader() {
        val t = text(EscPosBuilder.label(label(), PaperWidth.MM80))
        assertTrue(t.contains("PT UNISON INDUSTRIAL INDONESIA"))
        assertTrue(t.contains("BAUT 3/8 x 50 CEMET"))
        assertTrue(t.contains("U2 GUDANG3"))
        assertTrue(t.contains("Qty     : 500"))
        assertTrue(t.contains("Operator: Kirana"))
    }

    @Test fun barcodeUsesCode128SetBWithLength() {
        val b = EscPosBuilder.label(label(barcode = "ABC123"), PaperWidth.MM80)
        // GS k 73 n '{' 'B' A B C ...   (n = 6 + 2 = 8)
        val i = indexOf(b, 0x1D, 0x6B, 0x49, 8, '{'.code, 'B'.code, 'A'.code, 'B'.code, 'C'.code)
        assertTrue("barcode command not found", i >= 0)
    }

    @Test fun braceInBarcodeIsEscaped() {
        val b = EscPosBuilder.label(label(barcode = "A{B"), PaperWidth.MM80)
        // data "A{{B" => n = 4 + 2 = 6
        assertTrue(indexOf(b, 0x1D, 0x6B, 0x49, 6, '{'.code, 'B'.code, 'A'.code, '{'.code, '{'.code, 'B'.code) >= 0)
    }

    @Test fun nonAsciiIsReplaced() {
        val t = text(EscPosBuilder.label(label(name = "Ñandú"), PaperWidth.MM80))
        assertTrue(t.contains("?and?"))
    }

    @Test fun longNameWrapsToPaperWidth() {
        val long = "BAUT HEXAGON GALVANIS TAHAN KOROSI UKURAN BESAR SEKALI 3/8 x 50 CEMET"
        val b = EscPosBuilder.label(label(name = long, barcode = "X"), PaperWidth.MM58)
        val runs = Regex("[ -~]+").findAll(text(b)).map { it.value.length }
        assertTrue("a printable run exceeds 32 chars", runs.all { it <= PaperWidth.MM58.chars })
    }

    @Test fun blankBarcodeSkipsBarcodeCommand() {
        val b = EscPosBuilder.label(label(barcode = "   "), PaperWidth.MM80)
        assertEquals(-1, indexOf(b, 0x1D, 0x6B, 0x49))
    }
}
