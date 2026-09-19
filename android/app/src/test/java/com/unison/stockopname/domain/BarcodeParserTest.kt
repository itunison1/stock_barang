package com.unison.stockopname.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class BarcodeParserTest {
    @Test fun plainCodeReturnsItemOnly() {
        assertEquals(ParsedBarcode("AB6C50", null, null, null), BarcodeParser.parse("AB6C50"))
    }

    @Test fun trimsWhitespace() {
        assertEquals("AB6C50", BarcodeParser.parse("  AB6C50 \n")?.itemCode)
    }

    @Test fun fullCompositeParsesAllFields() {
        assertEquals(
            ParsedBarcode("AB6C50", "LOT-77", 1200, "2026-09-01"),
            BarcodeParser.parse("AB6C50|LOT-77|1200|2026-09-01")
        )
    }

    @Test fun partialCompositeLeavesRestNull() {
        assertEquals(ParsedBarcode("AB6C50", "LOT-77", null, null), BarcodeParser.parse("AB6C50|LOT-77"))
    }

    @Test fun blankFieldsBecomeNull() {
        assertEquals(ParsedBarcode("AB6C50", null, 10, null), BarcodeParser.parse("AB6C50||10|"))
    }

    @Test fun nonNumericQtyBecomesNull() {
        assertNull(BarcodeParser.parse("AB6C50|L|abc|2026-09-01")?.qty)
    }

    @Test fun negativeQtyBecomesNull() {
        assertNull(BarcodeParser.parse("AB6C50|L|-5|2026-09-01")?.qty)
    }

    @Test fun emptyInputReturnsNull() {
        assertNull(BarcodeParser.parse(""))
        assertNull(BarcodeParser.parse("   "))
    }

    @Test fun blankItemCodeReturnsNull() {
        assertNull(BarcodeParser.parse("|LOT|10|2026-09-01"))
    }
}
