package com.unison.stockopname.data.prefs

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class SharedPrefsKeyValueStore(private val prefs: SharedPreferences) : KeyValueStore {
    override fun getString(key: String): String? = prefs.getString(key, null)
    override fun putString(key: String, value: String?) {
        prefs.edit().apply { if (value == null) remove(key) else putString(key, value) }.apply()
    }
}

object KeyValueStores {
    fun plain(context: Context): KeyValueStore =
        SharedPrefsKeyValueStore(context.getSharedPreferences("stockopname_prefs", Context.MODE_PRIVATE))

    /** Token login disimpan terenkripsi (Android Keystore). Tidak bisa dites di JVM. */
    fun secure(context: Context): KeyValueStore {
        val masterKey = MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
        val prefs = EncryptedSharedPreferences.create(
            context, "stockopname_secure", masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
        return SharedPrefsKeyValueStore(prefs)
    }
}
