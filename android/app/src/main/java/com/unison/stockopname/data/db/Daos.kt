package com.unison.stockopname.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface ItemDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun upsertAll(items: List<ItemEntity>)
    @Query("SELECT * FROM item WHERE itemCode = :code LIMIT 1") suspend fun findByCode(code: String): ItemEntity?
    @Query("SELECT COUNT(*) FROM item") suspend fun count(): Int
    @Query("DELETE FROM item") suspend fun clear()
}

@Dao
abstract class WarehouseDao {
    @Query("SELECT * FROM warehouse ORDER BY sortOrder") abstract suspend fun all(): List<WarehouseEntity>
    @Query("SELECT * FROM warehouse WHERE UPPER(code) = UPPER(:code) LIMIT 1")
    abstract suspend fun findByCode(code: String): WarehouseEntity?
    @Insert abstract suspend fun insertAll(list: List<WarehouseEntity>)
    @Query("DELETE FROM warehouse") abstract suspend fun deleteAll()

    @Transaction
    open suspend fun replaceAll(list: List<WarehouseEntity>) {
        deleteAll()
        insertAll(list)
    }
}

@Dao
interface PrinterDao {
    @Query("SELECT * FROM printer ORDER BY id") suspend fun all(): List<PrinterEntity>
    @Query("SELECT * FROM printer WHERE id = :id") suspend fun findById(id: Long): PrinterEntity?
    @Insert(onConflict = OnConflictStrategy.IGNORE) suspend fun upsertAll(list: List<PrinterEntity>)
    @Update suspend fun update(printer: PrinterEntity)
}

@Dao
interface SessionDao {
    @Insert suspend fun insert(session: SessionEntity)
    @Query(
        "SELECT * FROM session WHERE operator = :operator AND warehouseCode = :warehouse AND finishedAt IS NULL " +
            "ORDER BY startedAt DESC LIMIT 1"
    )
    suspend fun findOpen(operator: String, warehouse: String): SessionEntity?
    @Query(
        "SELECT * FROM session WHERE operator = :operator AND finishedAt IS NULL " +
            "ORDER BY startedAt DESC LIMIT 1"
    )
    suspend fun findActive(operator: String): SessionEntity?
    @Query("UPDATE session SET finishedAt = :at WHERE uuid = :uuid") suspend fun finish(uuid: String, at: Long)
    @Query(
        "UPDATE session SET finishedAt = :at WHERE operator = :operator AND finishedAt IS NULL " +
            "AND warehouseCode <> :keepWarehouse"
    )
    suspend fun finishOthers(operator: String, keepWarehouse: String, at: Long)
}

@Dao
interface CountDao {
    @Insert suspend fun insert(count: CountEntity)
    @Query(
        "SELECT * FROM count_record WHERE sessionUuid = :sessionUuid AND itemCode = :itemCode " +
            "ORDER BY createdAtDevice DESC LIMIT 1"
    )
    suspend fun latestForItem(sessionUuid: String, itemCode: String): CountEntity?
    @Query("SELECT * FROM count_record ORDER BY createdAtDevice DESC LIMIT 50")
    suspend fun recentCounts(): List<CountEntity>
}

@Dao
interface ProposalDao {
    @Insert suspend fun insert(proposal: ProposalEntity)
    @Query("SELECT * FROM proposal WHERE barcode = :barcode ORDER BY createdAtDevice DESC LIMIT 1")
    suspend fun findByBarcode(barcode: String): ProposalEntity?
    @Query("UPDATE proposal SET status = :status, rejectionReason = :reason WHERE uuid = :uuid")
    suspend fun updateStatus(uuid: String, status: String, reason: String?)
    @Query("SELECT * FROM proposal ORDER BY createdAtDevice DESC LIMIT 50")
    suspend fun recentProposals(): List<ProposalEntity>
}

@Dao
interface AuditDao {
    @Insert suspend fun insert(audit: AuditEntity)
}

@Dao
interface OutboxDao {
    @Insert(onConflict = OnConflictStrategy.IGNORE) suspend fun insert(entry: OutboxEntity): Long
    @Query("SELECT * FROM outbox WHERE status = 'PENDING' ORDER BY id ASC LIMIT :limit")
    suspend fun nextPending(limit: Int): List<OutboxEntity>
    @Update suspend fun update(entry: OutboxEntity)
    @Query("SELECT COUNT(*) FROM outbox WHERE status = 'PENDING'") fun observePending(): Flow<Int>
    @Query("SELECT * FROM outbox WHERE status = 'FAILED' ORDER BY id") suspend fun failed(): List<OutboxEntity>
    @Query("UPDATE outbox SET status = 'PENDING', attempts = 0 WHERE status = 'FAILED'") suspend fun resetFailed()
    @Query("SELECT * FROM outbox ORDER BY id") suspend fun all(): List<OutboxEntity>
}
