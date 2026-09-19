package com.unison.stockopname

import android.os.Bundle
import android.app.Activity
import android.widget.TextView

class SessionActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_session)
        val code = intent.getStringExtra("warehouse_code").orEmpty()
        val name = intent.getStringExtra("warehouse_name").orEmpty()
        findViewById<TextView>(R.id.textInfo).text = "$code — $name"
    }
}
