package com.unison.stockopname.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.unison.stockopname.StockOpnameApp
import com.unison.stockopname.data.repo.MasterSyncResult

class MasterSyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val c = (applicationContext as StockOpnameApp).container
        if (c.auth.token() == null) return Result.success()

        val service = c.newMasterSync()
        val results = listOf(service.syncWarehouses(), service.syncItems())

        if (results.any { it is MasterSyncResult.AuthExpired }) {
            c.auth.markExpired()
            return Result.success()
        }
        val failed = results.filterIsInstance<MasterSyncResult.Failed>()
        return when {
            failed.isEmpty() -> Result.success()
            failed.any { it.retryable } -> Result.retry()
            else -> Result.failure()
        }
    }
}
