package com.unison.stockopname.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.unison.stockopname.StockOpnameApp

class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val c = (applicationContext as StockOpnameApp).container
        if (c.auth.token() == null) return Result.success() // belum login: outbox tetap menunggu

        return when (c.newOutboxProcessor().runOnce()) {
            SyncOutcome.DONE -> {
                c.newProposalStatusSync().refresh() // best-effort, gagal tidak menggagalkan sync
                Result.success()
            }
            SyncOutcome.RETRY -> Result.retry()
            SyncOutcome.AUTH_EXPIRED -> {
                c.auth.markExpired() // data lokal aman; operator login ulang saat membuka app
                Result.success()
            }
        }
    }
}
