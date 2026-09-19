package com.unison.stockopname.data.printer

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.net.ServerSocket
import kotlin.concurrent.thread

class PrinterClientTest {
    @Test fun sendsExactBytesToSocket() = runBlocking {
        ServerSocket(0).use { server ->
            var received = ByteArray(0)
            val t = thread { server.accept().use { received = it.getInputStream().readBytes() } }

            val payload = byteArrayOf(0x1B, 0x40, 0x41, 0x0A)
            val result = PrinterClient().send("127.0.0.1", server.localPort, payload)
            t.join(3000)

            assertTrue(result.isSuccess)
            assertArrayEquals(payload, received)
        }
    }

    @Test fun unreachablePrinterFailsWithIndonesianMessage() = runBlocking {
        val closedPort = ServerSocket(0).use { it.localPort }
        val result = PrinterClient(connectTimeoutMs = 500).send("127.0.0.1", closedPort, byteArrayOf(1))

        assertTrue(result.isFailure)
        val ex = result.exceptionOrNull()
        assertTrue(ex is PrinterException)
        assertTrue(ex!!.message!!.contains("tidak terjangkau"))
    }

    @Test fun invalidPortFailsInsteadOfThrowing() = runBlocking {
        val result = PrinterClient().send("127.0.0.1", 70000, byteArrayOf(1))
        assertTrue(result.isFailure)
    }
}
