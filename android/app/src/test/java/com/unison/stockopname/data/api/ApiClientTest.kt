package com.unison.stockopname.data.api

import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class ApiClientTest {
    private lateinit var server: MockWebServer
    private var token: String? = "tok123"
    private lateinit var api: WmsApi

    @Before fun setUp() {
        server = MockWebServer().also { it.start() }
        api = ApiFactory.create(server.url("/stock/api/").toString()) { token }
    }

    @After fun tearDown() { server.shutdown() }

    private fun json(body: String, code: Int = 200) =
        MockResponse().setResponseCode(code).setHeader("Content-Type", "application/json").setBody(body)

    @Test fun loginParsesTokenAndSendsCredentialsWithoutAuthHeaderWhenNoToken() = runBlocking {
        token = null
        server.enqueue(json("""{"success":true,"data":{"token":"T","iduser":7,"username":"kirana","user_divisi":"Gudang","user_level":2}}"""))
        val r = apiCall(unauthorizedIsExpiry = false) { api.login(LoginRequest("kirana", "rahasia", "TC26")) }

        assertTrue(r is ApiResult.Ok)
        assertEquals("T", (r as ApiResult.Ok).data.token)
        assertEquals("Gudang", r.data.userDivisi)
        val req = server.takeRequest()
        assertEquals("/stock/api/login.php", req.path)
        assertEquals("POST", req.method)
        assertNull(req.getHeader("X-Auth-Token"))
        assertTrue(req.body.readUtf8().contains("\"username\":\"kirana\""))
    }

    @Test fun authenticatedCallsCarryTokenHeader() = runBlocking {
        server.enqueue(json("""{"success":true,"data":[{"code":"U2 GUDANG1","name":"Gudang 1"}]}"""))
        val r = apiCall { api.warehouses() }

        assertEquals("U2 GUDANG1", (r as ApiResult.Ok).data[0].code)
        assertEquals("tok123", server.takeRequest().getHeader("X-Auth-Token"))
    }

    @Test fun masterQueryParamsAndNullableFields() = runBlocking {
        server.enqueue(json(
            """{"success":true,"data":{"items":[{"id":1,"item_code":"AB6C50","item_name":"BAUT","stock":8500,
               "unit":"PCS","pack":"KARUNG","isi_per_pack":1000,"warehouse_code":null}],
               "next_after_id":1,"done":true,"server_time":"2026-09-19 10:00:00","supports_delta":false}}"""
        ))
        val r = apiCall { api.master(afterId = 0, limit = 2000, updatedSince = null) }

        val page = (r as ApiResult.Ok).data
        assertNull(page.items[0].warehouseCode)
        assertTrue(page.done)
        val path = server.takeRequest().path!!
        assertTrue(path.startsWith("/stock/api/master.php?"))
        assertTrue(path.contains("after_id=0") && path.contains("limit=2000"))
        assertFalse(path.contains("updated_since"))
    }

    @Test fun http401OnAuthCallMeansAuthExpired() = runBlocking {
        server.enqueue(json("""{"success":false,"message":"Token tidak valid."}""", 401))
        assertEquals(ApiResult.AuthExpired, apiCall { api.warehouses() })
    }

    @Test fun http401OnLoginIsPlainFailureWithServerMessage() = runBlocking {
        server.enqueue(json("""{"success":false,"message":"Username atau password salah."}""", 401))
        val r = apiCall(unauthorizedIsExpiry = false) { api.login(LoginRequest("a", "b", "d")) }
        assertEquals(ApiResult.Failure("Username atau password salah.", retryable = false), r)
    }

    @Test fun http503IsRetryable() = runBlocking {
        server.enqueue(json("""{"success":false,"message":"Tabel wms_counts belum dibuat."}""", 503))
        val r = apiCall { api.warehouses() } as ApiResult.Failure
        assertTrue(r.retryable)
        assertEquals("Tabel wms_counts belum dibuat.", r.message)
    }

    @Test fun http422IsNotRetryable() = runBlocking {
        server.enqueue(json("""{"success":false,"message":"qty_physical harus bilangan bulat >= 0"}""", 422))
        val r = apiCall { api.warehouses() } as ApiResult.Failure
        assertFalse(r.retryable)
    }

    @Test fun nonJsonErrorBodyFallsBackToHttpCodeMessage() = runBlocking {
        server.enqueue(MockResponse().setResponseCode(502).setBody("<html>Bad Gateway</html>"))
        val r = apiCall { api.warehouses() } as ApiResult.Failure
        assertTrue(r.retryable)
        assertTrue(r.message.contains("502"))
    }

    @Test fun networkDownIsRetryableFailure() = runBlocking {
        server.shutdown()
        val r = apiCall { api.warehouses() } as ApiResult.Failure
        assertTrue(r.retryable)
        assertTrue(r.message.contains("koneksi"))
    }

    @Test fun countPostSendsSnakeCaseJson() = runBlocking {
        server.enqueue(json("""{"success":true,"data":{"duplicate":false}}"""))
        val payload = CountPayload(
            clientUuid = "3f2b8c1e-5d4a-4c3b-9a1e-0123456789ab", sessionUuid = "4f2b8c1e-5d4a-4c3b-9a1e-0123456789ab",
            warehouseCode = "U2 GUDANG2", itemCode = "AB6C50", itemName = "BAUT", qtySystem = 100.0,
            qtyPhysical = 90, variance = -10.0, rackCode = null, note = "", supersedesUuid = null,
            createdAtDevice = "2026-09-19T10:00:00Z",
        )
        val r = apiCall { api.count(payload) }

        assertFalse((r as ApiResult.Ok).data.duplicate)
        val body = server.takeRequest().body.readUtf8()
        assertTrue(body.contains("\"client_uuid\":\"3f2b8c1e"))
        assertTrue(body.contains("\"qty_physical\":90"))
        assertTrue(body.contains("\"created_at_device\":\"2026-09-19T10:00:00Z\""))
    }

    @Test fun asUnitKeepsFailureAndDropsData() = runBlocking {
        server.enqueue(json("""{"success":true,"data":{"duplicate":true}}"""))
        assertEquals(ApiResult.Ok(Unit), apiCall { api.audit(AuditPayload("3f2b8c1e-5d4a-4c3b-9a1e-0123456789ab", "print", "printer_socket", null, "x", null, "2026-09-19T10:00:00Z")) }.asUnit())
    }
}
