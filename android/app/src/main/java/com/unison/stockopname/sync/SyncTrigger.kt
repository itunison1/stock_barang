package com.unison.stockopname.sync

/** Minta sinkronisasi outbox dijalankan (WorkManager di produksi, palsu di tes). */
fun interface SyncTrigger {
    fun request()
}

enum class SyncOutcome { DONE, RETRY, AUTH_EXPIRED }
