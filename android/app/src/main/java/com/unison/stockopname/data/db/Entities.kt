package com.unison.stockopname.data.db

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

object OutboxType { const val COUNT = "COUNT"; const val PROPOSAL = "PROPOSAL"; const val AUDIT = "AUDIT" }
object OutboxStatus { const val PENDING = "PENDING"; const val SENT = "SENT"; const val FAILED = "FAILED" }
object ProposalStatus { const val PENDING = "pending"; const val ACTIVE = "active"; const val REJECTED = "rejected" }

@Entity(tableName = "item", indices = [Index("itemCode")])
data class ItemEntity(
    @PrimaryKey val id: Long,
    val itemCode: String,
    val itemName: String,
    val stock: Double,
    val unit: String?,
    val pack: String?,
    val isiPerPack: Double?,
    val warehouseCode: String?,
)

@Entity(tableName = "warehouse")
data class WarehouseEntity(@PrimaryKey val code: String, val name: String, val sortOrder: Int)

@Entity(tableName = "printer")
data class PrinterEntity(
    @PrimaryKey val id: Long,
    val name: String,
    val host: String,
    val port: Int,
    val paper: String, // nama enum PaperWidth
)

@Entity(tableName = "session")
data class SessionEntity(
    @PrimaryKey val uuid: String,
    val operator: String,
    val warehouseCode: String,
    val startedAt: Long,
    val finishedAt: Long?,
)

@Entity(tableName = "count_record", indices = [Index("sessionUuid", "itemCode")])
data class CountEntity(
    @PrimaryKey val uuid: String,
    val sessionUuid: String,
    val warehouseCode: String,
    val itemCode: String,
    val itemName: String,
    val qtySystem: Double,
    val qtyPhysical: Int,
    val variance: Double,
    val rackCode: String?,
    val note: String,
    val supersedesUuid: String?,
    val createdAtDevice: Long,
    val operator: String,
)

@Entity(tableName = "proposal", indices = [Index("barcode")])
data class ProposalEntity(
    @PrimaryKey val uuid: String,
    val sessionUuid: String,
    val barcode: String,
    val name: String,
    val category: String,
    val proposedQty: Int,
    val warehouseCode: String,
    val notes: String,
    val photoPath: String,
    val photoSha256: String,
    val status: String,
    val rejectionReason: String?,
    val createdAtDevice: Long,
    val operator: String,
)

@Entity(tableName = "audit_log")
data class AuditEntity(
    @PrimaryKey val uuid: String,
    val action: String,
    val entityType: String,
    val entityUuid: String?,
    val description: String,
    val detailJson: String?,
    val createdAtDevice: Long,
    val operator: String,
)

@Entity(tableName = "outbox", indices = [Index(value = ["clientUuid"], unique = true)])
data class OutboxEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val type: String,
    val clientUuid: String,
    val payloadJson: String,
    val status: String = OutboxStatus.PENDING,
    val attempts: Int = 0,
    val lastError: String? = null,
    val createdAt: Long,
)
