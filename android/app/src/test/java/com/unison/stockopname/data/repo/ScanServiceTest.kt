package com.unison.stockopname.data.repo

import com.unison.stockopname.data.api.ApiEnvelope
import com.unison.stockopname.data.api.AuditPayload
import com.unison.stockopname.data.api.CountPayload
import com.unison.stockopname.data.api.LabelResolveDto
import com.unison.stockopname.data.api.LoginRequest
import com.unison.stockopname.data.api.UserCreateRequest
import com.unison.stockopname.data.api.WmsApi
import com.unison.stockopname.data.db.AppDatabase
import com.unison.stockopname.data.db.ProposalEntity
import com.unison.stockopname.data.db.ProposalStatus
import com.unison.stockopname.newTestDb
import com.unison.stockopname.testItem
import kotlinx.coroutines.runBlocking
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import retrofit2.Response

private enum class FakeLabelMode { OK, NOT_FOUND, AUTH_EXPIRED }

/** Fake WmsApi: hanya labelResolve yang dipakai jalur fallback ScanService. */
private class FakeLabelApi(private val mode: FakeLabelMode, private val itcode: String = "NM8H0120K") : WmsApi {
    var requested: String? = null

    override suspend fun labelResolve(serial: String): Response<ApiEnvelope<LabelResolveDto>> {
        requested = serial
        return when (mode) {
            FakeLabelMode.OK -> Response.success(
                ApiEnvelope(true, LabelResolveDto(type = "label_karung", serial = serial, itcode = itcode, status = "IN_STOCK", spnum = 222609, spSequence = 4), null)
            )
            FakeLabelMode.NOT_FOUND -> Response.error(
                404,
                """{"success":false,"message":"Serial label karung tidak ditemukan: $serial"}"""
                    .toResponseBody("application/json".toMediaType()),
            )
            FakeLabelMode.AUTH_EXPIRED -> Response.error(
                401,
                """{"success":false,"message":"Token tidak valid."}"""
                    .toResponseBody("application/json".toMediaType()),
            )
        }
    }

    override suspend fun login(body: LoginRequest): Nothing = throw UnsupportedOperationException()
    override suspend fun warehouses(): Nothing = throw UnsupportedOperationException()
    override suspend fun master(afterId: Long, limit: Int, updatedSince: String?): Nothing = throw UnsupportedOperationException()
    override suspend fun count(body: CountPayload): Nothing = throw UnsupportedOperationException()
    override suspend fun audit(body: AuditPayload): Nothing = throw UnsupportedOperationException()
    override suspend fun proposal(fields: Map<String, RequestBody>, photo: MultipartBody.Part): Nothing = throw UnsupportedOperationException()
    override suspend fun proposalStatus(): Nothing = throw UnsupportedOperationException()
    override suspend fun users(): Nothing = throw UnsupportedOperationException()
    override suspend fun createUser(body: UserCreateRequest): Nothing = throw UnsupportedOperationException()
}

@RunWith(RobolectricTestRunner::class)
class ScanServiceTest {
    private lateinit var db: AppDatabase
    private lateinit var service: ScanService

    @Before fun setUp() { db = newTestDb(); service = ScanService(db) }
    @After fun tearDown() { db.close() }

    private fun proposal(barcode: String, status: String, reason: String? = null) = ProposalEntity(
        "p-$barcode", "s1", barcode, "BAUT BARU", "Baut", 100, "U2 GUDANG2", "", "/x.jpg", "a".repeat(64),
        status, reason, 1L, "kirana"
    )

    @Test fun registeredItemInSameWarehouseIsFoundWithoutMisplacement() = runBlocking {
        db.items().upsertAll(listOf(testItem("AB6C50", warehouse = "U2 GUDANG2")))
        val r = service.lookup("AB6C50", "U2 GUDANG2")!!
        val found = r.outcome as ScanOutcome.Found
        assertEquals("AB6C50", found.item.itemCode)
        assertNull(found.misplacement)
    }

    @Test fun itemRegisteredElsewhereRaisesMisplacement() = runBlocking {
        db.items().upsertAll(listOf(testItem("AB6C50", warehouse = "U2 GUDANG3")))
        val found = service.lookup("AB6C50", "U2 GUDANG1")!!.outcome as ScanOutcome.Found
        assertEquals("U2 GUDANG3", found.misplacement!!.registeredWarehouse)
    }

    @Test fun itemWithUnknownWarehouseNeverRaisesMisplacement() = runBlocking {
        db.items().upsertAll(listOf(testItem("AB6C50", warehouse = null)))
        assertNull((service.lookup("AB6C50", "U2 GUDANG1")!!.outcome as ScanOutcome.Found).misplacement)
    }

    @Test fun compositeBarcodeResolvesItemAndKeepsParsedFields() = runBlocking {
        db.items().upsertAll(listOf(testItem("AB6C50")))
        val r = service.lookup("AB6C50|LOT-7|120|2026-09-01", "U2 GUDANG2")!!
        assertTrue(r.outcome is ScanOutcome.Found)
        assertEquals(120, r.parsed.qty)
        assertEquals("LOT-7", r.parsed.lotNo)
    }

