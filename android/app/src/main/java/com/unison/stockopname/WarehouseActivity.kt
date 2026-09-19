package com.unison.stockopname

import android.content.Intent
import android.os.Bundle
import android.app.Activity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.BaseAdapter
import android.widget.ListView
import android.widget.ProgressBar
import android.widget.TextView
import com.unison.stockopname.data.api.ApiResult
import com.unison.stockopname.data.db.WarehouseEntity
import com.unison.stockopname.data.repo.LockResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

class WarehouseActivity : Activity() {
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_warehouse)

        val progress = findViewById<ProgressBar>(R.id.progress)
        val textError = findViewById<TextView>(R.id.textError)
        val listView = findViewById<ListView>(R.id.listWarehouses)
        val app = application as StockOpnameApp

        scope.launch {
            val local = app.container.db.warehouses().all()
            if (local.isNotEmpty()) {
                progress.visibility = View.GONE
                listView.adapter = WarehouseAdapter(local)
            }
            when (val r = app.container.newMasterSync().let { it.syncWarehouses() }) {
                is com.unison.stockopname.data.repo.MasterSyncResult.Ok -> {
                    val fresh = app.container.db.warehouses().all()
                    progress.visibility = View.GONE
                    listView.adapter = WarehouseAdapter(fresh)
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

        listView.setOnItemClickListener { _, _, position, _ ->
            val warehouse = (listView.adapter as WarehouseAdapter).getItem(position)
            val operator = app.container.auth.currentUser()?.username ?: return@setOnItemClickListener
            scope.launch {
                when (val result = app.container.sessions.lock(operator, warehouse.code)) {
                    is LockResult.Locked -> {
                        val i = Intent(this@WarehouseActivity, SessionActivity::class.java)
                        i.putExtra("warehouse_name", result.warehouse.name)
                        i.putExtra("warehouse_code", result.warehouse.code)
                        startActivity(i)
                    }
                    is LockResult.UnknownWarehouse -> { /* tidak terjadi: dipilih dari list server */ }
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        scope.cancel()
    }

    private class WarehouseAdapter(private val items: List<WarehouseEntity>) : BaseAdapter() {
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
