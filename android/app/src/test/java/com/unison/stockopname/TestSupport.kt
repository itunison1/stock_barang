package com.unison.stockopname

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.unison.stockopname.data.db.AppDatabase
import com.unison.stockopname.data.db.ItemEntity
import com.unison.stockopname.data.db.SessionEntity
import com.unison.stockopname.sync.SyncTrigger

fun newTestDb(): AppDatabase =
    Room.inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext(), AppDatabase::class.java)
        .allowMainThreadQueries()
        .build()

class InMemoryKeyValueStore : com.unison.stockopname.data.prefs.KeyValueStore {
    private val map = mutableMapOf<String, String>()
    override fun getString(key: String): String? = map[key]
    override fun putString(key: String, value: String?) { if (value == null) map.remove(key) else map[key] = value }
}

class FakeSyncTrigger : SyncTrigger {
    var calls = 0
    override fun request() { calls++ }
}

/** Generator UUID deterministik: uuid-1, uuid-2, ... */
fun seqUuid(prefix: String = "uuid"): () -> String {
    var n = 0
    return { "$prefix-${++n}" }
}

fun testSession(operator: String = "kirana", warehouse: String = "U2 GUDANG2") =
    SessionEntity("sess-1", operator, warehouse, 1L, null)

fun testItem(code: String = "AB6C50", stock: Double = 100.0, warehouse: String? = "U2 GUDANG2") =
    ItemEntity(1, code, "BAUT $code", stock, "PCS", "KARUNG", 1000.0, warehouse)
