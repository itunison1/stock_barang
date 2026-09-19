package com.unison.stockopname.data.repo

import com.unison.stockopname.FakeSyncTrigger
import com.unison.stockopname.data.db.AppDatabase
import com.unison.stockopname.data.db.OutboxType
import com.unison.stockopname.data.db.ProposalStatus
import com.unison.stockopname.newTestDb
import com.unison.stockopname.seqUuid
import com.unison.stockopname.testSession
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.File

@RunWith(RobolectricTestRunner::class)
class ProposalServiceTest {
    @get:Rule val tmp = TemporaryFolder()
    private lateinit var db: AppDatabase
    private lateinit var sync: FakeSyncTrigger
    private lateinit var service: ProposalService

    @Before fun setUp() {
        db = newTestDb()
        sync = FakeSyncTrigger()
        val uuid = seqUuid()
        service = ProposalService(db, sync, AuditWriter(db, { 5L }, uuid), { 5L }, uuid)
    }

    @After fun tearDown() { db.close() }

    private fun photo(content: String = "abc"): File = tmp.newFile().apply { writeText(content) }

    @Test fun createsPendingProposalWithPhotoHashAndQueuesIt() = runBlocking {
        val p = service.create(testSession(), " 8992001001999 ", " BAUT BARU ", "Baut", 500, "temuan", photo("abc"))

        assertEquals(ProposalStatus.PENDING, p.status)
        assertEquals("8992001001999", p.barcode)
        assertEquals("BAUT BARU", p.name)
        assertEquals("U2 GUDANG2", p.warehouseCode)
        assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", p.photoSha256)
        assertEquals(p.uuid, db.proposals().findByBarcode("8992001001999")!!.uuid)
        assertEquals(listOf(OutboxType.PROPOSAL, OutboxType.AUDIT), db.outbox().all().map { it.type })
        assertEquals(1, sync.calls)
    }

    @Test fun photoIsMandatory() {
        val missing = File(tmp.root, "tidak-ada.jpg")
        assertThrows(IllegalArgumentException::class.java) {
            runBlocking { service.create(testSession(), "1", "BAUT", "Baut", 1, "", missing) }
        }
        assertEquals(0, runBlocking { db.outbox().all().size })
    }

    @Test fun emptyPhotoFileIsRejected() {
        assertThrows(IllegalArgumentException::class.java) {
            runBlocking { service.create(testSession(), "1", "BAUT", "Baut", 1, "", photo("")) }
        }
    }

    @Test fun blankNameIsRejected() {
        assertThrows(IllegalArgumentException::class.java) {
            runBlocking { service.create(testSession(), "1", "   ", "Baut", 1, "", photo()) }
        }
    }
}
