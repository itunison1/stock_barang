package com.unison.stockopname.sync

import com.unison.stockopname.data.api.ApiResult
import com.unison.stockopname.data.db.OutboxDao
import com.unison.stockopname.data.db.OutboxEntity
import com.unison.stockopname.data.db.OutboxStatus

interface OutboxSender {
    suspend fun send(entry: OutboxEntity): ApiResult<Unit>
}

/**
 * Kirim outbox berurutan (id naik). Gagal sementara (jaringan/5xx): berhenti supaya tidak menghajar server,
 * attempts naik, jadi FAILED setelah [maxAttempts]. Gagal permanen (4xx): FAILED, lanjut ke entri berikutnya.
 * 401: berhenti tanpa mengubah apa pun.
 */
class OutboxProcessor(
    private val dao: OutboxDao,
    private val sender: OutboxSender,
    private val maxAttempts: Int = 5,
) {
    suspend fun runOnce(): SyncOutcome {
        while (true) {
            val batch = dao.nextPending(BATCH)
            if (batch.isEmpty()) return SyncOutcome.DONE
            for (entry in batch) {
                when (val result = sender.send(entry)) {
                    is ApiResult.Ok -> dao.update(entry.copy(status = OutboxStatus.SENT, lastError = null))
                    is ApiResult.AuthExpired -> return SyncOutcome.AUTH_EXPIRED
                    is ApiResult.Failure -> {
                        val attempts = entry.attempts + 1
                        if (!result.retryable || attempts >= maxAttempts) {
                            dao.update(entry.copy(status = OutboxStatus.FAILED, attempts = attempts, lastError = result.message))
                        } else {
                            dao.update(entry.copy(attempts = attempts, lastError = result.message))
                            return SyncOutcome.RETRY
                        }
                    }
                }
            }
        }
    }

    private companion object { const val BATCH = 50 }
}
