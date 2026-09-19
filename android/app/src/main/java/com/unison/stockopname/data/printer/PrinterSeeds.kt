package com.unison.stockopname.data.printer

data class PrinterSeed(val id: Long, val name: String, val host: String, val port: Int, val paper: PaperWidth)

/** Printer LAN dari Bab 3 panduan dan printer default per gudang dari Bab 6. IP bisa diubah di pengaturan. */
object PrinterSeeds {
    val printers: List<PrinterSeed> = listOf(
        PrinterSeed(1, "Printer Meja Operator Depan Lorong", "192.168.1.50", 9100, PaperWidth.MM80),
        PrinterSeed(2, "Printer Meja Kantor Direksi & SPV", "192.168.1.140", 9100, PaperWidth.MM80),
        PrinterSeed(3, "Printer Meja Admin Gudang Jaya", "192.168.1.51", 9100, PaperWidth.MM80),
        PrinterSeed(4, "Printer Mobile Pinggang", "192.168.1.52", 9100, PaperWidth.MM58),
    )

    private const val OPERATOR_DESK = 1L
    private const val OFFICE = 2L
    private const val GUDANG_JAYA = 3L

    private val byWarehouse = mapOf(
        "U2 GUDANG1" to OPERATOR_DESK,
        "U2 GUDANG2" to OPERATOR_DESK,
        "U2 GUDANG3" to OFFICE,
        "U2 GUDANG4" to OFFICE,
        "U2 GUDANG5" to OFFICE,
        "U2 GUDANG6" to GUDANG_JAYA,
        "U2 F29" to GUDANG_JAYA,
        "U2 UCP" to OPERATOR_DESK,
        "GUDANG JAYA" to GUDANG_JAYA,
        "D30" to GUDANG_JAYA,
        "U1" to GUDANG_JAYA,
    )

    fun defaultPrinterIdFor(warehouseCode: String): Long =
        byWarehouse[warehouseCode.trim().uppercase()] ?: OFFICE
}
