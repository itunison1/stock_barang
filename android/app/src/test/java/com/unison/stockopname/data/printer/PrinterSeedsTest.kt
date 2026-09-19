package com.unison.stockopname.data.printer

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PrinterSeedsTest {
    private fun ipOf(warehouse: String): String {
        val id = PrinterSeeds.defaultPrinterIdFor(warehouse)
        return PrinterSeeds.printers.first { it.id == id }.host
    }

    @Test fun fourLanPrintersOnPort9100() {
        assertEquals(4, PrinterSeeds.printers.size)
        assertTrue(PrinterSeeds.printers.all { it.port == 9100 })
        assertEquals(
            setOf("192.168.1.50", "192.168.1.140", "192.168.1.51", "192.168.1.52"),
            PrinterSeeds.printers.map { it.host }.toSet()
        )
    }

    @Test fun defaultsFollowPanduanBab6() {
        assertEquals("192.168.1.50", ipOf("U2 GUDANG1"))
        assertEquals("192.168.1.50", ipOf("U2 GUDANG2"))
        assertEquals("192.168.1.140", ipOf("U2 GUDANG3"))
        assertEquals("192.168.1.140", ipOf("U2 GUDANG4"))
        assertEquals("192.168.1.140", ipOf("U2 GUDANG5"))
        assertEquals("192.168.1.51", ipOf("U2 GUDANG6"))
        assertEquals("192.168.1.51", ipOf("U2 F29"))
        assertEquals("192.168.1.50", ipOf("U2 UCP"))
        assertEquals("192.168.1.51", ipOf("GUDANG JAYA"))
        assertEquals("192.168.1.51", ipOf("D30"))
        assertEquals("192.168.1.51", ipOf("U1"))
    }

    @Test fun lookupIsCaseInsensitiveAndUnknownFallsBackToOfficePrinter() {
        assertEquals("192.168.1.50", ipOf("u2 gudang1"))
        assertEquals("192.168.1.140", ipOf("GUDANG TIDAK ADA"))
    }
}
