package com.unison.stockopname.data.printer

import org.junit.Assert.assertEquals
import org.junit.Test

class PrinterSeedsTest {
    @Test fun onlyRealPos80cLanPrinterIsSeeded() {
        assertEquals(1, PrinterSeeds.printers.size)
        val printer = PrinterSeeds.printers.single()
        assertEquals("POS-80C LAN", printer.name)
        assertEquals("192.168.1.206", printer.host)
        assertEquals(9100, printer.port)
        assertEquals(printer.id, PrinterSeeds.defaultPrinterIdFor("U1G3"))
        assertEquals(printer.id, PrinterSeeds.defaultPrinterIdFor("UNKNOWN"))
    }
}
