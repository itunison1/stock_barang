package com.unison.stockopname.data.repo

import com.unison.stockopname.data.db.AppDatabase
import com.unison.stockopname.data.db.OutboxType
import com.unison.stockopname.data.db.WarehouseEntity
import com.unison.stockopname.newTestDb
import com.unison.stockopname.seqUuid
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class SessionServiceTest {
    private lateinit var db: AppDatabase
    private lateinit var service: SessionService

    @Before fun setUp() {
        db = newTestDb()
        val uuid = seqUuid()
        service = SessionService(db, AuditWriter(db, { 100L }, uuid), { 100L }, uuid)
        runBlocking {
            db.warehouses().replaceAll(listOf(WarehouseEntity("U2 GUDANG1", "G1", 0), WarehouseEntity("U2 GUDANG2", "G2", 1)))
        }
    }

    @After fun tearDown() { db.close() }

    @Test fun scanningKnownWarehouseCreatesSessionAndAudit() = runBlocking {
        val r = service.lock("kirana", "u2 gudang2") as LockResult.Locked
        assertTrue(r.created)
        assertEquals("U2 GUDANG2", r.session.warehouseCode)
        assertEquals("kirana", r.session.operator)
        assertEquals(listOf(OutboxType.AUDIT), db.outbox().all().map { it.type })
    }

    @Test fun lockingSameWarehouseAgainReusesSession() = runBlocking {
        val first = service.lock("kirana", "U2 GUDANG2") as LockResult.Locked
        val second = service.lock("kirana", "U2 GUDANG2") as LockResult.Locked
        assertFalse(second.created)
        assertEquals(first.session.uuid, second.session.uuid)
        assertEquals(1, db.outbox().all().size)
    }

    @Test fun lockingAnotherWarehouseFinishesPreviousSession() = runBlocking {
        service.lock("kirana", "U2 GUDANG1")
        service.lock("kirana", "U2 GUDANG2")
        assertNull(db.sessions().findOpen("kirana", "U2 GUDANG1"))
        assertEquals("U2 GUDANG2", db.sessions().findOpen("kirana", "U2 GUDANG2")!!.warehouseCode)
    }

    @Test fun unknownWarehouseIsRejected() = runBlocking {
        assertEquals(LockResult.UnknownWarehouse("XYZ"), service.lock("kirana", "XYZ"))
        assertEquals(0, db.outbox().all().size)
    }
}
