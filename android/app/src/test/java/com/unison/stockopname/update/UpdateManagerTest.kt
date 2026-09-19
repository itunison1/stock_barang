package com.unison.stockopname.update

import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class UpdateManagerTest {
    private lateinit var server: MockWebServer
    private val manager = UpdateManager()
    private lateinit var apiBase: String

    @Before fun setUp() {
        server = MockWebServer().also { it.start() }
        apiBase = server.url("/stock/api/").toString()
    }

    @After fun tearDown() { server.shutdown() }

    private fun versionJson(code: Int = 2, apk: String = "StockOpname-1.1.apk", mandatory: Boolean = false) =
        MockResponse().setHeader("Content-Type", "application/json").setBody(
            """{"versionCode":$code,"versionName":"1.1","apkFileName":"$apk","notes":"Perbaikan","mandatory":$mandatory}"""
        )

    @Test fun updatesFolderSitsBesideApiFolder() {
        assertEquals("http://h/stock/updates/", manager.updatesBaseUrl("http://h/stock/api/"))
        assertEquals("http://h/stock/updates/", manager.updatesBaseUrl("http://h/stock/api"))
        assertEquals("http://h/stock/updates/", manager.updatesBaseUrl("http://h/stock"))
    }

    @Test fun newerVersionIsOffered() = runBlocking {
        server.enqueue(versionJson(code = 2, mandatory = true))
        val info = manager.checkForUpdate(apiBase, currentVersionCode = 1)!!
        assertEquals("StockOpname-1.1.apk", info.apkFileName)
        assertTrue(info.mandatory)
        assertEquals("/stock/updates/version.json", server.takeRequest().path)
    }

    @Test fun sameOrOlderVersionIsNotOffered() = runBlocking {
        server.enqueue(versionJson(code = 2))
        assertNull(manager.checkForUpdate(apiBase, currentVersionCode = 2))
        server.enqueue(versionJson(code = 1))
        assertNull(manager.checkForUpdate(apiBase, currentVersionCode = 2))
    }

    @Test fun serverErrorMalformedJsonAndBlankApkAreSilentlyIgnored() = runBlocking {
        server.enqueue(MockResponse().setResponseCode(404))
        assertNull(manager.checkForUpdate(apiBase, 1))
        server.enqueue(MockResponse().setBody("<html>bukan json</html>"))
        assertNull(manager.checkForUpdate(apiBase, 1))
        server.enqueue(versionJson(code = 2, apk = ""))
        assertNull(manager.checkForUpdate(apiBase, 1))
    }

    @Test fun unsafeApkFileNamesAreRejected() = runBlocking {
        for (bad in listOf("../evil.apk", "a/b.apk", "a\\\\b.apk", "app.zip", "..apk")) {
            server.enqueue(versionJson(code = 2, apk = bad))
            assertNull("must reject $bad", manager.checkForUpdate(apiBase, 1))
        }
        server.enqueue(versionJson(code = 2, apk = "StockOpname-1.1.apk"))
        assertNotNull(manager.checkForUpdate(apiBase, 1))
    }

    @Test fun unreachableServerReturnsNull() = runBlocking {
        server.shutdown()
        assertNull(manager.checkForUpdate(apiBase, 1))
        assertFalse(server.requestCount > 5)
    }
}
