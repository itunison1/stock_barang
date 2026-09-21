package com.unison.stockopname.data.repo

import com.unison.stockopname.data.api.ApiResult
import com.unison.stockopname.data.api.LabelResolveDto
import com.unison.stockopname.data.api.WmsApi
import com.unison.stockopname.data.api.apiCall
import com.unison.stockopname.data.db.AppDatabase
import com.unison.stockopname.data.db.ItemEntity
import com.unison.stockopname.data.db.ProposalEntity
import com.unison.stockopname.data.db.ProposalStatus
import com.unison.stockopname.domain.BarcodeParser
import com.unison.stockopname.domain.Misplacement
import com.unison.stockopname.domain.MisplacementChecker
import com.unison.stockopname.domain.ParsedBarcode

sealed class ScanOutcome {
    data class Found(
        val item: ItemEntity,
        val misplacement: Misplacement?,
        /** Terisi bila item ditemukan lewat resolusi label karung (bukan scan barcode master). */
        val label: LabelResolveDto? = null,
    ) : ScanOutcome()
    /** Proposal sudah ada. Termasuk yang disetujui tapi master belum tersinkron. */
    data class Pending(val proposal: ProposalEntity) : ScanOutcome()
    data class Rejected(val proposal: ProposalEntity) : ScanOutcome()
    data class NotFound(val barcode: String) : ScanOutcome()
}

data class ScanResult(val parsed: ParsedBarcode, val outcome: ScanOutcome)

/** Label karung WIP: K + 7 karakter alfanumerik, contoh K00004AV (data .159: 100% cocok). */
private val K_SERIAL = Regex("^K[A-Z0-9]{7}$")

/**
 * Pencarian offline-first ke Room; bila tidak ketemu dan scan berupa serial label
 * karung (K#######), coba resolve ke server (label_resolve.php) lalu cocokkan
 * itcode-nya dengan katalog lokal. Bila label tidak ditemukan / itcode tidak ada
 * di katalog / jaringan gagal, alur lanjut ke Mode A (proposal) seperti biasa.
 */
class ScanService(private val db: AppDatabase, private val api: (() -> WmsApi)? = null) {
    suspend fun lookup(raw: String, sessionWarehouse: String): ScanResult? {
        val parsed = BarcodeParser.parse(raw) ?: return null

        db.items().findByCode(parsed.itemCode)?.let { item ->
            val misplacement = MisplacementChecker.check(sessionWarehouse, item.warehouseCode)
            return ScanResult(parsed, ScanOutcome.Found(item, misplacement))
        }

        if (parsed.lotNo == null && parsed.qty == null && K_SERIAL.matches(parsed.itemCode)) {
            val resolved = api?.let { client ->
                when (val r = apiCall { client().labelResolve(parsed.itemCode) }) {
                    is ApiResult.Ok -> r.data
                    else -> null // 404 / format salah / jaringan / token: fallback Mode A
                }
            }
            if (resolved != null) {
                db.items().findByCode(resolved.itcode)?.let { item ->
                    val misplacement = MisplacementChecker.check(sessionWarehouse, item.warehouseCode)
                    return ScanResult(parsed, ScanOutcome.Found(item, misplacement, label = resolved))
                }
                // itcode label tidak ada di katalog lokal -> lanjut Mode A
            }
        }

        val proposal = db.proposals().findByBarcode(parsed.itemCode)
        val outcome = when {
            proposal == null -> ScanOutcome.NotFound(parsed.itemCode)
            proposal.status == ProposalStatus.REJECTED -> ScanOutcome.Rejected(proposal)
            else -> ScanOutcome.Pending(proposal)
        }
        return ScanResult(parsed, outcome)
    }
}
