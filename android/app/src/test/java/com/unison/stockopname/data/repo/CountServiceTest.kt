package com.unison.stockopname.data.repo

import com.unison.stockopname.FakeSyncTrigger
import com.unison.stockopname.data.db.AppDatabase
import com.unison.stockopname.data.db.OutboxType
import com.unison.stockopname.domain.DuplicateAction
import com.unison.stockopname.newTestDb
import com.unison.stockopname.seqUuid
import com.unison.stockopname.testItem
import com.unison.stockopname.testSession
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class CountServiceTest {
    private lateinit var db: AppDatabase
    private lateinit var sync: FakeSyncTrigger
    private lateinit var service: CountService
    private var now = 1000L

    @Before fun setUp() {
        db = newTestDb()
        sync = FakeSyncTrigger()
        val uuid = seqUuid()
        val clock = { now++ }
        service = CountService(db, sync, AuditWriter(db, clock, uuid), clock, uuid)
    }

    @After fun tearDown() { db.close() }

    private val session = testSession()
    private val item = testItem("AB6C50", stock = 100.0)

    @Test fun firstSaveRecordsVarianceAndQueuesCountAndAudit() = runBlocking {
        val saved = service.save(session, item, 90, null, "  ok  ", null) as SaveCountResult.Saved

        assertEquals(90, saved.record.qtyPhysical)
        assertEquals(-10.0, saved.record.variance, 0.0001)
        assertEquals("ok", saved.record.note)
        assertEquals("U2 GUDANG2", saved.record.warehouseCode)
        assertNull(saved.record.supersedesUuid)
        assertEquals(listOf(OutboxType.COUNT, OutboxType.AUDIT), db.outbox().all().map { it.type })
        assertEquals(1, sync.calls)
    }

    @Test fun secondSaveWithoutActionAsksForResolutionAndWritesNothing() = runBlocking {
        service.save(session, item, 90, null, "", null)
        val r = service.save(session, item, 10, null, "", null)

        assertEquals(90, (r as SaveCountResult.NeedsResolution).existing.qtyPhysical)
        assertEquals(2, db.outbox().all().size)
        assertEquals(1, sync.calls)
    }

    @Test fun overwriteReplacesQtyAndLinksSupersedes() = runBlocking {
        val first = (service.save(session, item, 90, null, "", null) as SaveCountResult.Saved).record
        val second = (service.save(session, item, 40, null, "", DuplicateAction.OVERWRITE) as SaveCountResult.Saved).record

        assertEquals(40, second.qtyPhysical)
        assertEquals(-60.0, second.variance, 0.0001)
        assertEquals(first.uuid, second.supersedesUuid)
    }

    @Test fun addSumsWithPreviousCount() = runBlocking {
        service.save(session, item, 90, null, "", null)
        val second = (service.save(session, item, 40, null, "", DuplicateAction.ADD) as SaveCountResult.Saved).record
        assertEquals(130, second.qtyPhysical)
        assertEquals(30.0, second.variance, 0.0001)
    }

    @Test fun blankRackBecomesNullAndRealRackIsKept() = runBlocking {
        val a = (service.save(session, item, 1, "   ", "", null) as SaveCountResult.Saved).record
        assertNull(a.rackCode)
        val other = testItem("AB6102")
        val b = (service.save(session, other, 1, " RAK-B-03 ", "", null) as SaveCountResult.Saved).record
        assertEquals("RAK-B-03", b.rackCode)
    }

    @Test fun negativeQtyIsRejected() {
        assertThrows(IllegalArgumentException::class.java) {
            runBlocking { service.save(session, item, -1, null, "", null) }
        }
    }
}
