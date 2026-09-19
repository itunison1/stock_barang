package com.unison.stockopname.sync

import com.unison.stockopname.data.api.ApiResult
import com.unison.stockopname.data.api.AuditPayload
import com.unison.stockopname.data.api.CountPayload
import com.unison.stockopname.data.api.Payloads
import com.unison.stockopname.data.api.ProposalPayload
import com.unison.stockopname.data.api.WmsApi
import com.unison.stockopname.data.api.apiCall
import com.unison.stockopname.data.api.asUnit
import com.unison.stockopname.data.db.OutboxEntity
import com.unison.stockopname.data.db.OutboxType
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File

class ApiOutboxSender(private val api: WmsApi) : OutboxSender {
    override suspend fun send(entry: OutboxEntity): ApiResult<Unit> = when (entry.type) {
        OutboxType.COUNT -> apiCall { api.count(Payloads.parse(entry.payloadJson, CountPayload::class.java)) }.asUnit()
        OutboxType.AUDIT -> apiCall { api.audit(Payloads.parse(entry.payloadJson, AuditPayload::class.java)) }.asUnit()
        OutboxType.PROPOSAL -> sendProposal(entry)
        else -> ApiResult.Failure("Tipe outbox tidak dikenal: ${entry.type}", retryable = false)
    }

    private suspend fun sendProposal(entry: OutboxEntity): ApiResult<Unit> {
        val p = Payloads.parse(entry.payloadJson, ProposalPayload::class.java)
        val file = File(p.photoPath)
        if (!file.isFile) return ApiResult.Failure("File foto proposal hilang: ${file.name}", retryable = false)

        val text = "text/plain".toMediaType()
        fun part(v: String) = v.toRequestBody(text)
        val fields = mapOf(
            "client_uuid" to part(p.clientUuid),
            "session_uuid" to part(p.sessionUuid),
            "barcode" to part(p.barcode),
            "name" to part(p.name),
            "category" to part(p.category),
            "proposed_qty" to part(p.proposedQty.toString()),
            "warehouse_code" to part(p.warehouseCode),
            "notes" to part(p.notes),
            "created_at_device" to part(p.createdAtDevice),
            "photo_sha256" to part(p.photoSha256),
        )
        val photo = MultipartBody.Part.createFormData(
            "photo", "${p.clientUuid}.jpg", file.asRequestBody("image/jpeg".toMediaType())
        )
        return apiCall { api.proposal(fields, photo) }.asUnit()
    }
}
