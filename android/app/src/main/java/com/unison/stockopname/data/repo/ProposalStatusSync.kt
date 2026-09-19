package com.unison.stockopname.data.repo

import com.unison.stockopname.data.api.ApiResult
import com.unison.stockopname.data.api.WmsApi
import com.unison.stockopname.data.api.apiCall
import com.unison.stockopname.data.db.ProposalDao
import com.unison.stockopname.data.db.ProposalStatus

/** Tarik status approve/reject dari server. Hanya server yang boleh mengubah status proposal. */
class ProposalStatusSync(private val api: WmsApi, private val dao: ProposalDao) {
    private val known = setOf(ProposalStatus.PENDING, ProposalStatus.ACTIVE, ProposalStatus.REJECTED)

    suspend fun refresh(): ApiResult<Int> = when (val r = apiCall { api.proposalStatus() }) {
        is ApiResult.Ok -> {
            var applied = 0
            for (dto in r.data) {
                if (dto.status in known) {
                    dao.updateStatus(dto.clientUuid, dto.status, dto.rejectionReason)
                    applied++
                }
            }
            ApiResult.Ok(applied)
        }
        is ApiResult.AuthExpired -> ApiResult.AuthExpired
        is ApiResult.Failure -> r
    }
}
