package com.unison.stockopname

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.unison.stockopname.data.db.AppDatabase

fun newTestDb(): AppDatabase =
    Room.inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext(), AppDatabase::class.java)
        .allowMainThreadQueries()
        .build()
