package com.unison.stockopname.data.db

import com.unison.stockopname.newTestDb
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class DaoTest {
    private lateinit var db: AppDatabase

    @Before fun setUp() { db = newTestDb() }
    @After fun tearDown() { db.close() }

    private fun item(id: Long, code: String, wh: String? = "U2 GUDANG3") =
        ItemEntity(id, code, "BAUT $code", 100.0, "PCS", "KARUNG", 1000.0, wh)

    private fun outbox(uuid: String, type: String = OutboxType.COUNT) =
        OutboxEntity(type = type, clientUuid = uuid, payloadJson = "{}", createdAt = 1L)

    @Test fun itemUpsertReplacesAndFindsByCode() = runBlocking {
        db.items().upsertAll(listOf(item(1, "AB6C50"), item(2, "AB6102")))
        db.items().upsertAll(listOf(item(1, "AB6C50").copy(stock = 250.0)))
        assertEquals(2, db.items().count())
        assertEquals(250.0, db.items().findByCode("AB6C50")!!.stock, 0.0)
        assertNull(db.items().findByCode("TIDAK-ADA"))
    }

    @Test fun itemKeepsNullWarehouse() = runBlocking {
        db.items().upsertAll(listOf(item(3, "X1", wh = null)))
        assertNull(db.items().findByCode("X1")!!.warehouseCode)
    }

    @Test fun warehouseReplaceAllAndCaseInsensitiveLookup() = runBlocking {
        db.warehouses().replaceAll(listOf(WarehouseEntity("U2 GUDANG1", "Gudang 1", 0)))
        db.warehouses().replaceAll(listOf(WarehouseEntity("U2 GUDANG2", "Gudang 2", 0), WarehouseEntity("U1", "U1", 1)))
        assertEquals(listOf("U2 GUDANG2", "U1"), db.warehouses().all().map { it.code })
        assertNotNull(db.warehouses().findByCode("u2 gudang2"))
        assertNull(db.warehouses().findByCode("U2 GUDANG1"))
    }

    @Test fun openSessionIsFoundPerOperatorAndWarehouseUntilFinished() = runBlocking {
        db.sessions().insert(SessionEntity("s1", "kirana", "U2 GUDANG2", 10L, null))
        assertEquals("s1", db.sessions().findOpen("kirana", "U2 GUDANG2")!!.uuid)
        assertNull(db.sessions().findOpen("rangga", "U2 GUDANG2"))
        db.sessions().finish("s1", 99L)
        assertNull(db.sessions().findOpen("kirana", "U2 GUDANG2"))
    }

    @Test fun latestCountForItemInSessionIsMostRecent() = runBlocking {
        fun count(uuid: String, at: Long, qty: Int) = CountEntity(
            uuid, "s1", "U2 GUDANG2", "AB6C50", "BAUT", 100.0, qty, qty - 100.0, null, "", null, at, "kirana"
        )
        db.counts().insert(count("c1", 10L, 50))
        db.counts().insert(count("c2", 20L, 70))
        assertEquals("c2", db.counts().latestForItem("s1", "AB6C50")!!.uuid)
        assertNull(db.counts().latestForItem("s1", "LAIN"))
        assertNull(db.counts().latestForItem("s2", "AB6C50"))
    }

    @Test fun proposalFoundByBarcodeAndStatusUpdatable() = runBlocking {
        db.proposals().insert(
            ProposalEntity("p1", "s1", "899", "BAUT BARU", "Baut", 500, "U2 GUDANG2", "", "/x.jpg", "a".repeat(64),
                ProposalStatus.PENDING, null, 5L, "kirana")
        )
        assertEquals(ProposalStatus.PENDING, db.proposals().findByBarcode("899")!!.status)
        db.proposals().updateStatus("p1", ProposalStatus.REJECTED, "Foto blur")
        val p = db.proposals().findByBarcode("899")!!
        assertEquals(ProposalStatus.REJECTED, p.status)
        assertEquals("Foto blur", p.rejectionReason)
    }

    @Test fun outboxKeepsInsertOrderAndIgnoresDuplicateUuid() = runBlocking {
        db.outbox().insert(outbox("u1"))
        db.outbox().insert(outbox("u2", OutboxType.AUDIT))
        db.outbox().insert(outbox("u1")) // duplikat, diabaikan
        assertEquals(listOf("u1", "u2"), db.outbox().nextPending(10).map { it.clientUuid })
    }

    @Test fun outboxStatusTransitionsAndResetFailed() = runBlocking {
        db.outbox().insert(outbox("u1"))
        db.outbox().insert(outbox("u2"))
        val (a, b) = db.outbox().nextPending(10)
        db.outbox().update(a.copy(status = OutboxStatus.SENT))
        db.outbox().update(b.copy(status = OutboxStatus.FAILED, attempts = 5, lastError = "x"))
        assertEquals(0, db.outbox().nextPending(10).size)
        assertEquals(1, db.outbox().failed().size)
        db.outbox().resetFailed()
        val again = db.outbox().nextPending(10)
        assertEquals(listOf("u2"), again.map { it.clientUuid })
        assertEquals(0, again[0].attempts)
    }

    @Test fun printerSeedsAreStoredAndUpdatable() = runBlocking {
        db.printers().upsertAll(listOf(PrinterEntity(1, "Meja", "192.168.1.50", 9100, "MM80")))
        db.printers().update(db.printers().findById(1)!!.copy(host = "192.168.1.60"))
        assertEquals("192.168.1.60", db.printers().all().first().host)
    }
}
