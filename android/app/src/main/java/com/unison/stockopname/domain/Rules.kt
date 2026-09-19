package com.unison.stockopname.domain

object VarianceCalculator {
    /** Selisih = qty fisik - qty sistem (Bab 2.3 panduan). */
    fun variance(qtyPhysical: Int, qtySystem: Double): Double = qtyPhysical - qtySystem
}

data class Misplacement(val registeredWarehouse: String, val scannedWarehouse: String) {
    val message: String
        get() = "Barang terdaftar di $registeredWarehouse, tetapi di-scan di $scannedWarehouse. Rekam pemindahan lokasi?"
}

object MisplacementChecker {
    fun check(scannedWarehouse: String, registeredWarehouse: String?): Misplacement? {
        val registered = registeredWarehouse?.trim().orEmpty()
        val scanned = scannedWarehouse.trim()
        if (registered.isEmpty() || scanned.isEmpty()) return null
        return if (registered.equals(scanned, ignoreCase = true)) null
        else Misplacement(registered, scanned)
    }
}

enum class DuplicateAction { OVERWRITE, ADD }

object DuplicateCountPolicy {
    fun resolve(existing: Int?, entered: Int, action: DuplicateAction?): Int = when {
        existing == null -> entered
        action == DuplicateAction.OVERWRITE -> entered
        action == DuplicateAction.ADD -> existing + entered
        else -> error("Hitungan ganda butuh keputusan operator (timpa atau tambah)")
    }
}
