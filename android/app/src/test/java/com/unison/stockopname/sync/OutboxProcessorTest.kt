package com.unison.stockopname.sync

import com.unison.stockopname.data.api.ApiResult
import com.unison.stockopname.data.db.AppDatabase
import com.unison.stockopname.data.db.OutboxEntity
import com.unison.stockopname.data.db.OutboxStatus
import com.unison.stockopname.newTestDb
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

private class FakeSender(private val script: (OutboxEntity) -> ApiResult<Unit>) : OutboxSender {
    val sent = mutableListOf<String>()
    override suspend fun send(entry: OutboxEntity): ApiResult<Unit> {
        sent += entry.clientUuid
        return script(entry)
    }
}

@RunWith(RobolectricTestRunner::class)
class OutboxProcessorTest {
    private lateinit var db: AppDatabase

    @Before fun setUp() { db = newTestDb() }
    @After fun tearDown() { db.close() }

    private suspend fun add(uuid: String, attempts: Int = 0) {
        db.outbox().insert(OutboxEntity(type = "COUNT", clientUuid = uuid, payloadJson = "{}", attempts = attempts, createdAt = 1L))
    }

    private suspend fun byUuid() = db.outbox().all().associateBy { it.clientUuid }

    @Test fun emptyOutboxIsDone() = runBlocking {
        assertEquals(SyncOutcome.DONE, OutboxProcessor(db.outbox(), FakeSender { ApiResult.Ok(Unit) }).runOnce())
    }

    @Test fun allSentInOrderMarksSent() = runBlocking {
        add("u1"); add("u2"); add("u3")
        val sender = FakeSender { ApiResult.Ok(Unit) }
        assertEquals(SyncOutcome.DONE, OutboxProcessor(db.outbox(), sender).runOnce())
        assertEquals(listOf("u1", "u2", "u3"), sender.sent)
        assertEquals(setOf(OutboxStatus.SENT), db.outbox().all().map { it.status }.toSet())
    }

    @Test fun retryableFailureStopsAndLeavesRestUntouched() = runBlocking {
        add("u1"); add("u2"); add("u3")
        val sender = FakeSender { if (it.clientUuid == "u2") ApiResult.Failure("Tidak ada koneksi", true) else ApiResult.Ok(Unit) }
        assertEquals(SyncOutcome.RETRY, OutboxProcessor(db.outbox(), sender).runOnce())

        assertEquals(listOf("u1", "u2"), sender.sent)
        val m = byUuid()
        assertEquals(OutboxStatus.SENT, m["u1"]!!.status)
        assertEquals(OutboxStatus.PENDING, m["u2"]!!.status)
        assertEquals(1, m["u2"]!!.attempts)
        assertEquals("Tidak ada koneksi", m["u2"]!!.lastError)
        assertEquals(0, m["u3"]!!.attempts)
    }

    @Test fun nonRetryableFailureMarksFailedAndContinues() = runBlocking {
        add("u1"); add("u2")
        val sender = FakeSender { if (it.clientUuid == "u1") ApiResult.Failure("qty_physical tidak valid", false) else ApiResult.Ok(Unit) }
        assertEquals(SyncOutcome.DONE, OutboxProcessor(db.outbox(), sender).runOnce())

        val m = byUuid()
        assertEquals(OutboxStatus.FAILED, m["u1"]!!.status)
        assertEquals("qty_physical tidak valid", m["u1"]!!.lastError)
        assertEquals(OutboxStatus.SENT, m["u2"]!!.status)
    }

    @Test fun authExpiredStopsWithoutChangingAnything() = runBlocking {
        add("u1"); add("u2")
        val sender = FakeSender { ApiResult.AuthExpired }
        assertEquals(SyncOutcome.AUTH_EXPIRED, OutboxProcessor(db.outbox(), sender).runOnce())
        assertEquals(listOf("u1"), sender.sent)
        assertEquals(setOf(OutboxStatus.PENDING), db.outbox().all().map { it.status }.toSet())
        assertEquals(0, byUuid()["u1"]!!.attempts)
    }

    @Test fun fifthRetryableFailureBecomesFailed() = runBlocking {
        add("u1", attempts = 4)
        val sender = FakeSender { ApiResult.Failure("Server error (HTTP 503).", true) }
        assertEquals(SyncOutcome.DONE, OutboxProcessor(db.outbox(), sender, maxAttempts = 5).runOnce())
        val e = byUuid()["u1"]!!
        assertEquals(OutboxStatus.FAILED, e.status)
        assertEquals(5, e.attempts)
    }
}
