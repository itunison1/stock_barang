package com.unison.stockopname.data.repo

import com.unison.stockopname.InMemoryKeyValueStore
import com.unison.stockopname.data.api.ApiFactory
import com.unison.stockopname.data.db.AppDatabase
import com.unison.stockopname.newTestDb
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class MasterSyncServiceTest {
    private lateinit var db: AppDatabase
    private lateinit var server: MockWebServer
    private lateinit var store: InMemoryKeyValueStore
    private var now = 1_000_000_000L
    private val hour = 3_600_000L

    @Before fun setUp() {
        db = newTestDb()
        server = MockWebServer().also { it.start() }
        store = InMemoryKeyValueStore()
    }

    @After fun tearDown() { db.close(); server.shutdown() }

    private fun service() = MasterSyncService(
        ApiFactory.create(server.url("/stock/api/").toString()) { "tok" },
        db.items(), db.warehouses(), store, pageSize = 2, clock = { now },
    )

    private fun item(id: Int, wh: String? = "U2 GUDANG2") =
        """{"id":$id,"item_code":"C$id","item_name":"BAUT $id","stock":${id * 10},"unit":"PCS","pack":"KARUNG","isi_per_pack":1000,"warehouse_code":${if (wh == null) "null" else "\"$wh\""}}"""

    private fun page(ids: List<Int>, next: Int, done: Boolean, serverTime: String = "2026-09-19 10:00:00", delta: Boolean = true) =
        MockResponse().setHeader("Content-Type", "application/json").setBody(
            """{"success":true,"data":{"items":[${ids.joinToString(",") { item(it) }}],"next_after_id":$next,"done":$done,"server_time":"$serverTime","supports_delta":$delta}}"""
        )

    @Test fun fullSyncWritesAllPagesAndClearsCursor() = runBlocking {
        server.enqueue(page(listOf(1, 2), next = 2, done = false))
        server.enqueue(page(listOf(3), next = 3, done = true))

        val r = service().syncItems() as MasterSyncResult.Ok

        assertEquals(3, r.itemsWritten)
        assertTrue(r.fullCycle)
        assertEquals(3, db.items().count())
        assertNull(store.getString("master_after_id"))
        server.takeRequest()
        assertEquals("2", server.takeRequest().requestUrl!!.queryParameter("after_id"))
    }

    @Test fun nullWarehouseFromServerIsStoredAsNull() = runBlocking {
        server.enqueue(
            MockResponse().setHeader("Content-Type", "application/json").setBody(
                """{"success":true,"data":{"items":[${item(9, wh = null)}],"next_after_id":9,"done":true,"server_time":"t","supports_delta":false}}"""
            )
        )
        service().syncItems()
        assertNull(db.items().findByCode("C9")!!.warehouseCode)
    }

    @Test fun resumesFromStoredCursor() = runBlocking {
        store.putString("master_after_id", "2")
        store.putString("master_cycle_since", "")
        server.enqueue(page(listOf(3), next = 3, done = true))

        service().syncItems()

        assertEquals("2", server.takeRequest().requestUrl!!.queryParameter("after_id"))
    }

    @Test fun failureMidwayKeepsCursorAndReportsRetryable() = runBlocking {
        server.enqueue(page(listOf(1, 2), next = 2, done = false))
        server.enqueue(MockResponse().setResponseCode(503).setBody("""{"success":false,"message":"DB sibuk"}"""))

        val r = service().syncItems() as MasterSyncResult.Failed

        assertTrue(r.retryable)
        assertEquals("2", store.getString("master_after_id"))
        assertEquals(2, db.items().count())
    }

    @Test fun deltaCycleSendsUpdatedSinceFromFirstPageServerTime() = runBlocking {
        server.enqueue(page(listOf(1), next = 1, done = true, serverTime = "2026-09-19 10:00:00", delta = true))
        service().syncItems()
        server.takeRequest()

        now += hour
        server.enqueue(page(listOf(1), next = 1, done = true, serverTime = "2026-09-19 11:00:00", delta = true))
        val second = service().syncItems() as MasterSyncResult.Ok

        assertEquals(false, second.fullCycle)
        assertEquals("2026-09-19 10:00:00", server.takeRequest().requestUrl!!.queryParameter("updated_since"))
    }

    @Test fun fullCycleForcedAfterSevenDays() = runBlocking {
        server.enqueue(page(listOf(1), next = 1, done = true, delta = true))
        service().syncItems()
        server.takeRequest()

        now += 8 * 24 * hour
        server.enqueue(page(listOf(1), next = 1, done = true, delta = true))
        val r = service().syncItems() as MasterSyncResult.Ok

        assertTrue(r.fullCycle)
        assertNull(server.takeRequest().requestUrl!!.queryParameter("updated_since"))
    }

    @Test fun serverWithoutDeltaIsSkippedWithinSixHours() = runBlocking {
        server.enqueue(page(listOf(1), next = 1, done = true, delta = false))
        service().syncItems()

        now += 2 * hour
        val r = service().syncItems() as MasterSyncResult.Ok

        assertEquals(0, r.itemsWritten)
        assertEquals(1, server.requestCount)
    }

    @Test fun serverWithoutDeltaSyncsFullAgainAfterSixHours() = runBlocking {
        server.enqueue(page(listOf(1), next = 1, done = true, delta = false))
        service().syncItems()

        now += 7 * hour
        server.enqueue(page(listOf(1), next = 1, done = true, delta = false))
        val r = service().syncItems() as MasterSyncResult.Ok

        assertTrue(r.fullCycle)
        assertEquals(2, server.requestCount)
    }

    @Test fun stalledServerCursorIsPermanentFailure() = runBlocking {
        server.enqueue(page(listOf(1), next = 0, done = false))
        val r = service().syncItems() as MasterSyncResult.Failed
        assertEquals(false, r.retryable)
    }

    @Test fun expiredTokenReportsAuthExpired() = runBlocking {
        server.enqueue(MockResponse().setResponseCode(401).setBody("""{"success":false,"message":"Token tidak valid."}"""))
        assertEquals(MasterSyncResult.AuthExpired, service().syncItems())
    }

    @Test fun warehousesReplaceTableInServerOrder() = runBlocking {
        server.enqueue(
            MockResponse().setHeader("Content-Type", "application/json")
                .setBody("""{"success":true,"data":[{"code":"U2 GUDANG1","name":"G1"},{"code":"U1","name":"U1"}]}""")
        )
        val r = service().syncWarehouses() as MasterSyncResult.Ok
        assertEquals(2, r.itemsWritten)
        assertEquals(listOf("U2 GUDANG1", "U1"), db.warehouses().all().map { it.code })
    }
}
