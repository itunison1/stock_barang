package com.unison.stockopname

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.widget.TextView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class SplashActivity : Activity() {
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_splash)

        findViewById<TextView>(R.id.textSplashVersion).text = "v${BuildConfig.VERSION_NAME} • Staging 192.168.1.140"

        val app = application as StockOpnameApp
        scope.launch {
            // Beri jeda visual 1.2 detik agar identitas perusahaan PT Unison terlihat jelas
            delay(1200)
            val hasToken = app.container.auth.token() != null
            val target = if (hasToken) DashboardActivity::class.java else LoginActivity::class.java
            startActivity(Intent(this@SplashActivity, target))
            finish()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        scope.cancel()
    }
}
