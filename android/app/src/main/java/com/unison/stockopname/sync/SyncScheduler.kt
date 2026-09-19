package com.unison.stockopname.sync

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

/** Sinkronisasi otomatis saat WiFi/jaringan tersedia (Bab 4.2). */
object SyncScheduler {
    private const val OUTBOX = "outbox-sync"
    private const val OUTBOX_PERIODIC = "outbox-sync-periodic"
    private const val MASTER = "master-sync"
    private const val MASTER_PERIODIC = "master-sync-periodic"

    private val connected = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

    fun requestOutboxSync(context: Context) {
        val work = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(connected)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork(OUTBOX, ExistingWorkPolicy.APPEND_OR_REPLACE, work)
    }

    fun requestMasterSync(context: Context) {
        val work = OneTimeWorkRequestBuilder<MasterSyncWorker>()
            .setConstraints(connected)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork(MASTER, ExistingWorkPolicy.KEEP, work)
    }

    fun schedulePeriodic(context: Context) {
        val wm = WorkManager.getInstance(context)
        wm.enqueueUniquePeriodicWork(
            OUTBOX_PERIODIC, ExistingPeriodicWorkPolicy.KEEP,
            PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES).setConstraints(connected).build()
        )
        wm.enqueueUniquePeriodicWork(
            MASTER_PERIODIC, ExistingPeriodicWorkPolicy.KEEP,
            PeriodicWorkRequestBuilder<MasterSyncWorker>(6, TimeUnit.HOURS).setConstraints(connected).build()
        )
    }
}
