package com.unison.stockopname.data.repo

import com.unison.stockopname.data.api.ApiFactory
import com.unison.stockopname.data.api.ApiResult
import com.unison.stockopname.data.db.AppDatabase
import com.unison.stockopname.data.db.ProposalEntity
import com.unison.stockopname.data.db.ProposalStatus
import com.unison.stockopname.newTestDb
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class ProposalStatusSyncTest {
    private lateinit var db: AppDatabase
    private lateinit var server: MockWebServer

    @Before fun setUp() { db = newTestDb(); server = MockWebServer().also { it.start() } }
    @After fun tearDown() { db.close(); server.shutdown() }

    private fun sync() = ProposalStatusSync(ApiFactory.create(server.url("/stock/api/").toString()) { "tok" }, db.proposals())

    private suspend fun local(uuid: String, barcode: String) = db.proposals().insert(
        ProposalEntity(uuid, "s1", barcode, "BAUT", "Baut", 1, "U2 GUDANG2", "", "/x.jpg", "a".repeat(64),
            ProposalStatus.PENDING, null, 1L, "kirana")
    )

    @Test fun appliesApprovedAndRejectedStatuses() = runBlocking {
        local("p1", "111"); local("p2", "222")
        server.enqueue(
            MockResponse().setHeader("Content-Type", "application/json").setBody(
                """{"success":true,"data":[
                    {"client_uuid":"p1","status":"active","rejection_reason":null,"approved_at":"2026-09-19 12:00:00"},
                    {"client_uuid":"p2","status":"rejected","rejection_reason":"Foto blur","approved_at":"2026-09-19 12:01:00"}]}"""
            )
        )
        assertEquals(ApiResult.Ok(2), sync().refresh())
        assertEquals(ProposalStatus.ACTIVE, db.proposals().findByBarcode("111")!!.status)
        val rejected = db.proposals().findByBarcode("222")!!
        assertEquals(ProposalStatus.REJECTED, rejected.status)
        assertEquals("Foto blur", rejected.rejectionReason)
    }

    @Test fun unknownStatusValueIsIgnored() = runBlocking {
        local("p1", "111")
        server.enqueue(
            MockResponse().setHeader("Content-Type", "application/json")
                .setBody("""{"success":true,"data":[{"client_uuid":"p1","status":"aneh","rejection_reason":null,"approved_at":null}]}""")
        )
        assertEquals(ApiResult.Ok(0), sync().refresh())
        assertEquals(ProposalStatus.PENDING, db.proposals().findByBarcode("111")!!.status)
    }

    @Test fun authExpiredIsPropagated() = runBlocking {
        server.enqueue(MockResponse().setResponseCode(401).setBody("""{"success":false,"message":"x"}"""))
        assertEquals(ApiResult.AuthExpired, sync().refresh())
    }
}
