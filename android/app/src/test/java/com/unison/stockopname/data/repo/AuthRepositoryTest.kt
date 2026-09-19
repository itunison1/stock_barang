package com.unison.stockopname.data.repo

import com.unison.stockopname.InMemoryKeyValueStore
import com.unison.stockopname.data.api.ApiFactory
import com.unison.stockopname.data.api.ApiResult
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

class AuthRepositoryTest {
    private lateinit var server: MockWebServer
    private lateinit var store: InMemoryKeyValueStore
    private lateinit var auth: AuthRepository

    @Before fun setUp() {
        server = MockWebServer().also { it.start() }
        store = InMemoryKeyValueStore()
        auth = AuthRepository(
            { ApiFactory.create(server.url("/stock/api/").toString()) { store.getString("token") } }, store, "ZEBRA TC26"
        )
    }

    @After fun tearDown() { server.shutdown() }

    private fun loginOk() = MockResponse().setHeader("Content-Type", "application/json").setBody(
        """{"success":true,"data":{"token":"TKN","iduser":7,"username":"kirana","user_divisi":"Gudang","user_level":2}}"""
    )

    @Test fun successfulLoginStoresTokenAndUser() = runBlocking {
        server.enqueue(loginOk())
        val r = auth.login("  Kirana ", "rahasia") as ApiResult.Ok

        assertEquals(SessionUser("kirana", "Gudang", 2), r.data)
        assertEquals("TKN", auth.token())
        assertEquals(SessionUser("kirana", "Gudang", 2), auth.currentUser())
        val body = server.takeRequest().body.readUtf8()
        assertTrue(body.contains("\"username\":\"Kirana\"") || body.contains("\"username\":\"kirana\""))
        assertTrue(body.contains("ZEBRA TC26"))
    }

    @Test fun wrongPasswordFailsWithoutStoringToken() = runBlocking {
        server.enqueue(MockResponse().setResponseCode(401).setBody("""{"success":false,"message":"Username atau password salah."}"""))
        val r = auth.login("kirana", "salah") as ApiResult.Failure
        assertEquals("Username atau password salah.", r.message)
        assertFalse(r.retryable)
        assertNull(auth.token())
    }

    @Test fun blankCredentialsNeverHitNetwork() = runBlocking {
        val r = auth.login(" ", "") as ApiResult.Failure
        assertEquals("Username dan password wajib diisi.", r.message)
        assertEquals(0, server.requestCount)
    }

    @Test fun networkDownIsRetryableFailure() = runBlocking {
        server.shutdown()
        val r = auth.login("kirana", "x") as ApiResult.Failure
        assertTrue(r.retryable)
    }

    @Test fun markExpiredClearsTokenButKeepsUser() = runBlocking {
        server.enqueue(loginOk())
        auth.login("kirana", "x")
        auth.markExpired()
        assertNull(auth.token())
        assertNotNull(auth.currentUser())
    }

    @Test fun logoutClearsEverything() = runBlocking {
        server.enqueue(loginOk())
        auth.login("kirana", "x")
        auth.logout()
        assertNull(auth.token())
        assertNull(auth.currentUser())
    }
}
