package com.unison.stockopname.update

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import com.google.gson.Gson
import com.google.gson.JsonParseException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit

/** Isi `stock/updates/version.json`, diedit manual tiap rilis. */
data class UpdateInfo(
    val versionCode: Int = 0,
    val versionName: String = "",
    val apkFileName: String = "",
    val notes: String = "",
    val mandatory: Boolean = false,
)

/**
 * "App store" sendiri (sama seperti MVNative): server hanya menyajikan file statis `updates/version.json`
 * dan APK-nya. App membandingkan versionCode dengan BuildConfig.VERSION_CODE, lalu mengunduh dan memasang.
 */
class UpdateManager(
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(8, TimeUnit.SECONDS)
        .build(),
) {
    private val gson = Gson()

    /** .../stock/api/ menjadi .../stock/updates/ (folder bertetangga dengan api/). */
    fun updatesBaseUrl(apiBaseUrl: String): String {
        val trimmed = apiBaseUrl.trimEnd('/')
        val root = if (trimmed.endsWith("/api")) trimmed.removeSuffix("/api") else trimmed
        return "$root/updates/"
    }

    /** null bila tidak ada update baru ATAU server tidak terjangkau/berkas rusak (diam, bukan error). */
    suspend fun checkForUpdate(apiBaseUrl: String, currentVersionCode: Int): UpdateInfo? = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder().url(updatesBaseUrl(apiBaseUrl) + "version.json").build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext null
                val body = response.body?.string()
                if (body.isNullOrBlank()) return@withContext null
                val info = gson.fromJson(body, UpdateInfo::class.java) ?: return@withContext null
                if (info.versionCode > currentVersionCode && isSafeApkName(info.apkFileName)) info else null
            }
        } catch (e: IOException) {
            null
        } catch (e: JsonParseException) {
            null
        } catch (e: IllegalArgumentException) {
            null
        }
    }

    private fun isSafeApkName(name: String): Boolean =
        name.isNotBlank() && name.endsWith(".apk") && !name.contains('/') && !name.contains('\\') && !name.contains("..")

    /** Unduh lewat DownloadManager sistem (progres/notifikasi ditangani OS). */
    fun enqueueDownload(context: Context, apiBaseUrl: String, info: UpdateInfo): Long {
        val dir = File(context.getExternalFilesDir(null), "updates").apply { mkdirs() }
        val dest = File(dir, info.apkFileName)
        if (dest.exists()) dest.delete()

        val request = DownloadManager.Request(Uri.parse(updatesBaseUrl(apiBaseUrl) + info.apkFileName))
            .setTitle("Update Stock Opname v${info.versionName}")
            .setDescription("Mengunduh update aplikasi...")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationUri(Uri.fromFile(dest))
            .setAllowedOverMetered(true)
            .setAllowedOverRoaming(true)
        val dm = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        return dm.enqueue(request)
    }

    /** Buka APK yang sudah diunduh lewat Package Installer. Android menolak bila tanda tangan beda. */
    fun installDownloadedApk(context: Context, apkFileName: String) {
        val apk = File(File(context.getExternalFilesDir(null), "updates"), apkFileName)
        if (!apk.exists()) return
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", apk)
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }
}
