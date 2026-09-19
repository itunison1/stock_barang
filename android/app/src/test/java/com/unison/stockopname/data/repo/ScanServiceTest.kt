package com.unison.stockopname.data.repo

import com.unison.stockopname.data.db.AppDatabase
import com.unison.stockopname.data.db.ProposalEntity
import com.unison.stockopname.data.db.ProposalStatus
import com.unison.stockopname.newTestDb
import com.unison.stockopname.testItem
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class ScanServiceTest {
    private lateinit var db: AppDatabase
    private lateinit var service: ScanService

    @Before fun setUp() { db = newTestDb(); service = ScanService(db) }
    @After fun tearDown() { db.close() }

    private fun proposal(barcode: String, status: String, reason: String? = null) = ProposalEntity(
        "p-$barcode", "s1", barcode, "BAUT BARU", "Baut", 100, "U2 GUDANG2", "", "/x.jpg", "a".repeat(64),
        status, reason, 1L, "kirana"
    )

    @Test fun registeredItemInSameWarehouseIsFoundWithoutMisplacement() = runBlocking {
        db.items().upsertAll(listOf(testItem("AB6C50", warehouse = "U2 GUDANG2")))
        val r = service.lookup("AB6C50", "U2 GUDANG2")!!
        val found = r.outcome as ScanOutcome.Found
        assertEquals("AB6C50", found.item.itemCode)
        assertNull(found.misplacement)
    }

    @Test fun itemRegisteredElsewhereRaisesMisplacement() = runBlocking {
        db.items().upsertAll(listOf(testItem("AB6C50", warehouse = "U2 GUDANG3")))
        val found = service.lookup("AB6C50", "U2 GUDANG1")!!.outcome as ScanOutcome.Found
        assertEquals("U2 GUDANG3", found.misplacement!!.registeredWarehouse)
    }

    @Test fun itemWithUnknownWarehouseNeverRaisesMisplacement() = runBlocking {
        db.items().upsertAll(listOf(testItem("AB6C50", warehouse = null)))
        assertNull((service.lookup("AB6C50", "U2 GUDANG1")!!.outcome as ScanOutcome.Found).misplacement)
    }

    @Test fun compositeBarcodeResolvesItemAndKeepsParsedFields() = runBlocking {
        db.items().upsertAll(listOf(testItem("AB6C50")))
        val r = service.lookup("AB6C50|LOT-7|120|2026-09-01", "U2 GUDANG2")!!
        assertTrue(r.outcome is ScanOutcome.Found)
        assertEquals(120, r.parsed.qty)
        assertEquals("LOT-7", r.parsed.lotNo)
    }

    @Test fun pendingAndApprovedProposalsBothReportPending() = runBlocking {
        db.proposals().insert(proposal("111", ProposalStatus.PENDING))
        db.proposals().insert(proposal("222", ProposalStatus.ACTIVE))
        assertTrue(service.lookup("111", "U2 GUDANG2")!!.outcome is ScanOutcome.Pending)
        assertTrue(service.lookup("222", "U2 GUDANG2")!!.outcome is ScanOutcome.Pending)
    }

    @Test fun rejectedProposalReportsRejectedWithReason() = runBlocking {
        db.proposals().insert(proposal("333", ProposalStatus.REJECTED, "Foto blur"))
        val o = service.lookup("333", "U2 GUDANG2")!!.outcome as ScanOutcome.Rejected
        assertEquals("Foto blur", o.proposal.rejectionReason)
    }

    @Test fun unknownBarcodeIsNotFound() = runBlocking {
        assertEquals(ScanOutcome.NotFound("999"), service.lookup("999", "U2 GUDANG2")!!.outcome)
    }

    @Test fun blankInputReturnsNull() = runBlocking {
        assertNull(service.lookup("   ", "U2 GUDANG2"))
    }
}
