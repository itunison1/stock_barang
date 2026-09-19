package com.unison.stockopname.data.prefs

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class SharedPrefsKeyValueStoreTest {
    private fun store() = SharedPrefsKeyValueStore(
        ApplicationProvider.getApplicationContext<Context>().getSharedPreferences("t", Context.MODE_PRIVATE)
    )

    @Test fun putGetAndRemove() {
        val s = store()
        assertNull(s.getString("k"))
        s.putString("k", "v")
        assertEquals("v", s.getString("k"))
        s.putString("k", null)
        assertNull(s.getString("k"))
    }
}
