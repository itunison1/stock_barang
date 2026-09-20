package com.unison.stockopname.data.printer

data class PrinterSeed(val id: Long, val name: String, val host: String, val port: Int, val paper: PaperWidth)

/** Printer LAN aktif sementara. Alamat tetap dapat diubah melalui pengaturan. */
object PrinterSeeds {
    private const val POS_80C = 1L

    val printers: List<PrinterSeed> = listOf(
        PrinterSeed(POS_80C, "POS-80C LAN", "192.168.1.206", 9100, PaperWidth.MM80),
    )

    fun defaultPrinterIdFor(@Suppress("UNUSED_PARAMETER") warehouseCode: String): Long = POS_80C
}
