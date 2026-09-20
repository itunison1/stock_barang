package com.unison.stockopname.data.model

data class Machine(
    val mcode: String,
    val mname: String,
    val status: String,
    val speed: Int = 0,
    val counter: Int = 0,
    val lastActivity: String? = null
)