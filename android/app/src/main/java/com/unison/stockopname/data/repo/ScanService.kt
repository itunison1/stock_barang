package com.unison.stockopname.data.repo

import com.unison.stockopname.data.db.AppDatabase
import com.unison.stockopname.data.db.ItemEntity
import com.unison.stockopname.data.db.ProposalEntity
import com.unison.stockopname.data.db.ProposalStatus
import com.unison.stockopname.domain.BarcodeParser
import com.unison.stockopname.domain.Misplacement
import com.unison.stockopname.domain.MisplacementChecker
import com.unison.stockopname.domain.ParsedBarcode

sealed class ScanOutcome {
    data class Found(val item: ItemEntity, val misplacement: Misplacement?) : ScanOutcome()
    /** Proposal sudah ada. Termasuk yang disetujui tapi master belum tersinkron. */
    data class Pending(val proposal: ProposalEntity) : ScanOutcome()
    data class Rejected(val proposal: ProposalEntity) : ScanOutcome()
    data class NotFound(val barcode: String) : ScanOutcome()
}

data class ScanResult(val parsed: ParsedBarcode, val outcome: ScanOutcome)

/** Pencarian selalu ke Room (offline-first), tidak pernah ke jaringan. */
class ScanService(private val db: AppDatabase) {
    suspend fun lookup(raw: String, sessionWarehouse: String): ScanResult? {
        val parsed = BarcodeParser.parse(raw) ?: return null

        db.items().findByCode(parsed.itemCode)?.let { item ->
            val misplacement = MisplacementChecker.check(sessionWarehouse, item.warehouseCode)
            return ScanResult(parsed, ScanOutcome.Found(item, misplacement))
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
