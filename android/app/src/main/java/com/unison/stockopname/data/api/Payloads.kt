package com.unison.stockopname.data.api

import com.google.gson.Gson
import com.unison.stockopname.data.db.AuditEntity
import com.unison.stockopname.data.db.CountEntity
import com.unison.stockopname.data.db.ProposalEntity
import java.time.Instant

object Payloads {
    private val gson = Gson()

    fun isoUtc(epochMs: Long): String = Instant.ofEpochMilli(epochMs).toString()

    fun count(c: CountEntity): String = gson.toJson(
        CountPayload(
            clientUuid = c.uuid, sessionUuid = c.sessionUuid, warehouseCode = c.warehouseCode,
            expectedWarehouse = c.note.substringAfter("[EXPECTED:", "").substringBefore("]").takeIf { it.isNotBlank() },
            exceptionType = if (c.note.contains("[MISPLACED]")) "MISPLACED" else null,
            itemCode = c.itemCode, itemName = c.itemName, qtySystem = c.qtySystem,
            qtyPhysical = c.qtyPhysical, variance = c.variance, rackCode = c.rackCode, note = c.note,
            supersedesUuid = c.supersedesUuid, createdAtDevice = isoUtc(c.createdAtDevice),
        )
    )

    fun audit(a: AuditEntity): String = gson.toJson(
        AuditPayload(
            clientUuid = a.uuid, action = a.action, entityType = a.entityType, entityUuid = a.entityUuid,
            description = a.description, detailJson = a.detailJson, createdAtDevice = isoUtc(a.createdAtDevice),
        )
    )

    fun proposal(p: ProposalEntity): String = gson.toJson(
        ProposalPayload(
            clientUuid = p.uuid, sessionUuid = p.sessionUuid, barcode = p.barcode, name = p.name,
            category = p.category, proposedQty = p.proposedQty, warehouseCode = p.warehouseCode,
            notes = p.notes, createdAtDevice = isoUtc(p.createdAtDevice), photoSha256 = p.photoSha256,
            photoPath = p.photoPath,
        )
    )

    fun <T> parse(json: String, cls: Class<T>): T = gson.fromJson(json, cls)
}
