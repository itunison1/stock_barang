package com.unison.stockopname.data.prefs

/** Penyimpanan kunci-nilai sederhana. `putString(key, null)` menghapus kunci. */
interface KeyValueStore {
    fun getString(key: String): String?
    fun putString(key: String, value: String?)
}
