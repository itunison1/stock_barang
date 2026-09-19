package com.unison.stockopname.data.repo

import com.unison.stockopname.data.api.ApiResult
import com.unison.stockopname.data.api.WmsApi
import com.unison.stockopname.data.api.apiCall
import com.unison.stockopname.data.db.ItemDao
import com.unison.stockopname.data.db.ItemEntity
import com.unison.stockopname.data.db.WarehouseDao
import com.unison.stockopname.data.db.WarehouseEntity
import com.unison.stockopname.data.prefs.KeyValueStore

sealed class MasterSyncResult {
    data class Ok(val itemsWritten: Int, val fullCycle: Boolean) : MasterSyncResult()
    object AuthExpired : MasterSyncResult()
    data class Failed(val message: String, val retryable: Boolean) : MasterSyncResult()
}

class MasterSyncService(
    private val api: WmsApi,
    private val itemDao: ItemDao,
    private val warehouseDao: WarehouseDao,
    private val store: KeyValueStore,
    private val pageSize: Int = 2000,
    private val clock: () -> Long = System::currentTimeMillis,
    private val fullRefreshEveryMs: Long = 7L * 24 * 3_600_000,
    private val noDeltaMinIntervalMs: Long = 6L * 3_600_000,
) {
    private sealed class Plan {
        object Skip : Plan()
        object Full : Plan()
        data class Delta(val since: String) : Plan()
    }

    suspend fun syncWarehouses(): MasterSyncResult = when (val r = apiCall { api.warehouses() }) {
        is ApiResult.Ok -> {
            warehouseDao.replaceAll(r.data.mapIndexed { i, w -> WarehouseEntity(w.code, w.name, i) })
            MasterSyncResult.Ok(r.data.size, fullCycle = true)
        }
        is ApiResult.AuthExpired -> MasterSyncResult.AuthExpired
        is ApiResult.Failure -> MasterSyncResult.Failed(r.message, r.retryable)
    }

    suspend fun syncItems(): MasterSyncResult {
        var afterId = store.getString(K_AFTER_ID)?.toLongOrNull()
        val since: String?
        if (afterId != null) {
            since = store.getString(K_CYCLE_SINCE)?.takeIf { it.isNotEmpty() }   // lanjutkan siklus terputus
        } else {
            since = when (val plan = plan()) {
                Plan.Skip -> return MasterSyncResult.Ok(0, fullCycle = false)
                Plan.Full -> null
                is Plan.Delta -> plan.since
            }
            afterId = 0L
            store.putString(K_CYCLE_SINCE, since ?: "")
            store.putString(K_CYCLE_SERVER_TIME, null)
        }

        var written = 0
        while (true) {
            when (val r = apiCall { api.master(afterId!!, pageSize, since) }) {
                is ApiResult.AuthExpired -> return MasterSyncResult.AuthExpired
                is ApiResult.Failure -> return MasterSyncResult.Failed(r.message, r.retryable)
                is ApiResult.Ok -> {
                    val page = r.data
                    itemDao.upsertAll(page.items.map {
                        ItemEntity(it.id, it.itemCode, it.itemName, it.stock, it.unit, it.pack, it.isiPerPack, it.warehouseCode)
                    })
                    written += page.items.size
                    if (store.getString(K_CYCLE_SERVER_TIME) == null) store.putString(K_CYCLE_SERVER_TIME, page.serverTime)

                    if (page.done) {
                        finishCycle(page.supportsDelta, fullCycle = since == null)
                        return MasterSyncResult.Ok(written, fullCycle = since == null)
                    }
                    if (page.nextAfterId <= afterId!!) {
                        return MasterSyncResult.Failed("Server tidak memajukan halaman master item.", retryable = false)
                    }
                    afterId = page.nextAfterId
                    store.putString(K_AFTER_ID, afterId.toString())
                }
            }
        }
    }

    private fun plan(): Plan {
        val lastFullAt = store.getString(K_LAST_FULL_AT)?.toLongOrNull() ?: return Plan.Full
        val age = clock() - lastFullAt
        val lastServerTime = store.getString(K_LAST_SERVER_TIME)
        return when {
            lastServerTime != null && age < fullRefreshEveryMs -> Plan.Delta(lastServerTime)
            lastServerTime == null && age < noDeltaMinIntervalMs -> Plan.Skip
            else -> Plan.Full
        }
    }

    private fun finishCycle(supportsDelta: Boolean, fullCycle: Boolean) {
        val cycleTime = store.getString(K_CYCLE_SERVER_TIME)
        store.putString(K_AFTER_ID, null)
        store.putString(K_CYCLE_SINCE, null)
        store.putString(K_CYCLE_SERVER_TIME, null)
        store.putString(K_LAST_SERVER_TIME, if (supportsDelta) cycleTime else null)
        if (fullCycle) store.putString(K_LAST_FULL_AT, clock().toString())
    }

    private companion object {
        const val K_AFTER_ID = "master_after_id"
        const val K_CYCLE_SINCE = "master_cycle_since"
        const val K_CYCLE_SERVER_TIME = "master_cycle_server_time"
        const val K_LAST_SERVER_TIME = "master_last_server_time"
        const val K_LAST_FULL_AT = "master_last_full_at"
    }
}
