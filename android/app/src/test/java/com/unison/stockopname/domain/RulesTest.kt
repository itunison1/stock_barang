package com.unison.stockopname.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test

class RulesTest {
    // --- variance ---
    @Test fun varianceNegativeWhenPhysicalLower() {
        assertEquals(-100.0, VarianceCalculator.variance(8400, 8500.0), 0.0001)
    }

    @Test fun variancePositiveWhenPhysicalHigher() {
        assertEquals(50.5, VarianceCalculator.variance(100, 49.5), 0.0001)
    }

    @Test fun varianceZeroWhenEqual() {
        assertEquals(0.0, VarianceCalculator.variance(10, 10.0), 0.0001)
    }

    // --- variancePercent (dipakai tier warna hijau/kuning/merah di UI) ---
    @Test fun variancePercentZeroWhenNoDifference() {
        assertEquals(0.0, VarianceCalculator.variancePercent(10, 10.0), 0.0001)
    }

    @Test fun variancePercentSmallDifferenceUnderFivePercent() {
        // selisih 4 dari 100 = 4% -> kuning
        assertEquals(4.0, VarianceCalculator.variancePercent(96, 100.0), 0.0001)
    }

    @Test fun variancePercentLargeDifferenceAtOrAboveFivePercent() {
        // selisih 10 dari 100 = 10% -> merah
        assertEquals(10.0, VarianceCalculator.variancePercent(90, 100.0), 0.0001)
    }

    @Test fun variancePercentHandlesZeroSystemStock() {
        assertEquals(100.0, VarianceCalculator.variancePercent(5, 0.0), 0.0001)
        assertEquals(0.0, VarianceCalculator.variancePercent(0, 0.0), 0.0001)
    }

    // --- misplacement ---
    @Test fun sameWarehouseNoAlert() {
        assertNull(MisplacementChecker.check("U2 GUDANG3", "U2 GUDANG3"))
    }

    @Test fun caseAndWhitespaceInsensitive() {
        assertNull(MisplacementChecker.check(" u2 gudang3 ", "U2 GUDANG3"))
    }

    @Test fun differentWarehouseAlertsWithDocMessage() {
        val m = MisplacementChecker.check("U2 GUDANG1", "U2 GUDANG3")!!
        assertEquals("U2 GUDANG3", m.registeredWarehouse)
        assertEquals("U2 GUDANG1", m.scannedWarehouse)
        assertEquals(
            "Barang terdaftar di U2 GUDANG3, tetapi di-scan di U2 GUDANG1. Rekam pemindahan lokasi?",
            m.message
        )
    }

    @Test fun unknownRegisteredWarehouseNeverAlerts() {
        assertNull(MisplacementChecker.check("U2 GUDANG1", null))
        assertNull(MisplacementChecker.check("U2 GUDANG1", "  "))
    }

    // --- duplicate count ---
    @Test fun noExistingUsesEnteredWithoutAction() {
        assertEquals(40, DuplicateCountPolicy.resolve(null, 40, null))
    }

    @Test fun overwriteUsesEntered() {
        assertEquals(40, DuplicateCountPolicy.resolve(100, 40, DuplicateAction.OVERWRITE))
    }

    @Test fun addSumsExistingAndEntered() {
        assertEquals(140, DuplicateCountPolicy.resolve(100, 40, DuplicateAction.ADD))
    }

    @Test fun existingWithoutActionIsProgrammerError() {
        assertThrows(IllegalStateException::class.java) { DuplicateCountPolicy.resolve(100, 40, null) }
    }

    // --- watermark spec ---
    @Test fun watermarkSpecDefaultsAndValues() {
        val spec = WatermarkSpec(
            operator = "cseon",
            warehouse = "U2 GUDANG1",
            timestamp = "2026-09-19 21:00:00",
            barcode = "BM-HEX-M10-50"
        )
        assertEquals("PT UNISON INDUSTRIAL INDONESIA - WMS MODE A", spec.title)
        assertEquals("cseon", spec.operator)
        assertEquals("U2 GUDANG1", spec.warehouse)
        assertEquals("2026-09-19 21:00:00", spec.timestamp)
        assertEquals("BM-HEX-M10-50", spec.barcode)
        assertEquals("QC BUKTI FISIK WMS", spec.badge)
    }
}
