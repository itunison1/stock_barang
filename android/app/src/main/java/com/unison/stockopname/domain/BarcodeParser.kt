package com.unison.stockopname.domain

data class ParsedBarcode(
    val itemCode: String,
    val lotNo: String?,
    val qty: Int?,
    val prodDate: String?,
)

object BarcodeParser {
    fun parse(raw: String): ParsedBarcode? {
        val code = raw.trim()
        if (code.isEmpty()) return null
        if (!code.contains('|')) return ParsedBarcode(code, null, null, null)

        val parts = code.split('|').map { it.trim() }
        val item = parts[0]
        if (item.isEmpty()) return null
        return ParsedBarcode(
            itemCode = item,
            lotNo = parts.getOrNull(1)?.takeIf { it.isNotEmpty() },
            qty = parts.getOrNull(2)?.toIntOrNull()?.takeIf { it >= 0 },
            prodDate = parts.getOrNull(3)?.takeIf { it.isNotEmpty() },
        )
    }
}
