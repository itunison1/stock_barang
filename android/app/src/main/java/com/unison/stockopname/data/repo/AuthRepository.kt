package com.unison.stockopname.data.repo

import com.unison.stockopname.data.api.ApiResult
import com.unison.stockopname.data.api.LoginRequest
import com.unison.stockopname.data.api.WmsApi
import com.unison.stockopname.data.api.apiCall
import com.unison.stockopname.data.prefs.KeyValueStore

data class SessionUser(val username: String, val division: String?, val level: Int)

class AuthRepository(
    private val apiProvider: () -> WmsApi,
    private val secure: KeyValueStore,
    private val deviceName: String,
) {
    suspend fun login(username: String, password: String): ApiResult<SessionUser> {
        val u = username.trim()
        if (u.isEmpty() || password.isEmpty()) {
            return ApiResult.Failure("Username dan password wajib diisi.", retryable = false)
        }
        return when (val r = apiCall(unauthorizedIsExpiry = false) { apiProvider().login(LoginRequest(u, password, deviceName)) }) {
            is ApiResult.Ok -> {
                val user = SessionUser(r.data.username, r.data.userDivisi, r.data.userLevel)
                secure.putString(K_TOKEN, r.data.token)
                secure.putString(K_USER, user.username)
                secure.putString(K_DIVISION, user.division)
                secure.putString(K_LEVEL, user.level.toString())
                ApiResult.Ok(user)
            }
            is ApiResult.AuthExpired -> ApiResult.AuthExpired
            is ApiResult.Failure -> r
        }
    }

    fun token(): String? = secure.getString(K_TOKEN)

    fun currentUser(): SessionUser? {
        val username = secure.getString(K_USER) ?: return null
        return SessionUser(username, secure.getString(K_DIVISION), secure.getString(K_LEVEL)?.toIntOrNull() ?: 0)
    }

    /** Token ditolak server (401): hapus token, biarkan data lokal dan identitas terakhir. */
    fun markExpired() = secure.putString(K_TOKEN, null)

    fun logout() {
        listOf(K_TOKEN, K_USER, K_DIVISION, K_LEVEL).forEach { secure.putString(it, null) }
    }

    private companion object {
        const val K_TOKEN = "token"
        const val K_USER = "user"
        const val K_DIVISION = "division"
        const val K_LEVEL = "level"
    }
}