    @Test fun pendingAndApprovedProposalsBothReportPending() = runBlocking {
        db.proposals().insert(proposal("111", ProposalStatus.PENDING))
        db.proposals().insert(proposal("222", ProposalStatus.ACTIVE))
        assertTrue(service.lookup("111", "U2 GUDANG2")!!.outcome is ScanOutcome.Pending)
        assertTrue(service.lookup("222", "U2 GUDANG2")!!.outcome is ScanOutcome.Pending)
    }

    @Test fun rejectedProposalReportsRejectedWithReason() = runBlocking {
        db.proposals().insert(proposal("333", ProposalStatus.REJECTED, "Foto blur"))
        val o = service.lookup("333", "U2 GUDANG2")!!.outcome as ScanOutcome.Rejected
        assertEquals("Foto blur", o.proposal.rejectionReason)
    }

    @Test fun unknownBarcodeIsNotFound() = runBlocking {
        assertEquals(ScanOutcome.NotFound("999"), service.lookup("999", "U2 GUDANG2")!!.outcome)
    }

    @Test fun blankInputReturnsNull() = runBlocking {
        assertNull(service.lookup("   ", "U2 GUDANG2"))
    }

    // ===== Fallback label karung (K-serial) =====

    @Test fun kSerialResolvesToCatalogItemAndCarriesLabelInfo() = runBlocking {
        // itcode dari label (NM8H0120K) ada di katalog lokal -> Found + info label
        db.items().upsertAll(listOf(testItem("NM8H0120K", warehouse = "U2 GUDANG2")))
        val api = FakeLabelApi(FakeLabelMode.OK)
        val svc = ScanService(db, api = { api })
        val r = svc.lookup("K00004AV", "U2 GUDANG2")!!
        val found = r.outcome as ScanOutcome.Found
        assertEquals("NM8H0120K", found.item.itemCode)
        assertEquals("K00004AV", found.label!!.serial)
        assertEquals(222609L, found.label!!.spnum)
        assertEquals("K00004AV", api.requested)
    }

    @Test fun kSerialWithUnknownItcodeFallsBackToModeA() = runBlocking {
        // label resolve OK tapi itcode tidak ada di katalog -> lanjut Mode A (NotFound)
        val api = FakeLabelApi(FakeLabelMode.OK)
        val svc = ScanService(db, api = { api })
        assertEquals(ScanOutcome.NotFound("K00004AV"), svc.lookup("K00004AV", "U2 GUDANG2")!!.outcome)
        assertEquals("K00004AV", api.requested)
    }

    @Test fun kSerialLabel404FallsBackToModeA() = runBlocking {
        val api = FakeLabelApi(FakeLabelMode.NOT_FOUND)
        val svc = ScanService(db, api = { api })
        assertEquals(ScanOutcome.NotFound("K999999Z"), svc.lookup("K999999Z", "U2 GUDANG2")!!.outcome)
        assertEquals("K999999Z", api.requested)
    }

    @Test fun kSerialAuthExpiredFallsBackToModeA() = runBlocking {
        val api = FakeLabelApi(FakeLabelMode.AUTH_EXPIRED)
        val svc = ScanService(db, api = { api })
        assertEquals(ScanOutcome.NotFound("K00004AV"), svc.lookup("K00004AV", "U2 GUDANG2")!!.outcome)
    }

    // ===== Fallback lot Gudang Apps (8-12 alnum, contoh 9CM36I810J) =====

    @Test fun lotGudangResolvesToCatalogItemAndCarriesLabelInfo() = runBlocking {
        db.items().upsertAll(listOf(testItem("NM8H0120K", warehouse = "U2 GUDANG2")))
        val api = FakeLabelApi(FakeLabelMode.OK)
        val svc = ScanService(db, api = { api })
        val r = svc.lookup("9CM36I810J", "U2 GUDANG2")!!
        val found = r.outcome as ScanOutcome.Found
        assertEquals("NM8H0120K", found.item.itemCode)
        assertEquals("9CM36I810J", found.label!!.serial)
        assertEquals("9CM36I810J", api.requested)
    }

    @Test fun lotGudangUnknownFallsBackToModeA() = runBlocking {
        val api = FakeLabelApi(FakeLabelMode.NOT_FOUND)
        val svc = ScanService(db, api = { api })
        assertEquals(ScanOutcome.NotFound("9CM36I810J"), svc.lookup("9CM36I810J", "U2 GUDANG2")!!.outcome)
        assertEquals("9CM36I810J", api.requested)
    }

    @Test fun lotGudangWithHyphenResolves() = runBlocking {
        // Lot dengan tanda hubung (contoh nyata: 8DB39FA-GJ, 1.890 lot format ini)
        db.items().upsertAll(listOf(testItem("NM8H0120K", warehouse = "U2 GUDANG2")))
        val api = FakeLabelApi(FakeLabelMode.OK)
        val svc = ScanService(db, api = { api })
        val r = svc.lookup("8DB39FA-GJ", "U2 GUDANG2")!!
        val found = r.outcome as ScanOutcome.Found
        assertEquals("NM8H0120K", found.item.itemCode)
        assertEquals("8DB39FA-GJ", api.requested)
    }

    @Test fun kSerialWithoutApiStaysOfflineNotFound() = runBlocking {
        // Tanpa api (konstruktor lama), serial K tetap NotFound offline.
        assertEquals(ScanOutcome.NotFound("K00004AV"), service.lookup("K00004AV", "U2 GUDANG2")!!.outcome)
    }
}
