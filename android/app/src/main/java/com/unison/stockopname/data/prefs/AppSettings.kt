package com.unison.stockopname.data.prefs

class AppSettings(private val store: KeyValueStore, private val defaultBaseUrl: String) {
    var baseUrl: String
        get() = store.getString(KEY_BASE_URL)?.trim()?.takeIf { it.isNotEmpty() } ?: defaultBaseUrl
        set(value) {
            val v = value.trim()
            require(v.startsWith("http://") || v.startsWith("https://")) { "Alamat server harus diawali http:// atau https://" }
            store.putString(KEY_BASE_URL, v.trimEnd('/') + "/")
        }

    private companion object { const val KEY_BASE_URL = "base_url" }
}
