package com.unison.stockopname

import android.content.Intent
import android.os.Bundle
import android.app.Activity
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.TextView
import com.unison.stockopname.data.api.ApiResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

class LoginActivity : Activity() {
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        val inputUsername = findViewById<EditText>(R.id.inputUsername)
        val inputPassword = findViewById<EditText>(R.id.inputPassword)
        val textError = findViewById<TextView>(R.id.textError)
        val progress = findViewById<ProgressBar>(R.id.progress)
        val btnLogin = findViewById<Button>(R.id.btnLogin)
        findViewById<TextView>(R.id.textVersion).text = "v" + BuildConfig.VERSION_NAME

        val app = application as StockOpnameApp

        btnLogin.setOnClickListener {
            val username = inputUsername.text.toString()
            val password = inputPassword.text.toString()
            textError.visibility = View.GONE
            progress.visibility = View.VISIBLE
            btnLogin.isEnabled = false

            scope.launch {
                when (val result = app.container.auth.login(username, password)) {
                    is ApiResult.Ok -> {
                        startActivity(Intent(this@LoginActivity, WarehouseActivity::class.java))
                        finish()
                    }
                    is ApiResult.AuthExpired -> {
                        textError.text = "Username atau password salah."
                        textError.visibility = View.VISIBLE
                    }
                    is ApiResult.Failure -> {
                        textError.text = result.message
                        textError.visibility = View.VISIBLE
                    }
                }
                progress.visibility = View.GONE
                btnLogin.isEnabled = true
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        scope.cancel()
    }
}
