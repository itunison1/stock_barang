package com.unison.stockopname.data.api

import com.google.gson.annotations.SerializedName

data class ApiEnvelope<T>(val success: Boolean = false, val data: T? = null, val message: String? = null)

data class LoginRequest(val username: String, val password: String, val device: String)

data class LoginData(
    val token: String,
    val iduser: Int,
    val username: String,
    @SerializedName("user_divisi") val userDivisi: String?,
    @SerializedName("user_level") val userLevel: Int,
)

data class WarehouseDto(val code: String, val name: String)

data class MasterItemDto(
    val id: Long,
    @SerializedName("item_code") val itemCode: String,
    @SerializedName("item_name") val itemName: String,
    val stock: Double,
    val unit: String?,
    val pack: String?,
    @SerializedName("isi_per_pack") val isiPerPack: Double?,
    @SerializedName("warehouse_code") val warehouseCode: String?,
)

data class MasterPage(
    val items: List<MasterItemDto>,
    @SerializedName("next_after_id") val nextAfterId: Long,
    val done: Boolean,
    @SerializedName("server_time") val serverTime: String,
    @SerializedName("supports_delta") val supportsDelta: Boolean,
)

data class CountPayload(
    @SerializedName("client_uuid") val clientUuid: String,
    @SerializedName("session_uuid") val sessionUuid: String,
    @SerializedName("warehouse_code") val warehouseCode: String,
    @SerializedName("item_code") val itemCode: String,
    @SerializedName("item_name") val itemName: String,
    @SerializedName("qty_system") val qtySystem: Double,
    @SerializedName("qty_physical") val qtyPhysical: Int,
    val variance: Double,
    @SerializedName("rack_code") val rackCode: String?,
    val note: String,
    @SerializedName("supersedes_uuid") val supersedesUuid: String?,
    @SerializedName("created_at_device") val createdAtDevice: String,
)

data class AuditPayload(
    @SerializedName("client_uuid") val clientUuid: String,
    val action: String,
    @SerializedName("entity_type") val entityType: String,
    @SerializedName("entity_uuid") val entityUuid: String?,
    val description: String,
    @SerializedName("detail_json") val detailJson: String?,
    @SerializedName("created_at_device") val createdAtDevice: String,
)

/** Disimpan sebagai payloadJson di outbox. `photoPath` hanya untuk HP, tidak dikirim sebagai field. */
data class ProposalPayload(
    @SerializedName("client_uuid") val clientUuid: String,
    @SerializedName("session_uuid") val sessionUuid: String,
    val barcode: String,
    val name: String,
    val category: String,
    @SerializedName("proposed_qty") val proposedQty: Int,
    @SerializedName("warehouse_code") val warehouseCode: String,
    val notes: String,
    @SerializedName("created_at_device") val createdAtDevice: String,
    @SerializedName("photo_sha256") val photoSha256: String,
    @SerializedName("photo_path") val photoPath: String,
)

data class DuplicateAck(val duplicate: Boolean = false)

data class ProposalStatusDto(
    @SerializedName("client_uuid") val clientUuid: String,
    val status: String,
    @SerializedName("rejection_reason") val rejectionReason: String?,
    @SerializedName("approved_at") val approvedAt: String?,
)
