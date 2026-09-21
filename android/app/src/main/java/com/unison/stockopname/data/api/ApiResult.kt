package com.unison.stockopname.data.api

import com.google.gson.Gson
import com.google.gson.JsonParseException
import retrofit2.Response
import java.io.IOException

sealed class ApiResult<out T> {
    data class Ok<T>(val data: T) : ApiResult<T>()
    object AuthExpired : ApiResult<Nothing>()
    data class Failure(val message: String, val retryable: Boolean) : ApiResult<Nothing>()
}

fun <T> ApiResult<T>.asUnit(): ApiResult<Unit> = when (this) {
    is ApiResult.Ok -> ApiResult.Ok(Unit)
    is ApiResult.AuthExpired -> ApiResult.AuthExpired
    is ApiResult.Failure -> this
}

private val gson = Gson()

/**
 * Bungkus satu panggilan Retrofit. 401 di endpoint terautentikasi = token kedaluwarsa;
 * di endpoint login (unauthorizedIsExpiry = false) itu hanya password salah.
 */
suspend fun <T> apiCall(
    unauthorizedIsExpiry: Boolean = true,
    block: suspend () -> Response<ApiEnvelope<T>>,
): ApiResult<T> = try {
    val r = try {
        block()
    } catch (e: IOException) {
        // Socket keep-alive basi ke Apache/XAMPP sering gagal di percobaan pertama
        // ("unexpected end of stream") padahal server hidup dan membalas JSON error.
        // Coba SEKALI lagi: bila percobaan kedua dapat respons, pesan error JSON
        // dari server tetap tampil lewat jalur normal — bukan selalu
        // "Tidak ada koneksi ke server."
        try { block() } catch (e2: IOException) { throw e }
    }
    toResult(r, unauthorizedIsExpiry)
} catch (e: IOException) {
    ApiResult.Failure("Tidak ada koneksi ke server.", retryable = true)
} catch (e: JsonParseException) {
    ApiResult.Failure("Respons server tidak valid.", retryable = false)
}

private fun <T> toResult(r: Response<ApiEnvelope<T>>, unauthorizedIsExpiry: Boolean): ApiResult<T> {
    if (r.isSuccessful) {
        val body = r.body()
        val data = body?.data
        if (body != null && body.success && data != null) return ApiResult.Ok(data)
        return ApiResult.Failure(body?.message ?: "Respons server kosong.", retryable = false)
    }
    val message = errorMessage(r)
    return when {
        r.code() == 401 && unauthorizedIsExpiry -> ApiResult.AuthExpired
        r.code() >= 500 -> ApiResult.Failure(message, retryable = true)
        else -> ApiResult.Failure(message, retryable = false)
    }
}

private fun errorMessage(r: Response<*>): String {
    val raw = try { r.errorBody()?.string() } catch (e: IOException) { null }
    val parsed = try { gson.fromJson(raw, ApiEnvelope::class.java)?.message } catch (e: JsonParseException) { null }
    return parsed?.takeIf { it.isNotBlank() } ?: "Server error (HTTP ${r.code()})."
}


