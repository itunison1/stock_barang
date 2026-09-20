package com.unison.stockopname.data.repo

import androidx.room.withTransaction
import com.unison.stockopname.data.api.Payloads
import com.unison.stockopname.data.db.AppDatabase
import com.unison.stockopname.data.db.CountEntity
import com.unison.stockopname.data.db.ItemEntity
import com.unison.stockopname.data.db.OutboxEntity
import com.unison.stockopname.data.db.OutboxType
import com.unison.stockopname.data.db.SessionEntity
import com.unison.stockopname.domain.DuplicateAction
import com.unison.stockopname.domain.DuplicateCountPolicy
import com.unison.stockopname.domain.VarianceCalculator
import com.unison.stockopname.sync.SyncTrigger
import java.util.UUID

sealed class SaveCountResult {
    data class Saved(val record: CountEntity) : SaveCountResult()
    data class NeedsResolution(val existing: CountEntity) : SaveCountResult()
}

class CountService(
    private val db: AppDatabase,
    private val sync: SyncTrigger,
    private val audit: AuditWriter,
    private val clock: () -> Long = System::currentTimeMillis,
    private val newUuid: () -> String = { UUID.randomUUID().toString() },
) {
    /** [action] null saat hitungan pertama; bila sudah ada hitungan, wajib diisi operator (timpa/tambah). */
    suspend fun save(
        session: SessionEntity,
        item: ItemEntity,
        qty: Int,
        rackCode: String?,
        note: String,
        action: DuplicateAction?,
    ): SaveCountResult {
        require(qty >= 0) { "Qty tidak boleh negatif" }

        val existing = db.counts().latestForItem(session.uuid, item.itemCode)
        if (existing != null && action == null) return SaveCountResult.NeedsResolution(existing)

        val finalQty = DuplicateCountPolicy.resolve(existing?.qtyPhysical, qty, action)
        val variance = VarianceCalculator.variance(finalQty, item.stock)
        val misplaced = !item.warehouseCode.isNullOrBlank() && item.warehouseCode != session.warehouseCode
        val exceptionNote = if (misplaced) "[MISPLACED][EXPECTED:${item.warehouseCode}] ${note.trim()}" else note.trim()
        val record = CountEntity(
            uuid = newUuid(), sessionUuid = session.uuid, warehouseCode = session.warehouseCode,
            itemCode = item.itemCode, itemName = item.itemName, qtySystem = item.stock,
            qtyPhysical = finalQty, variance = variance,
            rackCode = rackCode?.trim()?.takeIf { it.isNotEmpty() },
            note = exceptionNote, supersedesUuid = existing?.uuid,
            createdAtDevice = clock(), operator = session.operator,
        )

        db.withTransaction {
            db.counts().insert(record)
            db.outbox().insert(
                OutboxEntity(type = OutboxType.COUNT, clientUuid = record.uuid, payloadJson = Payloads.count(record), createdAt = clock())
            )
            audit.record(
                session.operator, "stock_count", "count_record", record.uuid,
                "Hitung fisik ${item.itemName} di ${session.warehouseCode}: sistem ${fmt(item.stock)}, " +
                    "fisik $finalQty, selisih ${fmt(variance)}"
            )
        }
        sync.request()
        return SaveCountResult.Saved(record)
    }

    private fun fmt(d: Double): String = if (d % 1.0 == 0.0) d.toLong().toString() else d.toString()
}
