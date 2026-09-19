package com.unison.stockopname

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BuildConfigTest {
    @Test
    fun defaultBaseUrlPointsToStockApiWithTrailingSlash() {
        assertEquals("http://192.168.1.140/stock/api/", BuildConfig.DEFAULT_BASE_URL)
        assertTrue(BuildConfig.DEFAULT_BASE_URL.endsWith("/"))
    }

    @Test
    fun versionCodeIsPositive() {
        assertTrue(BuildConfig.VERSION_CODE >= 1)
    }
}
