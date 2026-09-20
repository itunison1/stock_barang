package com.unison.stockopname

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.BaseAdapter
import android.widget.EditText
import android.widget.GridView
import android.widget.ImageButton
import android.widget.ProgressBar
import android.widget.TextView
import com.unison.stockopname.data.db.WarehouseEntity
import com.unison.stockopname.data.repo.LockResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

class WarehouseActivity : Activity() {
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private var allWarehouses: List<WarehouseEntity> = emptyList()
    private var filteredWarehouses: List<WarehouseEntity> = emptyList()
    private lateinit var adapter: WarehouseGridAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_warehouse)

        val btnBack = findViewById<ImageButton>(R.id.btnBack)
        val inputSearch = findViewById<EditText>(R.id.inputSearch)
        val btnClearSearch = findViewById<ImageButton>(R.id.btnClearSearch)
        val textCountInfo = findViewById<TextView>(R.id.textCountInfo)
        val progress = findViewById<ProgressBar>(R.id.progress)
        val textError = findViewById<TextView>(R.id.textError)
        val textEmptySearch = findViewById<TextView>(R.id.textEmptySearch)
        val gridView = findViewById<GridView>(R.id.gridWarehouses)
        val app = application as StockOpnameApp

        adapter = WarehouseGridAdapter(emptyList())
        gridView.adapter = adapter

        // Back Navigation
        btnBack.setOnClickListener {
            finish()
        }

        // Search Filter
        inputSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                val query = s?.toString()?.trim()?.lowercase() ?: ""
                btnClearSearch.visibility = if (query.isNotEmpty()) View.VISIBLE else View.GONE
                applyFilter(query, textCountInfo, textEmptySearch)
            }
            override fun afterTextChanged(s: Editable?) {}
        })

        btnClearSearch.setOnClickListener {
            inputSearch.setText("")
        }

        scope.launch {
            val local = app.container.db.warehouses().all()
            if (local.isNotEmpty()) {
                progress.visibility = View.GONE
                allWarehouses = local
                applyFilter(inputSearch.text.toString().trim().lowercase(), textCountInfo, textEmptySearch)
            }
            when (val r = app.container.newMasterSync().let { it.syncWarehouses() }) {
                is com.unison.stockopname.data.repo.MasterSyncResult.Ok -> {
                    val fresh = app.container.db.warehouses().all()
                    progress.visibility = View.GONE
                    allWarehouses = fresh
                    applyFilter(inputSearch.text.toString().trim().lowercase(), textCountInfo, textEmptySearch)
                }
                is com.unison.stockopname.data.repo.MasterSyncResult.AuthExpired -> {
                    startActivity(Intent(this@WarehouseActivity, LoginActivity::class.java))
                    finish()
                }
                is com.unison.stockopname.data.repo.MasterSyncResult.Failed -> {
                    if (local.isEmpty()) {
                        progress.visibility = View.GONE
                        textError.text = r.message
                        textError.visibility = View.VISIBLE
                    }
                }
            }
        }

        gridView.setOnItemClickListener { _, _, position, _ ->
            val warehouse = adapter.getItem(position)
            val operator = app.container.auth.currentUser()?.username ?: return@setOnItemClickListener
            scope.launch {
                when (val result = app.container.sessions.lock(operator, warehouse.code)) {
                    is LockResult.Locked -> {
                        val i = Intent(this@WarehouseActivity, SessionActivity::class.java)
                        i.putExtra("warehouse_name", result.warehouse.name)
                        i.putExtra("warehouse_code", result.warehouse.code)
                        i.putExtra("initial_tab", 0)
                        startActivity(i)
                        finish()
                    }
                    is LockResult.UnknownWarehouse -> { /* terdaftar dari server */ }
                }
            }
        }
    }

    private fun applyFilter(query: String, textCountInfo: TextView, textEmptySearch: TextView) {
        filteredWarehouses = if (query.isEmpty()) {
            allWarehouses
        } else {
            allWarehouses.filter {
                it.code.lowercase().contains(query) || it.name.lowercase().contains(query)
            }
        }
        adapter.update(filteredWarehouses)
        textCountInfo.text = "Menampilkan ${filteredWarehouses.size} dari ${allWarehouses.size} gudang"
        textEmptySearch.visibility = if (filteredWarehouses.isEmpty() && allWarehouses.isNotEmpty()) View.VISIBLE else View.GONE
    }

    override fun onDestroy() {
        super.onDestroy()
        scope.cancel()
    }

    private class WarehouseGridAdapter(private var items: List<WarehouseEntity>) : BaseAdapter() {
        fun update(newItems: List<WarehouseEntity>) {
            items = newItems
            notifyDataSetChanged()
        }

        override fun getCount() = items.size
        override fun getItem(position: Int): WarehouseEntity = items[position]
        override fun getItemId(position: Int) = items[position].code.hashCode().toLong()
        override fun getView(position: Int, convertView: View?, parent: ViewGroup): View {
            val view = convertView ?: LayoutInflater.from(parent.context).inflate(R.layout.item_warehouse, parent, false)
            val item = items[position]
            view.findViewById<TextView>(R.id.textCode).text = item.code
            view.findViewById<TextView>(R.id.textName).text = item.name
            return view
        }
    }
}
