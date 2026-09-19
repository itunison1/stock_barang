package com.unison.stockopname.data.api

import com.unison.stockopname.data.db.AuditEntity
import com.unison.stockopname.data.db.CountEntity
import com.unison.stockopname.data.db.ProposalEntity
import com.unison.stockopname.data.db.ProposalStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PayloadsTest {
    @Test fun isoUtcFormatsEpochMillis() {
        assertEquals("2026-09-19T10:00:00Z", Payloads.isoUtc(1789812000000L))
        assertEquals("2026-09-19T10:00:00.123Z", Payloads.isoUtc(1789812000123L))
    }

    @Test fun countPayloadUsesSnakeCaseAndOmitsNullRack() {
        val c = CountEntity("c1", "s1", "U2 GUDANG2", "AB6C50", "BAUT", 100.0, 90, -10.0, null, "ok", null, 1789812000000L, "kirana")
        val json = Payloads.count(c)
        assertTrue(json.contains("\"client_uuid\":\"c1\""))
        assertTrue(json.contains("\"created_at_device\":\"2026-09-19T10:00:00Z\""))
        assertFalse(json.contains("rack_code"))
        assertEquals(90, Payloads.parse(json, CountPayload::class.java).qtyPhysical)
    }

    @Test fun auditPayloadRoundTrips() {
        val a = AuditEntity("a1", "print", "printer_socket", null, "cetak label", "{\"ip\":\"192.168.1.50\"}", 1789812000000L, "kirana")
        val p = Payloads.parse(Payloads.audit(a), AuditPayload::class.java)
        assertEquals("print", p.action)
        assertEquals("{\"ip\":\"192.168.1.50\"}", p.detailJson)
    }

    @Test fun proposalPayloadKeepsPhotoPathForLocalUse() {
        val p = ProposalEntity("p1", "s1", "899", "BAUT BARU", "Baut", 500, "U2 GUDANG2", "", "/data/photos/p1.jpg",
            "a".repeat(64), ProposalStatus.PENDING, null, 1789812000000L, "kirana")
        val parsed = Payloads.parse(Payloads.proposal(p), ProposalPayload::class.java)
        assertEquals("/data/photos/p1.jpg", parsed.photoPath)
        assertEquals("a".repeat(64), parsed.photoSha256)
        assertEquals(500, parsed.proposedQty)
    }
}
