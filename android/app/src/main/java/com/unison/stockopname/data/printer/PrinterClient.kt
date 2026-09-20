package com.unison.stockopname.data.printer

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException
import java.net.InetSocketAddress
import java.net.Socket

class PrinterException(message: String, cause: Throwable? = null) : Exception(message, cause)

/** Kirim byte ESC/POS langsung ke printer LAN lewat raw TCP (Bab 3.2, tanpa hop server). */
class PrinterClient(private val connectTimeoutMs: Int = 3000) {
    /** Cek printer bisa dijangkau tanpa mengirim data cetak (Row status di UI). */
    suspend fun checkConnection(host: String, port: Int): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            Socket().use { socket ->
                socket.connect(InetSocketAddress(host, port), connectTimeoutMs)
            }
            Result.success(Unit)
        } catch (e: IOException) {
            Result.failure(PrinterException("Printer $host:$port tidak terjangkau.", e))
        } catch (e: IllegalArgumentException) {
            Result.failure(PrinterException("Alamat printer $host:$port tidak valid.", e))
        }
    }

    suspend fun send(host: String, port: Int, bytes: ByteArray): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            Socket().use { socket ->
                socket.connect(InetSocketAddress(host, port), connectTimeoutMs)
                socket.getOutputStream().apply {
                    write(bytes)
                    flush()
                }
            }
            Result.success(Unit)
        } catch (e: IOException) {
            Result.failure(PrinterException("Printer $host:$port tidak terjangkau. Periksa WiFi dan IP printer.", e))
        } catch (e: IllegalArgumentException) {
            Result.failure(PrinterException("Alamat printer $host:$port tidak valid.", e))
        }
    }
}
