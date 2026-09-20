package com.unison.stockopname

import android.content.Context
import android.os.Build
import androidx.room.Room
import com.unison.stockopname.data.api.ApiFactory
import com.unison.stockopname.data.api.WmsApi
import com.unison.stockopname.data.db.AppDatabase
import com.unison.stockopname.data.db.PrinterEntity
import com.unison.stockopname.data.prefs.AppSettings
import com.unison.stockopname.data.prefs.KeyValueStores
import com.unison.stockopname.data.printer.PrinterClient
import com.unison.stockopname.data.printer.PrinterSeeds
import com.unison.stockopname.data.repo.AuditWriter
import com.unison.stockopname.data.repo.AuthRepository
import com.unison.stockopname.data.repo.CountService
import com.unison.stockopname.data.repo.MasterSyncService
import com.unison.stockopname.data.repo.ProposalService
import com.unison.stockopname.data.repo.ProposalStatusSync
import com.unison.stockopname.data.repo.ScanService
import com.unison.stockopname.data.repo.SessionService
import com.unison.stockopname.sync.ApiOutboxSender
import com.unison.stockopname.sync.OutboxProcessor
import com.unison.stockopname.sync.SyncScheduler
import com.unison.stockopname.sync.SyncTrigger
import com.unison.stockopname.update.UpdateManager

/** Wiring manual (tanpa Hilt). Dibuat sekali di Application. */
class AppContainer(private val context: Context) {
    val db: AppDatabase by lazy { Room.databaseBuilder(context, AppDatabase::class.java, "stockopname.db").build() }

    private val plainStore by lazy { KeyValueStores.plain(context) }
    private val secureStore by lazy { KeyValueStores.secure(context) }

    val settings: AppSettings by lazy { AppSettings(plainStore, BuildConfig.DEFAULT_BASE_URL) }

    private var cachedApi: Pair<String, WmsApi>? = null

    /** Klien API mengikuti base URL terkini (bisa diubah operator di pengaturan). */
    @Synchronized
    fun api(): WmsApi {
        val url = settings.baseUrl
        cachedApi?.takeIf { it.first == url }?.let { return it.second }
        return ApiFactory.create(url) { auth.token() }.also { cachedApi = url to it }
    }

    val auth: AuthRepository by lazy {
        AuthRepository({ api() }, secureStore, "${Build.MANUFACTURER} ${Build.MODEL}")
    }

    private val syncTrigger = SyncTrigger { SyncScheduler.requestOutboxSync(context) }
    private val audit by lazy { AuditWriter(db) }

    val sessions: SessionService by lazy { SessionService(db, audit) }
    val scan: ScanService by lazy { ScanService(db) }
    val counts: CountService by lazy { CountService(db, syncTrigger, audit) }
    val proposals: ProposalService by lazy { ProposalService(db, syncTrigger, audit) }
    val printerClient = PrinterClient()
    val updates = UpdateManager()

    fun newOutboxProcessor() = OutboxProcessor(db.outbox(), ApiOutboxSender(api()))
    fun newMasterSync() = MasterSyncService(api(), db.items(), db.warehouses(), plainStore)
    fun newProposalStatusSync() = ProposalStatusSync(api(), db.proposals())

    /** Migrasikan seed dummy lama ke satu printer LAN nyata; perubahan operator berikutnya tetap editable. */
    suspend fun ensurePrintersSeeded() {
        val seed = PrinterSeeds.printers.single()
        val dao = db.printers()
        val current = dao.findById(seed.id)
        dao.deleteExcept(seed.id)
        if (current == null || current.host.startsWith("192.168.1.") && current.host != seed.host) {
            dao.upsert(PrinterEntity(seed.id, seed.name, seed.host, seed.port, seed.paper.name))
        }
    }
}
