package com.unison.stockopname.data.prefs

import com.unison.stockopname.InMemoryKeyValueStore
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class AppSettingsTest {
    private val default = "http://192.168.1.140/stock/api/"

    @Test fun usesDefaultUntilChanged() {
        assertEquals(default, AppSettings(InMemoryKeyValueStore(), default).baseUrl)
    }

    @Test fun setterAddsTrailingSlashAndTrims() {
        val s = AppSettings(InMemoryKeyValueStore(), default)
        s.baseUrl = "  http://192.168.1.159/stock/api  "
        assertEquals("http://192.168.1.159/stock/api/", s.baseUrl)
    }

    @Test fun valueSurvivesNewInstanceOnSameStore() {
        val store = InMemoryKeyValueStore()
        AppSettings(store, default).baseUrl = "http://192.168.1.159/x/"
        assertEquals("http://192.168.1.159/x/", AppSettings(store, default).baseUrl)
    }

    @Test fun rejectsNonHttpUrl() {
        val s = AppSettings(InMemoryKeyValueStore(), default)
        assertThrows(IllegalArgumentException::class.java) { s.baseUrl = "ftp://192.168.1.140/" }
        assertThrows(IllegalArgumentException::class.java) { s.baseUrl = "   " }
    }

    @Test fun blankStoredValueFallsBackToDefault() {
        val store = InMemoryKeyValueStore().apply { putString("base_url", "  ") }
        assertEquals(default, AppSettings(store, default).baseUrl)
    }
}
