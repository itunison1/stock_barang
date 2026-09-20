package com.unison.stockopname

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.text.InputType
import android.view.View
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.ImageButton
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
    private var isPasswordVisible = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        val inputUsername = findViewById<EditText>(R.id.inputUsername)
        val inputPassword = findViewById<EditText>(R.id.inputPassword)
        val btnTogglePassword = findViewById<ImageButton>(R.id.btnTogglePassword)
        val cbRememberMe = findViewById<CheckBox>(R.id.cbRememberMe)
        val textError = findViewById<TextView>(R.id.textError)
        val progress = findViewById<ProgressBar>(R.id.progress)
        val btnLogin = findViewById<Button>(R.id.btnLogin)
        findViewById<TextView>(R.id.textVersion).text = "v" + BuildConfig.VERSION_NAME

        val app = application as StockOpnameApp
        val settings = app.container.settings

        // Load remember me preference
        if (settings.isRememberMe) {
            cbRememberMe.isChecked = true
            settings.rememberUsername?.let { savedUser ->
                inputUsername.setText(savedUser)
                inputPassword.requestFocus()
            }
        }

        // Toggle eye icon password
        btnTogglePassword.setOnClickListener {
            isPasswordVisible = !isPasswordVisible
            if (isPasswordVisible) {
                inputPassword.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
                btnTogglePassword.setImageResource(R.drawable.ic_visibility_off)
                btnTogglePassword.contentDescription = "Sembunyikan password"
            } else {
                inputPassword.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
                btnTogglePassword.setImageResource(R.drawable.ic_visibility)
                btnTogglePassword.contentDescription = "Tampilkan password"
            }
            inputPassword.setSelection(inputPassword.text.length)
        }

        btnLogin.setOnClickListener {
            val username = inputUsername.text.toString().trim()
            val password = inputPassword.text.toString()
            textError.visibility = View.GONE
            progress.visibility = View.VISIBLE
            btnLogin.isEnabled = false

            scope.launch {
                when (val result = app.container.auth.login(username, password)) {
                    is ApiResult.Ok -> {
                        // Simpan atau bersihkan username sesuai pilihan Ingat Saya
                        if (cbRememberMe.isChecked) {
                            settings.isRememberMe = true
                            settings.rememberUsername = username
                        } else {
                            settings.isRememberMe = false
                            settings.rememberUsername = null
                        }
                        // Buka Dashboard, bukan langsung dump daftar gudang
                        startActivity(Intent(this@LoginActivity, DashboardActivity::class.java))
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
