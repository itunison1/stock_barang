package com.unison.stockopname

import android.app.Activity
import android.os.Bundle
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import com.unison.stockopname.data.api.UserCreateRequest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

class AccountManagementActivity : Activity() {
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private lateinit var list: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val app = application as StockOpnameApp
        if (app.container.auth.currentUser()?.level != 1) { finish(); return }

        setContentView(R.layout.activity_account_management)
        val username = findViewById<EditText>(R.id.inputAccountUsername)
        val password = findViewById<EditText>(R.id.inputAccountPassword)
        val division = findViewById<EditText>(R.id.inputAccountDivision)
        val role = findViewById<Spinner>(R.id.spinnerAccountRole).apply {
            adapter = ArrayAdapter(this@AccountManagementActivity, android.R.layout.simple_spinner_dropdown_item, listOf("Admin", "Supervisor", "Operator"))
        }
        val add = findViewById<Button>(R.id.btnAddAccount)
        list = findViewById(R.id.textAccountList)

        add.setOnClickListener {
            val levels = intArrayOf(1, 2, 3)
            scope.launch {
                runCatching { app.container.api().createUser(UserCreateRequest(username.text.toString(), password.text.toString(), division.text.toString(), levels[role.selectedItemPosition])) }
                    .onSuccess { response ->
                        if (response.isSuccessful && response.body()?.success == true) {
                            username.text.clear(); password.text.clear(); division.text.clear(); loadUsers()
                        } else Toast.makeText(this@AccountManagementActivity, response.body()?.message ?: "Gagal menambah akun", Toast.LENGTH_LONG).show()
                    }.onFailure { Toast.makeText(this@AccountManagementActivity, it.message ?: "Koneksi gagal", Toast.LENGTH_LONG).show() }
            }
        }
        loadUsers()
    }

    private fun loadUsers() {
        val app = application as StockOpnameApp
        scope.launch {
            runCatching { app.container.api().users() }.onSuccess { response ->
                val roles = mapOf(1 to "Admin", 2 to "Supervisor", 3 to "Operator")
                list.text = response.body()?.data?.joinToString("\n") { "${it.username} • ${roles[it.userLevel] ?: "Level ${it.userLevel}"} • ${it.userDivisi.orEmpty()} • ${if (it.userActive == 1) "Aktif" else "Nonaktif"}" }
                    ?: "Daftar akun gagal dimuat"
            }
        }
    }

    override fun onDestroy() { scope.cancel(); super.onDestroy() }
}
