package com.unison.stockopname.data.repo

import androidx.room.withTransaction
import com.unison.stockopname.data.db.AppDatabase
import com.unison.stockopname.data.db.SessionEntity
import com.unison.stockopname.data.db.WarehouseEntity
import java.util.UUID

sealed class LockResult {
    data class Locked(val session: SessionEntity, val warehouse: WarehouseEntity, val created: Boolean) : LockResult()
    data class UnknownWarehouse(val scanned: String) : LockResult()
}

/** Penguncian sesi gudang (Bab 2.1): satu sesi aktif per operator. */
class SessionService(
    private val db: AppDatabase,
    private val audit: AuditWriter,
    private val clock: () -> Long = System::currentTimeMillis,
    private val newUuid: () -> String = { UUID.randomUUID().toString() },
) {
    suspend fun lock(operator: String, scannedCode: String): LockResult {
        val warehouse = db.warehouses().findByCode(scannedCode.trim())
            ?: return LockResult.UnknownWarehouse(scannedCode.trim())

        return db.withTransaction {
            val open = db.sessions().findOpen(operator, warehouse.code)
            if (open != null) {
                LockResult.Locked(open, warehouse, created = false)
            } else {
                db.sessions().finishOthers(operator, warehouse.code, clock())
                val session = SessionEntity(newUuid(), operator, warehouse.code, clock(), null)
                db.sessions().insert(session)
                audit.record(operator, "session_lock", "session", session.uuid, "Sesi opname terkunci di ${warehouse.code}")
                LockResult.Locked(session, warehouse, created = true)
            }
        }
    }
}
