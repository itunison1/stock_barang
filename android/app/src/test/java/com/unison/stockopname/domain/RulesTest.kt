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
}
