package com.unison.stockopname.util

fun Int.toThousands(): String {
    return "%,d".format(this)
}

fun Long.toThousands(): String {
    return "%,d".format(this)
}