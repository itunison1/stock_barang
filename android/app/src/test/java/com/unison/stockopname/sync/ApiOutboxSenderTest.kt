package com.unison.stockopname.sync

import com.unison.stockopname.data.api.ApiFactory
import com.unison.stockopname.data.api.ApiResult
import com.unison.stockopname.data.api.Payloads
import com.unison.stockopname.data.db.AuditEntity
import com.unison.stockopname.data.db.CountEntity
import com.unison.stockopname.data.db.OutboxEntity
import com.unison.stockopname.data.db.OutboxType
import com.unison.stockopname.data.db.ProposalEntity
import com.unison.stockopname.data.db.ProposalStatus
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class ApiOutboxSenderTest {
    @get:Rule val tmp = TemporaryFolder()
    private lateinit var server: MockWebServer
    private lateinit var sender: ApiOutboxSender

    @Before fun setUp() {
        server = MockWebServer().also { it.start() }
        sender = ApiOutboxSender(ApiFactory.create(server.url("/stock/api/").toString()) { "tok" })
    }

    @After fun tearDown() { server.shutdown() }

    private fun ok(duplicate: Boolean = false) = MockResponse().setHeader("Content-Type", "application/json")
        .setBody("""{"success":true,"data":{"duplicate":$duplicate}}""")

    private fun entry(type: String, payload: String) =
        OutboxEntity(id = 1, type = type, clientUuid = "x", payloadJson = payload, createdAt = 1L)

    @Test fun countGoesToCountEndpoint() = runBlocking {
        server.enqueue(ok())
        val c = CountEntity("c1", "s1", "U2 GUDANG2", "AB6C50", "BAUT", 100.0, 90, -10.0, null, "", null, 1L, "kirana")
        assertEquals(ApiResult.Ok(Unit), sender.send(entry(OutboxType.COUNT, Payloads.count(c))))
        assertEquals("/stock/api/count.php", server.takeRequest().path)
    }

    @Test fun auditGoesToAuditEndpointAndDuplicateCountsAsOk() = runBlocking {
        server.enqueue(ok(duplicate = true))
        val a = AuditEntity("a1", "print", "printer_socket", null, "cetak", null, 1L, "kirana")
        assertEquals(ApiResult.Ok(Unit), sender.send(entry(OutboxType.AUDIT, Payloads.audit(a))))
        assertEquals("/stock/api/audit.php", server.takeRequest().path)
    }

    @Test fun proposalSendsMultipartWithPhotoFile() = runBlocking {
        server.enqueue(ok())
        val photo = tmp.newFile("p1.jpg").apply { writeBytes(byteArrayOf(1, 2, 3, 4)) }
        val p = ProposalEntity("p1", "s1", "899", "BAUT BARU", "Baut", 500, "U2 GUDANG2", "", photo.absolutePath,
            "a".repeat(64), ProposalStatus.PENDING, null, 1L, "kirana")

        assertEquals(ApiResult.Ok(Unit), sender.send(entry(OutboxType.PROPOSAL, Payloads.proposal(p))))

        val req = server.takeRequest()
        assertEquals("/stock/api/proposal.php", req.path)
        assertTrue(req.getHeader("Content-Type")!!.startsWith("multipart/form-data"))
        val body = req.body.readUtf8()
        assertTrue(body.contains("name=\"client_uuid\""))
        assertTrue(body.contains("name=\"photo_sha256\""))
        assertTrue(body.contains("name=\"photo\"; filename=\"p1.jpg\""))
        assertFalse("photo_path must not be sent", body.contains("photo_path"))
    }

    @Test fun missingPhotoFileIsPermanentFailure() = runBlocking {
        val p = ProposalEntity("p1", "s1", "899", "BAUT", "Baut", 1, "U2 GUDANG2", "", "/tidak/ada.jpg",
            "a".repeat(64), ProposalStatus.PENDING, null, 1L, "kirana")
        val r = sender.send(entry(OutboxType.PROPOSAL, Payloads.proposal(p))) as ApiResult.Failure
        assertFalse(r.retryable)
        assertTrue(r.message.contains("foto"))
    }

    @Test fun unknownTypeIsPermanentFailure() = runBlocking {
        val r = sender.send(entry("BEDA", "{}")) as ApiResult.Failure
        assertFalse(r.retryable)
    }
}
