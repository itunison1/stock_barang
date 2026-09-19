package com.unison.stockopname.data.repo

import androidx.room.withTransaction
import com.unison.stockopname.data.api.Payloads
import com.unison.stockopname.data.db.AppDatabase
import com.unison.stockopname.data.db.OutboxEntity
import com.unison.stockopname.data.db.OutboxType
import com.unison.stockopname.data.db.ProposalEntity
import com.unison.stockopname.data.db.ProposalStatus
import com.unison.stockopname.data.db.SessionEntity
import com.unison.stockopname.sync.SyncTrigger
import java.io.File
import java.security.MessageDigest
import java.util.UUID

object Hashing {
    fun sha256Hex(file: File): String {
        val md = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buf = ByteArray(8192)
            while (true) {
                val n = input.read(buf)
                if (n < 0) break
                md.update(buf, 0, n)
            }
        }
        return md.digest().joinToString("") { "%02x".format(it) }
    }
}

/** Mode A: barang tidak terdaftar menjadi proposal PENDING dengan foto wajib. Status tidak pernah `active` dari HP. */
class ProposalService(
    private val db: AppDatabase,
    private val sync: SyncTrigger,
    private val audit: AuditWriter,
    private val clock: () -> Long = System::currentTimeMillis,
    private val newUuid: () -> String = { UUID.randomUUID().toString() },
) {
    suspend fun create(
        session: SessionEntity,
        barcode: String,
        name: String,
        category: String,
        proposedQty: Int,
        notes: String,
        photo: File,
    ): ProposalEntity {
        require(barcode.isNotBlank()) { "Barcode wajib" }
        require(name.isNotBlank()) { "Nama spesifikasi mur/baut wajib diisi" }
        require(proposedQty >= 0) { "Qty tidak boleh negatif" }
        require(photo.isFile && photo.length() > 0) { "Mode A mewajibkan foto fisik barang" }

        val proposal = ProposalEntity(
            uuid = newUuid(), sessionUuid = session.uuid, barcode = barcode.trim(), name = name.trim(),
            category = category.trim(), proposedQty = proposedQty, warehouseCode = session.warehouseCode,
            notes = notes.trim(), photoPath = photo.absolutePath, photoSha256 = Hashing.sha256Hex(photo),
            status = ProposalStatus.PENDING, rejectionReason = null, createdAtDevice = clock(),
            operator = session.operator,
        )

        db.withTransaction {
            db.proposals().insert(proposal)
            db.outbox().insert(
                OutboxEntity(type = OutboxType.PROPOSAL, clientUuid = proposal.uuid, payloadJson = Payloads.proposal(proposal), createdAt = clock())
            )
            audit.record(
                session.operator, "create_proposal", "proposal", proposal.uuid,
                "Operator mengajukan proposal \"${proposal.name}\" (${proposal.barcode}) di ${session.warehouseCode} [PENDING]"
            )
        }
        sync.request()
        return proposal
    }
}
