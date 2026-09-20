package com.unison.stockopname.data.api

import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.PartMap
import retrofit2.http.Query

interface WmsApi {
    @POST("login.php")
    suspend fun login(@Body body: LoginRequest): Response<ApiEnvelope<LoginData>>

    @GET("warehouses.php")
    suspend fun warehouses(): Response<ApiEnvelope<List<WarehouseDto>>>

    @GET("master.php")
    suspend fun master(
        @Query("after_id") afterId: Long,
        @Query("limit") limit: Int,
        @Query("updated_since") updatedSince: String?,
    ): Response<ApiEnvelope<MasterPage>>

    @POST("count.php")
    suspend fun count(@Body body: CountPayload): Response<ApiEnvelope<DuplicateAck>>

    @POST("audit.php")
    suspend fun audit(@Body body: AuditPayload): Response<ApiEnvelope<DuplicateAck>>

    @Multipart
    @POST("proposal.php")
    suspend fun proposal(
        @PartMap fields: Map<String, @JvmSuppressWildcards RequestBody>,
        @Part photo: MultipartBody.Part,
    ): Response<ApiEnvelope<DuplicateAck>>

    @GET("proposal_status.php")
    suspend fun proposalStatus(): Response<ApiEnvelope<List<ProposalStatusDto>>>

    @GET("users.php")
    suspend fun users(): Response<ApiEnvelope<List<UserDto>>>

    @POST("users.php")
    suspend fun createUser(@Body body: UserCreateRequest): Response<ApiEnvelope<UserDto>>
}
