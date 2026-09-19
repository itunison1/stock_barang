package com.unison.stockopname.data.repo

import com.unison.stockopname.data.api.Payloads
import com.unison.stockopname.data.db.AppDatabase
import com.unison.stockopname.data.db.AuditEntity
import com.unison.stockopname.data.db.OutboxEntity
import com.unison.stockopname.data.db.OutboxType
import java.util.UUID

/** Catat audit lokal + antrikan ke outbox. Panggil di dalam transaksi pemanggil bila perlu atomik. */
class AuditWriter(
    private val db: AppDatabase,
    private val clock: () -> Long = System::currentTimeMillis,
    private val newUuid: () -> String = { UUID.randomUUID().toString() },
) {
    suspend fun record(
        operator: String,
        action: String,
        entityType: String,
        entityUuid: String?,
        description: String,
        detailJson: String? = null,
    ) {
        val audit = AuditEntity(newUuid(), action, entityType, entityUuid, description, detailJson, clock(), operator)
        db.audits().insert(audit)
        db.outbox().insert(
            OutboxEntity(
                type = OutboxType.AUDIT, clientUuid = audit.uuid,
                payloadJson = Payloads.audit(audit), createdAt = clock(),
            )
        )
    }
}
