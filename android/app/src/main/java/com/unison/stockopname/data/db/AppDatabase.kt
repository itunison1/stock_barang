package com.unison.stockopname.data.db

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
    entities = [
        ItemEntity::class, WarehouseEntity::class, PrinterEntity::class, SessionEntity::class,
        CountEntity::class, ProposalEntity::class, AuditEntity::class, OutboxEntity::class,
    ],
    version = 1,
    exportSchema = false,
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun items(): ItemDao
    abstract fun warehouses(): WarehouseDao
    abstract fun printers(): PrinterDao
    abstract fun sessions(): SessionDao
    abstract fun counts(): CountDao
    abstract fun proposals(): ProposalDao
    abstract fun audits(): AuditDao
    abstract fun outbox(): OutboxDao
}
