# Android Core (domain, printer, Room, API, sync, update) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fondasi app Android operator tanpa UI: aturan bisnis, cetak TCP 9100, database offline, klien API, sinkronisasi WorkManager, dan auto-update, semuanya teruji di JVM.

**Architecture:** Satu modul `app` di `android/`. Lapisan `domain` (murni Kotlin), `data` (Room, Retrofit, printer), `sync` (outbox + WorkManager). Semua tulis lewat Room dulu, lalu outbox dikirim berurutan dan idempoten (`client_uuid`). UI Compose ada di plan terpisah (`2026-09-19-android-ui.md`, ditulis setelah plan ini selesai supaya memakai signature service yang final).

**Tech Stack:** Kotlin 1.9.22, AGP 8.2.2, Gradle 8.4, KSP 1.9.22-1.0.17, Room 2.6.1, WorkManager 2.9.0, Retrofit 2.9.0, OkHttp 4.12.0, Gson, coroutines 1.7.3, JUnit 4, Robolectric 4.11.1, MockWebServer 4.12.0. Versi ini terbukti jalan di mesin ini (project MVNative memakai AGP/Kotlin/Gradle yang sama).

**Spec:** [2026-09-19-android-native-operator-design.md](../specs/2026-09-19-android-native-operator-design.md). Kontrak endpoint: [2026-09-19-wms-backend-api.md](2026-09-19-wms-backend-api.md).

## Global Constraints

- minSdk 26, **compileSdk 34, targetSdk 34** (revisi dari spec: AGP 8.2.2 resmi mendukung sampai 34), Java/Kotlin target 17.
- Package: `com.unison.stockopname` (revisi dari spec, konsisten dengan `com.unison.mviewnative`).
- `domain/` tidak boleh mengimpor `android.*`.
- Tidak ada data karangan: field tanpa sumber nyata bernilai `null`, tidak diisi tebakan.
- Status proposal dari HP selalu `pending`; hanya server yang mengubahnya.
- HP tidak membawa kredensial MySQL, hanya base URL dan token (di `EncryptedSharedPreferences`).
- Base URL default `http://192.168.1.140/stock/api/` (dari LAN jangan IP publik). Cleartext hanya untuk host yang terdaftar di `network_security_config.xml`.
- Semua tulis (hitung, proposal, audit) masuk Room + outbox dalam satu transaksi, lalu `SyncTrigger.request()`.
- Retry: 5 kali gagal berturut-turut menjadikan entri outbox `FAILED`; 401 menghentikan sync tanpa menghapus data lokal.
- Urutan rilis APK: upload APK, verifikasi HTTP 200, baru naikkan `version.json`.
- Pesan untuk operator berbahasa Indonesia.
- Perintah Gradle dijalankan dari folder `android/`: `./gradlew ...`.

## Indeks interface (dipakai lintas task)

```kotlin
// domain
data class ParsedBarcode(val itemCode: String, val lotNo: String?, val qty: Int?, val prodDate: String?)
object BarcodeParser { fun parse(raw: String): ParsedBarcode? }
object VarianceCalculator { fun variance(qtyPhysical: Int, qtySystem: Double): Double }
data class Misplacement(val registeredWarehouse: String, val scannedWarehouse: String) { val message: String }
object MisplacementChecker { fun check(scannedWarehouse: String, registeredWarehouse: String?): Misplacement? }
enum class DuplicateAction { OVERWRITE, ADD }
object DuplicateCountPolicy { fun resolve(existing: Int?, entered: Int, action: DuplicateAction?): Int }
// printer
enum class PaperWidth(val chars: Int) { MM80(48), MM58(32) }
data class LabelData(val barcode: String, val itemName: String, val warehouseCode: String, val qty: Int,
                     val operatorName: String, val printedAt: String, val pending: Boolean)
object EscPosBuilder { fun label(data: LabelData, paper: PaperWidth): ByteArray }
class PrinterClient(connectTimeoutMs: Int = 3000) { suspend fun send(host: String, port: Int, bytes: ByteArray): Result<Unit> }
// api
sealed class ApiResult<out T> { Ok(data) ; AuthExpired ; Failure(message, retryable) }
// sync
enum class SyncOutcome { DONE, RETRY, AUTH_EXPIRED }
fun interface SyncTrigger { fun request() }
```

## File Structure

```
android/
  settings.gradle.kts  build.gradle.kts  gradle.properties  gradlew  gradlew.bat  gradle/wrapper/*
  app/build.gradle.kts  app/proguard-rules.pro
  app/src/main/AndroidManifest.xml
  app/src/main/res/xml/{network_security_config.xml,file_paths.xml}  res/values/strings.xml
  app/src/main/java/com/unison/stockopname/
    StockOpnameApp.kt  AppContainer.kt
    domain/{BarcodeParser.kt,Rules.kt}
    data/printer/{EscPosBuilder.kt,PrinterClient.kt,PrinterSeeds.kt}
    data/db/{Entities.kt,Daos.kt,AppDatabase.kt}
    data/api/{Models.kt,ApiResult.kt,WmsApi.kt,ApiFactory.kt,Payloads.kt}
    data/prefs/{KeyValueStore.kt,AppSettings.kt}
    data/repo/{AuditWriter,SessionService,ScanService,CountService,ProposalService,ProposalStatusSync,AuthRepository,MasterSyncService}.kt
    sync/{OutboxProcessor,ApiOutboxSender,SyncScheduler,SyncWorker,MasterSyncWorker}.kt
    update/UpdateManager.kt
  app/src/test/java/com/unison/stockopname/...   (mirror struktur di atas)
  app/src/test/resources/robolectric.properties
```

---

### Task 1: Scaffold Gradle + wrapper

**Files:**
- Create: `android/settings.gradle.kts`, `android/build.gradle.kts`, `android/gradle.properties`
- Create: `android/app/build.gradle.kts`, `android/app/proguard-rules.pro`
- Create: `android/app/src/main/AndroidManifest.xml`, `android/app/src/main/res/values/strings.xml`
- Create: `android/app/src/main/res/xml/network_security_config.xml`
- Create: `android/app/src/main/java/com/unison/stockopname/StockOpnameApp.kt`
- Create: `android/app/src/test/resources/robolectric.properties`
- Create: `android/app/src/test/java/com/unison/stockopname/BuildConfigTest.kt`
- Generate: `android/gradlew`, `android/gradlew.bat`, `android/gradle/wrapper/*`

**Interfaces:**
- Produces: `BuildConfig.DEFAULT_BASE_URL: String`, `BuildConfig.VERSION_CODE: Int`. `StockOpnameApp` (Application kosong dulu; `container` ditambah di Task 13).

- [ ] **Step 1: Tulis tes yang gagal**

Create `android/app/src/test/java/com/unison/stockopname/BuildConfigTest.kt`:

```kotlin
package com.unison.stockopname

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BuildConfigTest {
    @Test
    fun defaultBaseUrlPointsToStockApiWithTrailingSlash() {
        assertEquals("http://192.168.1.140/stock/api/", BuildConfig.DEFAULT_BASE_URL)
        assertTrue(BuildConfig.DEFAULT_BASE_URL.endsWith("/"))
    }

    @Test
    fun versionCodeIsPositive() {
        assertTrue(BuildConfig.VERSION_CODE >= 1)
    }
}
```

- [ ] **Step 2: Buat file konfigurasi Gradle**

`android/settings.gradle.kts`:
```kotlin
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "StockOpname"
include(":app")
```

`android/build.gradle.kts`:
```kotlin
plugins {
    id("com.android.application") version "8.2.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.22" apply false
    id("com.google.devtools.ksp") version "1.9.22-1.0.17" apply false
}
```

`android/gradle.properties`:
```properties
org.gradle.jvmargs=-Xmx2g -Dfile.encoding=UTF-8
android.useAndroidX=true
kotlin.code.style=official
android.nonTransitiveRClass=true
```

`android/app/build.gradle.kts`:
```kotlin
import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.devtools.ksp")
}

val keystoreProps = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}

android {
    namespace = "com.unison.stockopname"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.unison.stockopname"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
        buildConfigField("String", "DEFAULT_BASE_URL", "\"http://192.168.1.140/stock/api/\"")
    }

    signingConfigs {
        if (keystoreProps.isNotEmpty()) {
            create("release") {
                storeFile = rootProject.file(keystoreProps.getProperty("storeFile"))
                storePassword = keystoreProps.getProperty("storePassword")
                keyAlias = keystoreProps.getProperty("keyAlias")
                keyPassword = keystoreProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            // Tanpa keystore.properties (build lokal) jatuh ke debug keystore. APK yang diedarkan WAJIB
            // dibuat dengan keystore rilis, dan keystore itu tidak boleh berganti (lihat RELEASE.md).
            signingConfig = if (keystoreProps.isNotEmpty()) signingConfigs.getByName("release")
            else signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }

    buildFeatures { buildConfig = true }

    testOptions { unitTests { isIncludeAndroidResources = true } }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")

    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")

    implementation("androidx.work:work-runtime-ktx:2.9.0")

    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.7.3")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
    testImplementation("org.robolectric:robolectric:4.11.1")
    testImplementation("androidx.test:core-ktx:1.5.0")
}
```

`android/app/proguard-rules.pro`:
```
# Aturan proguard proyek (minify dimatikan, berkas ini sengaja kosong).
```

`android/app/src/main/res/values/strings.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Stock Opname</string>
</resources>
```

`android/app/src/main/res/xml/network_security_config.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<!-- Cleartext HTTP hanya untuk server intranet yang terdaftar. Menambah host baru = tambah domain di sini. -->
<network-security-config>
    <base-config cleartextTrafficPermitted="false" />
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">192.168.1.140</domain>
        <domain includeSubdomains="false">192.168.1.159</domain>
    </domain-config>
</network-security-config>
```

`android/app/src/main/AndroidManifest.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:name=".StockOpnameApp"
        android:allowBackup="false"
        android:label="@string/app_name"
        android:networkSecurityConfig="@xml/network_security_config"
        android:supportsRtl="true" />
</manifest>
```

`android/app/src/main/java/com/unison/stockopname/StockOpnameApp.kt`:
```kotlin
package com.unison.stockopname

import android.app.Application

class StockOpnameApp : Application()
```

`android/app/src/test/resources/robolectric.properties`:
```properties
sdk=34
application=android.app.Application
```

Buat `android/local.properties` (tidak ter-commit):
```properties
sdk.dir=C\:\\Users\\cseon\\AppData\\Local\\Android\\Sdk
```

- [ ] **Step 3: Generate wrapper Gradle 8.4**

Run:
```bash
cd android
"$(ls -d ~/.gradle/wrapper/dists/gradle-8.4-bin/*/gradle-8.4)/bin/gradle" wrapper --gradle-version 8.4
./gradlew --version
```
Expected: `Gradle 8.4`, `JVM: 17`.

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `./gradlew :app:testDebugUnitTest --tests "com.unison.stockopname.BuildConfigTest"`
Expected: `BUILD SUCCESSFUL`, 2 tests passed. (Run pertama mengunduh dependensi, bisa beberapa menit.)
Bila `sdk.dir` ditolak, cek path SDK di `local.properties`.

- [ ] **Step 5: Verifikasi build APK**

Run: `./gradlew :app:assembleDebug`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 6: Commit**

```bash
git add android
git commit -m "feat(android): scaffold Gradle project with wrapper, BuildConfig base URL, network security config"
```

---

### Task 2: BarcodeParser

**Files:**
- Create: `android/app/src/main/java/com/unison/stockopname/domain/BarcodeParser.kt`
- Test: `android/app/src/test/java/com/unison/stockopname/domain/BarcodeParserTest.kt`

**Interfaces:**
- Produces: `ParsedBarcode`, `BarcodeParser.parse(raw): ParsedBarcode?` (format `ITEM_CODE|LOT_NO|QTY|DATE`, sama dengan [MobileTerminal.jsx](../../../src/components/mobile/MobileTerminal.jsx)). `null` bila input kosong atau kode barang kosong. QTY bukan angka atau negatif menjadi `null`, bukan error.

- [ ] **Step 1: Tulis tes yang gagal**

```kotlin
package com.unison.stockopname.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class BarcodeParserTest {
    @Test fun plainCodeReturnsItemOnly() {
        assertEquals(ParsedBarcode("AB6C50", null, null, null), BarcodeParser.parse("AB6C50"))
    }

    @Test fun trimsWhitespace() {
        assertEquals("AB6C50", BarcodeParser.parse("  AB6C50 \n")?.itemCode)
    }

    @Test fun fullCompositeParsesAllFields() {
        assertEquals(
            ParsedBarcode("AB6C50", "LOT-77", 1200, "2026-09-01"),
            BarcodeParser.parse("AB6C50|LOT-77|1200|2026-09-01")
        )
    }

    @Test fun partialCompositeLeavesRestNull() {
        assertEquals(ParsedBarcode("AB6C50", "LOT-77", null, null), BarcodeParser.parse("AB6C50|LOT-77"))
    }

    @Test fun blankFieldsBecomeNull() {
        assertEquals(ParsedBarcode("AB6C50", null, 10, null), BarcodeParser.parse("AB6C50||10|"))
    }

    @Test fun nonNumericQtyBecomesNull() {
        assertNull(BarcodeParser.parse("AB6C50|L|abc|2026-09-01")?.qty)
    }

    @Test fun negativeQtyBecomesNull() {
        assertNull(BarcodeParser.parse("AB6C50|L|-5|2026-09-01")?.qty)
    }

    @Test fun emptyInputReturnsNull() {
        assertNull(BarcodeParser.parse(""))
        assertNull(BarcodeParser.parse("   "))
    }

    @Test fun blankItemCodeReturnsNull() {
        assertNull(BarcodeParser.parse("|LOT|10|2026-09-01"))
    }
}
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `./gradlew :app:testDebugUnitTest --tests "*BarcodeParserTest"`
Expected: FAIL kompilasi `Unresolved reference: BarcodeParser`.

- [ ] **Step 3: Implementasi**

```kotlin
package com.unison.stockopname.domain

data class ParsedBarcode(
    val itemCode: String,
    val lotNo: String?,
    val qty: Int?,
    val prodDate: String?,
)

object BarcodeParser {
    fun parse(raw: String): ParsedBarcode? {
        val code = raw.trim()
        if (code.isEmpty()) return null
        if (!code.contains('|')) return ParsedBarcode(code, null, null, null)

        val parts = code.split('|').map { it.trim() }
        val item = parts[0]
        if (item.isEmpty()) return null
        return ParsedBarcode(
            itemCode = item,
            lotNo = parts.getOrNull(1)?.takeIf { it.isNotEmpty() },
            qty = parts.getOrNull(2)?.toIntOrNull()?.takeIf { it >= 0 },
            prodDate = parts.getOrNull(3)?.takeIf { it.isNotEmpty() },
        )
    }
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `./gradlew :app:testDebugUnitTest --tests "*BarcodeParserTest"`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add android/app/src
git commit -m "feat(android): add 2D composite barcode parser"
```

---

### Task 3: Aturan domain (variance, misplacement, hitung ganda)

**Files:**
- Create: `android/app/src/main/java/com/unison/stockopname/domain/Rules.kt`
- Test: `android/app/src/test/java/com/unison/stockopname/domain/RulesTest.kt`

**Interfaces:**
- Produces: `VarianceCalculator`, `Misplacement`, `MisplacementChecker`, `DuplicateAction`, `DuplicateCountPolicy` (signature di indeks). `MisplacementChecker.check` mengembalikan `null` bila gudang terdaftar tidak diketahui (tidak ada alarm palsu dari data kosong).

- [ ] **Step 1: Tulis tes yang gagal**

```kotlin
package com.unison.stockopname.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test

class RulesTest {
    // --- variance ---
    @Test fun varianceNegativeWhenPhysicalLower() {
        assertEquals(-100.0, VarianceCalculator.variance(8400, 8500.0), 0.0001)
    }

    @Test fun variancePositiveWhenPhysicalHigher() {
        assertEquals(50.5, VarianceCalculator.variance(100, 49.5), 0.0001)
    }

    @Test fun varianceZeroWhenEqual() {
        assertEquals(0.0, VarianceCalculator.variance(10, 10.0), 0.0001)
    }

    // --- misplacement ---
    @Test fun sameWarehouseNoAlert() {
        assertNull(MisplacementChecker.check("U2 GUDANG3", "U2 GUDANG3"))
    }

    @Test fun caseAndWhitespaceInsensitive() {
        assertNull(MisplacementChecker.check(" u2 gudang3 ", "U2 GUDANG3"))
    }

    @Test fun differentWarehouseAlertsWithDocMessage() {
        val m = MisplacementChecker.check("U2 GUDANG1", "U2 GUDANG3")!!
        assertEquals("U2 GUDANG3", m.registeredWarehouse)
        assertEquals("U2 GUDANG1", m.scannedWarehouse)
        assertEquals(
            "Barang terdaftar di U2 GUDANG3, tetapi di-scan di U2 GUDANG1. Rekam pemindahan lokasi?",
            m.message
        )
    }

    @Test fun unknownRegisteredWarehouseNeverAlerts() {
        assertNull(MisplacementChecker.check("U2 GUDANG1", null))
        assertNull(MisplacementChecker.check("U2 GUDANG1", "  "))
    }

    // --- duplicate count ---
    @Test fun noExistingUsesEnteredWithoutAction() {
        assertEquals(40, DuplicateCountPolicy.resolve(null, 40, null))
    }

    @Test fun overwriteUsesEntered() {
        assertEquals(40, DuplicateCountPolicy.resolve(100, 40, DuplicateAction.OVERWRITE))
    }

    @Test fun addSumsExistingAndEntered() {
        assertEquals(140, DuplicateCountPolicy.resolve(100, 40, DuplicateAction.ADD))
    }

    @Test fun existingWithoutActionIsProgrammerError() {
        assertThrows(IllegalStateException::class.java) { DuplicateCountPolicy.resolve(100, 40, null) }
    }
}
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `./gradlew :app:testDebugUnitTest --tests "*RulesTest"`
Expected: FAIL kompilasi `Unresolved reference: VarianceCalculator`.

- [ ] **Step 3: Implementasi**

```kotlin
package com.unison.stockopname.domain

object VarianceCalculator {
    /** Selisih = qty fisik - qty sistem (Bab 2.3 panduan). */
    fun variance(qtyPhysical: Int, qtySystem: Double): Double = qtyPhysical - qtySystem
}

data class Misplacement(val registeredWarehouse: String, val scannedWarehouse: String) {
    val message: String
        get() = "Barang terdaftar di $registeredWarehouse, tetapi di-scan di $scannedWarehouse. Rekam pemindahan lokasi?"
}

object MisplacementChecker {
    fun check(scannedWarehouse: String, registeredWarehouse: String?): Misplacement? {
        val registered = registeredWarehouse?.trim().orEmpty()
        val scanned = scannedWarehouse.trim()
        if (registered.isEmpty() || scanned.isEmpty()) return null
        return if (registered.equals(scanned, ignoreCase = true)) null
        else Misplacement(registered, scanned)
    }
}

enum class DuplicateAction { OVERWRITE, ADD }

object DuplicateCountPolicy {
    fun resolve(existing: Int?, entered: Int, action: DuplicateAction?): Int = when {
        existing == null -> entered
        action == DuplicateAction.OVERWRITE -> entered
        action == DuplicateAction.ADD -> existing + entered
        else -> error("Hitungan ganda butuh keputusan operator (timpa atau tambah)")
    }
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `./gradlew :app:testDebugUnitTest --tests "*RulesTest"`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add android/app/src
git commit -m "feat(android): add variance, misplacement and duplicate-count rules"
```

---

### Task 4: EscPosBuilder (label thermal)

**Files:**
- Create: `android/app/src/main/java/com/unison/stockopname/data/printer/EscPosBuilder.kt`
- Test: `android/app/src/test/java/com/unison/stockopname/data/printer/EscPosBuilderTest.kt`

**Interfaces:**
- Produces: `PaperWidth`, `LabelData`, `EscPosBuilder.label(data, paper): ByteArray`.
- Perilaku: byte awal `1B 40` (init). Bila `pending`, ada teks `DRAFT - PENDING APPROVAL` (Bab 3.3). Teks di-ASCII-kan (karakter di luar 32..126 menjadi `?`). Barcode Code128-B (`1D 6B 49 n {B data`, `n = data.length + 2`, `{` di-escape jadi `{{`). Akhir dengan feed lalu potong `1D 56 42 00`.

- [ ] **Step 1: Tulis tes yang gagal**

```kotlin
package com.unison.stockopname.data.printer

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class EscPosBuilderTest {
    private fun label(
        pending: Boolean = true,
        name: String = "BAUT 3/8 x 50 CEMET",
        barcode: String = "AB6C50",
    ) = LabelData(
        barcode = barcode, itemName = name, warehouseCode = "U2 GUDANG3", qty = 500,
        operatorName = "Kirana", printedAt = "2026-09-19 10:00", pending = pending,
    )

    private fun text(bytes: ByteArray) = String(bytes, Charsets.ISO_8859_1)

    private fun indexOf(bytes: ByteArray, vararg seq: Int): Int {
        val pattern = seq.map { it.toByte() }
        for (i in 0..bytes.size - pattern.size) {
            if (pattern.indices.all { bytes[i + it] == pattern[it] }) return i
        }
        return -1
    }

    @Test fun startsWithInitCommand() {
        val b = EscPosBuilder.label(label(), PaperWidth.MM80)
        assertEquals(0x1B.toByte(), b[0])
        assertEquals(0x40.toByte(), b[1])
    }

    @Test fun endsWithPartialCut() {
        val b = EscPosBuilder.label(label(), PaperWidth.MM80)
        val tail = b.takeLast(4).map { it.toInt() and 0xFF }
        assertEquals(listOf(0x1D, 0x56, 0x42, 0x00), tail)
    }

    @Test fun pendingLabelCarriesDraftWatermark() {
        assertTrue(text(EscPosBuilder.label(label(pending = true), PaperWidth.MM80)).contains("DRAFT - PENDING APPROVAL"))
    }

    @Test fun activeLabelHasNoDraftWatermark() {
        assertFalse(text(EscPosBuilder.label(label(pending = false), PaperWidth.MM80)).contains("DRAFT"))
    }

    @Test fun containsItemFieldsAndCompanyHeader() {
        val t = text(EscPosBuilder.label(label(), PaperWidth.MM80))
        assertTrue(t.contains("PT UNISON INDUSTRIAL INDONESIA"))
        assertTrue(t.contains("BAUT 3/8 x 50 CEMET"))
        assertTrue(t.contains("U2 GUDANG3"))
        assertTrue(t.contains("Qty     : 500"))
        assertTrue(t.contains("Operator: Kirana"))
    }

    @Test fun barcodeUsesCode128SetBWithLength() {
        val b = EscPosBuilder.label(label(barcode = "ABC123"), PaperWidth.MM80)
        // GS k 73 n '{' 'B' A B C ...   (n = 6 + 2 = 8)
        val i = indexOf(b, 0x1D, 0x6B, 0x49, 8, '{'.code, 'B'.code, 'A'.code, 'B'.code, 'C'.code)
        assertTrue("barcode command not found", i >= 0)
    }

    @Test fun braceInBarcodeIsEscaped() {
        val b = EscPosBuilder.label(label(barcode = "A{B"), PaperWidth.MM80)
        // data "A{{B" => n = 4 + 2 = 6
        assertTrue(indexOf(b, 0x1D, 0x6B, 0x49, 6, '{'.code, 'B'.code, 'A'.code, '{'.code, '{'.code, 'B'.code) >= 0)
    }

    @Test fun nonAsciiIsReplaced() {
        val t = text(EscPosBuilder.label(label(name = "Ñandú"), PaperWidth.MM80))
        assertTrue(t.contains("?and?"))
    }

    @Test fun longNameWrapsToPaperWidth() {
        val long = "BAUT HEXAGON GALVANIS TAHAN KOROSI UKURAN BESAR SEKALI 3/8 x 50 CEMET"
        val b = EscPosBuilder.label(label(name = long, barcode = "X"), PaperWidth.MM58)
        val runs = Regex("[ -~]+").findAll(text(b)).map { it.value.length }
        assertTrue("a printable run exceeds 32 chars", runs.all { it <= PaperWidth.MM58.chars })
    }

    @Test fun blankBarcodeSkipsBarcodeCommand() {
        val b = EscPosBuilder.label(label(barcode = "   "), PaperWidth.MM80)
        assertEquals(-1, indexOf(b, 0x1D, 0x6B, 0x49))
    }
}
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `./gradlew :app:testDebugUnitTest --tests "*EscPosBuilderTest"`
Expected: FAIL kompilasi `Unresolved reference: EscPosBuilder`.

- [ ] **Step 3: Implementasi**

```kotlin
package com.unison.stockopname.data.printer

import java.io.ByteArrayOutputStream

enum class PaperWidth(val chars: Int) { MM80(48), MM58(32) }

data class LabelData(
    val barcode: String,
    val itemName: String,
    val warehouseCode: String,
    val qty: Int,
    val operatorName: String,
    val printedAt: String,
    val pending: Boolean,
)

object EscPosBuilder {
    fun label(data: LabelData, paper: PaperWidth): ByteArray {
        val out = ByteArrayOutputStream()
        fun raw(vararg b: Int) = out.write(ByteArray(b.size) { b[it].toByte() })
        fun line(s: String) {
            out.write(ascii(s).toByteArray(Charsets.US_ASCII))
            raw(0x0A)
        }
        fun bold(on: Boolean) = raw(0x1B, 0x45, if (on) 1 else 0)

        raw(0x1B, 0x40)                 // ESC @ init
        raw(0x1B, 0x61, 0x01)           // center
        bold(true)
        line("PT UNISON INDUSTRIAL INDONESIA")
        if (data.pending) line("DRAFT - PENDING APPROVAL")
        bold(false)
        line("-".repeat(paper.chars))

        raw(0x1B, 0x61, 0x00)           // left
        wrap(data.itemName, paper.chars).forEach { line(it) }
        line("Gudang  : ${data.warehouseCode}")
        line("Qty     : ${data.qty}")
        line("Operator: ${data.operatorName}")
        line("Waktu   : ${data.printedAt}")

        val code = ascii(data.barcode).trim()
        if (code.isNotEmpty()) {
            val encoded = code.take(60).replace("{", "{{")
            raw(0x1B, 0x61, 0x01)       // center
            raw(0x1D, 0x68, 80)         // height
            raw(0x1D, 0x77, 2)          // width
            raw(0x1D, 0x48, 2)          // HRI below
            raw(0x1D, 0x6B, 0x49, encoded.length + 2, '{'.code, 'B'.code)
            out.write(encoded.toByteArray(Charsets.US_ASCII))
            raw(0x0A)
        }

        raw(0x1B, 0x64, 0x04)           // feed 4 lines
        raw(0x1D, 0x56, 0x42, 0x00)     // partial cut
        return out.toByteArray()
    }

    private fun ascii(s: String): String =
        s.map { if (it.code in 32..126) it else if (it == '\n' || it == '\r') ' ' else '?' }.joinToString("")

    private fun wrap(text: String, width: Int): List<String> {
        val words = ascii(text).trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
        val lines = mutableListOf<String>()
        var cur = StringBuilder()
        for (w in words) {
            var word = w
            while (word.length > width) {
                if (cur.isNotEmpty()) { lines += cur.toString(); cur = StringBuilder() }
                lines += word.take(width)
                word = word.drop(width)
            }
            if (cur.isEmpty()) cur.append(word)
            else if (cur.length + 1 + word.length <= width) cur.append(' ').append(word)
            else { lines += cur.toString(); cur = StringBuilder(word) }
        }
        if (cur.isNotEmpty()) lines += cur.toString()
        return lines
    }
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `./gradlew :app:testDebugUnitTest --tests "*EscPosBuilderTest"`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add android/app/src
git commit -m "feat(android): add ESC/POS label builder with DRAFT watermark and Code128 barcode"
```

---

### Task 5: PrinterClient (raw TCP 9100) dan seed printer

**Files:**
- Create: `android/app/src/main/java/com/unison/stockopname/data/printer/PrinterClient.kt`
- Create: `android/app/src/main/java/com/unison/stockopname/data/printer/PrinterSeeds.kt`
- Test: `android/app/src/test/java/com/unison/stockopname/data/printer/PrinterClientTest.kt`
- Test: `android/app/src/test/java/com/unison/stockopname/data/printer/PrinterSeedsTest.kt`

**Interfaces:**
- Produces:
  - `class PrinterClient(connectTimeoutMs: Int = 3000)` dengan `suspend fun send(host: String, port: Int, bytes: ByteArray): Result<Unit>`. Gagal menghasilkan `Result.failure(PrinterException(message))` berpesan Indonesia, tidak melempar.
  - `class PrinterException(message: String, cause: Throwable? = null) : Exception`
  - `data class PrinterSeed(val id: Long, val name: String, val host: String, val port: Int, val paper: PaperWidth)`
  - `object PrinterSeeds { val printers: List<PrinterSeed>; fun defaultPrinterIdFor(warehouseCode: String): Long }` (data dari Bab 3 dan Bab 6 panduan; semua LAN, tanpa Bluetooth).

- [ ] **Step 1: Tulis tes yang gagal**

`PrinterClientTest.kt`:
```kotlin
package com.unison.stockopname.data.printer

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.net.ServerSocket
import kotlin.concurrent.thread

class PrinterClientTest {
    @Test fun sendsExactBytesToSocket() = runBlocking {
        ServerSocket(0).use { server ->
            var received = ByteArray(0)
            val t = thread { server.accept().use { received = it.getInputStream().readBytes() } }

            val payload = byteArrayOf(0x1B, 0x40, 0x41, 0x0A)
            val result = PrinterClient().send("127.0.0.1", server.localPort, payload)
            t.join(3000)

            assertTrue(result.isSuccess)
            assertArrayEquals(payload, received)
        }
    }

    @Test fun unreachablePrinterFailsWithIndonesianMessage() = runBlocking {
        val closedPort = ServerSocket(0).use { it.localPort }
        val result = PrinterClient(connectTimeoutMs = 500).send("127.0.0.1", closedPort, byteArrayOf(1))

        assertTrue(result.isFailure)
        val ex = result.exceptionOrNull()
        assertTrue(ex is PrinterException)
        assertTrue(ex!!.message!!.contains("tidak terjangkau"))
    }

    @Test fun invalidPortFailsInsteadOfThrowing() = runBlocking {
        val result = PrinterClient().send("127.0.0.1", 70000, byteArrayOf(1))
        assertTrue(result.isFailure)
    }
}
```

`PrinterSeedsTest.kt`:
```kotlin
package com.unison.stockopname.data.printer

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PrinterSeedsTest {
    private fun ipOf(warehouse: String): String {
        val id = PrinterSeeds.defaultPrinterIdFor(warehouse)
        return PrinterSeeds.printers.first { it.id == id }.host
    }

    @Test fun fourLanPrintersOnPort9100() {
        assertEquals(4, PrinterSeeds.printers.size)
        assertTrue(PrinterSeeds.printers.all { it.port == 9100 })
        assertEquals(
            setOf("192.168.1.50", "192.168.1.140", "192.168.1.51", "192.168.1.52"),
            PrinterSeeds.printers.map { it.host }.toSet()
        )
    }

    @Test fun defaultsFollowPanduanBab6() {
        assertEquals("192.168.1.50", ipOf("U2 GUDANG1"))
        assertEquals("192.168.1.50", ipOf("U2 GUDANG2"))
        assertEquals("192.168.1.140", ipOf("U2 GUDANG3"))
        assertEquals("192.168.1.140", ipOf("U2 GUDANG4"))
        assertEquals("192.168.1.140", ipOf("U2 GUDANG5"))
        assertEquals("192.168.1.51", ipOf("U2 GUDANG6"))
        assertEquals("192.168.1.51", ipOf("U2 F29"))
        assertEquals("192.168.1.50", ipOf("U2 UCP"))
        assertEquals("192.168.1.51", ipOf("GUDANG JAYA"))
        assertEquals("192.168.1.51", ipOf("D30"))
        assertEquals("192.168.1.51", ipOf("U1"))
    }

    @Test fun lookupIsCaseInsensitiveAndUnknownFallsBackToOfficePrinter() {
        assertEquals("192.168.1.50", ipOf("u2 gudang1"))
        assertEquals("192.168.1.140", ipOf("GUDANG TIDAK ADA"))
    }
}
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `./gradlew :app:testDebugUnitTest --tests "*PrinterClientTest" --tests "*PrinterSeedsTest"`
Expected: FAIL kompilasi `Unresolved reference: PrinterClient`.

- [ ] **Step 3: Implementasi**

`PrinterClient.kt`:
```kotlin
package com.unison.stockopname.data.printer

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException
import java.net.InetSocketAddress
import java.net.Socket

class PrinterException(message: String, cause: Throwable? = null) : Exception(message, cause)

/** Kirim byte ESC/POS langsung ke printer LAN lewat raw TCP (Bab 3.2, tanpa hop server). */
class PrinterClient(private val connectTimeoutMs: Int = 3000) {
    suspend fun send(host: String, port: Int, bytes: ByteArray): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            Socket().use { socket ->
                socket.connect(InetSocketAddress(host, port), connectTimeoutMs)
                socket.getOutputStream().apply {
                    write(bytes)
                    flush()
                }
            }
            Result.success(Unit)
        } catch (e: IOException) {
            Result.failure(PrinterException("Printer $host:$port tidak terjangkau. Periksa WiFi dan IP printer.", e))
        } catch (e: IllegalArgumentException) {
            Result.failure(PrinterException("Alamat printer $host:$port tidak valid.", e))
        }
    }
}
```

`PrinterSeeds.kt`:
```kotlin
package com.unison.stockopname.data.printer

data class PrinterSeed(val id: Long, val name: String, val host: String, val port: Int, val paper: PaperWidth)

/** Printer LAN dari Bab 3 panduan dan printer default per gudang dari Bab 6. IP bisa diubah di pengaturan. */
object PrinterSeeds {
    val printers: List<PrinterSeed> = listOf(
        PrinterSeed(1, "Printer Meja Operator Depan Lorong", "192.168.1.50", 9100, PaperWidth.MM80),
        PrinterSeed(2, "Printer Meja Kantor Direksi & SPV", "192.168.1.140", 9100, PaperWidth.MM80),
        PrinterSeed(3, "Printer Meja Admin Gudang Jaya", "192.168.1.51", 9100, PaperWidth.MM80),
        PrinterSeed(4, "Printer Mobile Pinggang", "192.168.1.52", 9100, PaperWidth.MM58),
    )

    private const val OPERATOR_DESK = 1L
    private const val OFFICE = 2L
    private const val GUDANG_JAYA = 3L

    private val byWarehouse = mapOf(
        "U2 GUDANG1" to OPERATOR_DESK,
        "U2 GUDANG2" to OPERATOR_DESK,
        "U2 GUDANG3" to OFFICE,
        "U2 GUDANG4" to OFFICE,
        "U2 GUDANG5" to OFFICE,
        "U2 GUDANG6" to GUDANG_JAYA,
        "U2 F29" to GUDANG_JAYA,
        "U2 UCP" to OPERATOR_DESK,
        "GUDANG JAYA" to GUDANG_JAYA,
        "D30" to GUDANG_JAYA,
        "U1" to GUDANG_JAYA,
    )

    fun defaultPrinterIdFor(warehouseCode: String): Long =
        byWarehouse[warehouseCode.trim().uppercase()] ?: OFFICE
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `./gradlew :app:testDebugUnitTest --tests "*PrinterClientTest" --tests "*PrinterSeedsTest"`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add android/app/src
git commit -m "feat(android): add raw TCP 9100 printer client and LAN printer seeds per warehouse"
```

---

### Task 6: Database Room (entity, DAO, AppDatabase)

**Files:**
- Create: `android/app/src/main/java/com/unison/stockopname/data/db/Entities.kt`
- Create: `android/app/src/main/java/com/unison/stockopname/data/db/Daos.kt`
- Create: `android/app/src/main/java/com/unison/stockopname/data/db/AppDatabase.kt`
- Create: `android/app/src/test/java/com/unison/stockopname/TestSupport.kt`
- Test: `android/app/src/test/java/com/unison/stockopname/data/db/DaoTest.kt`

**Interfaces:**
- Produces (dipakai task 8-13):
  - Entity: `ItemEntity`, `WarehouseEntity`, `PrinterEntity`, `SessionEntity`, `CountEntity`, `ProposalEntity`, `AuditEntity`, `OutboxEntity`; konstanta `OutboxType {COUNT, PROPOSAL, AUDIT}`, `OutboxStatus {PENDING, SENT, FAILED}`, `ProposalStatus {PENDING, ACTIVE, REJECTED}` (string).
  - DAO lewat `AppDatabase`: `items()`, `warehouses()`, `printers()`, `sessions()`, `counts()`, `proposals()`, `audits()`, `outbox()`.
  - Tes: `newTestDb(): AppDatabase`, `InMemoryKeyValueStore`, `FakeSyncTrigger` di `TestSupport.kt`.
- `InMemoryKeyValueStore` bergantung pada `KeyValueStore` (Task 10). Untuk task ini `TestSupport.kt` cukup berisi `newTestDb`; dua kelas lain ditambahkan pada task yang membuatnya.

- [ ] **Step 1: Tulis tes yang gagal**

`TestSupport.kt`:
```kotlin
package com.unison.stockopname

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.unison.stockopname.data.db.AppDatabase

fun newTestDb(): AppDatabase =
    Room.inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext(), AppDatabase::class.java)
        .allowMainThreadQueries()
        .build()
```

`DaoTest.kt`:
```kotlin
package com.unison.stockopname.data.db

import com.unison.stockopname.newTestDb
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class DaoTest {
    private lateinit var db: AppDatabase

    @Before fun setUp() { db = newTestDb() }
    @After fun tearDown() { db.close() }

    private fun item(id: Long, code: String, wh: String? = "U2 GUDANG3") =
        ItemEntity(id, code, "BAUT $code", 100.0, "PCS", "KARUNG", 1000.0, wh)

    private fun outbox(uuid: String, type: String = OutboxType.COUNT) =
        OutboxEntity(type = type, clientUuid = uuid, payloadJson = "{}", createdAt = 1L)

    @Test fun itemUpsertReplacesAndFindsByCode() = runBlocking {
        db.items().upsertAll(listOf(item(1, "AB6C50"), item(2, "AB6102")))
        db.items().upsertAll(listOf(item(1, "AB6C50").copy(stock = 250.0)))
        assertEquals(2, db.items().count())
        assertEquals(250.0, db.items().findByCode("AB6C50")!!.stock, 0.0)
        assertNull(db.items().findByCode("TIDAK-ADA"))
    }

    @Test fun itemKeepsNullWarehouse() = runBlocking {
        db.items().upsertAll(listOf(item(3, "X1", wh = null)))
        assertNull(db.items().findByCode("X1")!!.warehouseCode)
    }

    @Test fun warehouseReplaceAllAndCaseInsensitiveLookup() = runBlocking {
        db.warehouses().replaceAll(listOf(WarehouseEntity("U2 GUDANG1", "Gudang 1", 0)))
        db.warehouses().replaceAll(listOf(WarehouseEntity("U2 GUDANG2", "Gudang 2", 0), WarehouseEntity("U1", "U1", 1)))
        assertEquals(listOf("U2 GUDANG2", "U1"), db.warehouses().all().map { it.code })
        assertNotNull(db.warehouses().findByCode("u2 gudang2"))
        assertNull(db.warehouses().findByCode("U2 GUDANG1"))
    }

    @Test fun openSessionIsFoundPerOperatorAndWarehouseUntilFinished() = runBlocking {
        db.sessions().insert(SessionEntity("s1", "kirana", "U2 GUDANG2", 10L, null))
        assertEquals("s1", db.sessions().findOpen("kirana", "U2 GUDANG2")!!.uuid)
        assertNull(db.sessions().findOpen("rangga", "U2 GUDANG2"))
        db.sessions().finish("s1", 99L)
        assertNull(db.sessions().findOpen("kirana", "U2 GUDANG2"))
    }

    @Test fun latestCountForItemInSessionIsMostRecent() = runBlocking {
        fun count(uuid: String, at: Long, qty: Int) = CountEntity(
            uuid, "s1", "U2 GUDANG2", "AB6C50", "BAUT", 100.0, qty, qty - 100.0, null, "", null, at, "kirana"
        )
        db.counts().insert(count("c1", 10L, 50))
        db.counts().insert(count("c2", 20L, 70))
        assertEquals("c2", db.counts().latestForItem("s1", "AB6C50")!!.uuid)
        assertNull(db.counts().latestForItem("s1", "LAIN"))
        assertNull(db.counts().latestForItem("s2", "AB6C50"))
    }

    @Test fun proposalFoundByBarcodeAndStatusUpdatable() = runBlocking {
        db.proposals().insert(
            ProposalEntity("p1", "s1", "899", "BAUT BARU", "Baut", 500, "U2 GUDANG2", "", "/x.jpg", "a".repeat(64),
                ProposalStatus.PENDING, null, 5L, "kirana")
        )
        assertEquals(ProposalStatus.PENDING, db.proposals().findByBarcode("899")!!.status)
        db.proposals().updateStatus("p1", ProposalStatus.REJECTED, "Foto blur")
        val p = db.proposals().findByBarcode("899")!!
        assertEquals(ProposalStatus.REJECTED, p.status)
        assertEquals("Foto blur", p.rejectionReason)
    }

    @Test fun outboxKeepsInsertOrderAndIgnoresDuplicateUuid() = runBlocking {
        db.outbox().insert(outbox("u1"))
        db.outbox().insert(outbox("u2", OutboxType.AUDIT))
        db.outbox().insert(outbox("u1")) // duplikat, diabaikan
        assertEquals(listOf("u1", "u2"), db.outbox().nextPending(10).map { it.clientUuid })
    }

    @Test fun outboxStatusTransitionsAndResetFailed() = runBlocking {
        db.outbox().insert(outbox("u1"))
        db.outbox().insert(outbox("u2"))
        val (a, b) = db.outbox().nextPending(10)
        db.outbox().update(a.copy(status = OutboxStatus.SENT))
        db.outbox().update(b.copy(status = OutboxStatus.FAILED, attempts = 5, lastError = "x"))
        assertEquals(0, db.outbox().nextPending(10).size)
        assertEquals(1, db.outbox().failed().size)
        db.outbox().resetFailed()
        val again = db.outbox().nextPending(10)
        assertEquals(listOf("u2"), again.map { it.clientUuid })
        assertEquals(0, again[0].attempts)
    }

    @Test fun printerSeedsAreStoredAndUpdatable() = runBlocking {
        db.printers().upsertAll(listOf(PrinterEntity(1, "Meja", "192.168.1.50", 9100, "MM80")))
        db.printers().update(db.printers().findById(1)!!.copy(host = "192.168.1.60"))
        assertEquals("192.168.1.60", db.printers().all().first().host)
    }
}
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `./gradlew :app:testDebugUnitTest --tests "*DaoTest"`
Expected: FAIL kompilasi `Unresolved reference: AppDatabase`.

- [ ] **Step 3: Implementasi entity**

`Entities.kt`:
```kotlin
package com.unison.stockopname.data.db

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

object OutboxType { const val COUNT = "COUNT"; const val PROPOSAL = "PROPOSAL"; const val AUDIT = "AUDIT" }
object OutboxStatus { const val PENDING = "PENDING"; const val SENT = "SENT"; const val FAILED = "FAILED" }
object ProposalStatus { const val PENDING = "pending"; const val ACTIVE = "active"; const val REJECTED = "rejected" }

@Entity(tableName = "item", indices = [Index("itemCode")])
data class ItemEntity(
    @PrimaryKey val id: Long,
    val itemCode: String,
    val itemName: String,
    val stock: Double,
    val unit: String?,
    val pack: String?,
    val isiPerPack: Double?,
    val warehouseCode: String?,
)

@Entity(tableName = "warehouse")
data class WarehouseEntity(@PrimaryKey val code: String, val name: String, val sortOrder: Int)

@Entity(tableName = "printer")
data class PrinterEntity(
    @PrimaryKey val id: Long,
    val name: String,
    val host: String,
    val port: Int,
    val paper: String, // nama enum PaperWidth
)

@Entity(tableName = "session")
data class SessionEntity(
    @PrimaryKey val uuid: String,
    val operator: String,
    val warehouseCode: String,
    val startedAt: Long,
    val finishedAt: Long?,
)

@Entity(tableName = "count_record", indices = [Index("sessionUuid", "itemCode")])
data class CountEntity(
    @PrimaryKey val uuid: String,
    val sessionUuid: String,
    val warehouseCode: String,
    val itemCode: String,
    val itemName: String,
    val qtySystem: Double,
    val qtyPhysical: Int,
    val variance: Double,
    val rackCode: String?,
    val note: String,
    val supersedesUuid: String?,
    val createdAtDevice: Long,
    val operator: String,
)

@Entity(tableName = "proposal", indices = [Index("barcode")])
data class ProposalEntity(
    @PrimaryKey val uuid: String,
    val sessionUuid: String,
    val barcode: String,
    val name: String,
    val category: String,
    val proposedQty: Int,
    val warehouseCode: String,
    val notes: String,
    val photoPath: String,
    val photoSha256: String,
    val status: String,
    val rejectionReason: String?,
    val createdAtDevice: Long,
    val operator: String,
)

@Entity(tableName = "audit_log")
data class AuditEntity(
    @PrimaryKey val uuid: String,
    val action: String,
    val entityType: String,
    val entityUuid: String?,
    val description: String,
    val detailJson: String?,
    val createdAtDevice: Long,
    val operator: String,
)

@Entity(tableName = "outbox", indices = [Index(value = ["clientUuid"], unique = true)])
data class OutboxEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val type: String,
    val clientUuid: String,
    val payloadJson: String,
    val status: String = OutboxStatus.PENDING,
    val attempts: Int = 0,
    val lastError: String? = null,
    val createdAt: Long,
)
```

- [ ] **Step 4: Implementasi DAO dan database**

`Daos.kt`:
```kotlin
package com.unison.stockopname.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface ItemDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun upsertAll(items: List<ItemEntity>)
    @Query("SELECT * FROM item WHERE itemCode = :code LIMIT 1") suspend fun findByCode(code: String): ItemEntity?
    @Query("SELECT COUNT(*) FROM item") suspend fun count(): Int
    @Query("DELETE FROM item") suspend fun clear()
}

@Dao
abstract class WarehouseDao {
    @Query("SELECT * FROM warehouse ORDER BY sortOrder") abstract suspend fun all(): List<WarehouseEntity>
    @Query("SELECT * FROM warehouse WHERE UPPER(code) = UPPER(:code) LIMIT 1")
    abstract suspend fun findByCode(code: String): WarehouseEntity?
    @Insert abstract suspend fun insertAll(list: List<WarehouseEntity>)
    @Query("DELETE FROM warehouse") abstract suspend fun deleteAll()

    @Transaction
    open suspend fun replaceAll(list: List<WarehouseEntity>) {
        deleteAll()
        insertAll(list)
    }
}

@Dao
interface PrinterDao {
    @Query("SELECT * FROM printer ORDER BY id") suspend fun all(): List<PrinterEntity>
    @Query("SELECT * FROM printer WHERE id = :id") suspend fun findById(id: Long): PrinterEntity?
    @Insert(onConflict = OnConflictStrategy.IGNORE) suspend fun upsertAll(list: List<PrinterEntity>)
    @Update suspend fun update(printer: PrinterEntity)
}

@Dao
interface SessionDao {
    @Insert suspend fun insert(session: SessionEntity)
    @Query(
        "SELECT * FROM session WHERE operator = :operator AND warehouseCode = :warehouse AND finishedAt IS NULL " +
            "ORDER BY startedAt DESC LIMIT 1"
    )
    suspend fun findOpen(operator: String, warehouse: String): SessionEntity?
    @Query("UPDATE session SET finishedAt = :at WHERE uuid = :uuid") suspend fun finish(uuid: String, at: Long)
}

@Dao
interface CountDao {
    @Insert suspend fun insert(count: CountEntity)
    @Query(
        "SELECT * FROM count_record WHERE sessionUuid = :sessionUuid AND itemCode = :itemCode " +
            "ORDER BY createdAtDevice DESC LIMIT 1"
    )
    suspend fun latestForItem(sessionUuid: String, itemCode: String): CountEntity?
}

@Dao
interface ProposalDao {
    @Insert suspend fun insert(proposal: ProposalEntity)
    @Query("SELECT * FROM proposal WHERE barcode = :barcode ORDER BY createdAtDevice DESC LIMIT 1")
    suspend fun findByBarcode(barcode: String): ProposalEntity?
    @Query("UPDATE proposal SET status = :status, rejectionReason = :reason WHERE uuid = :uuid")
    suspend fun updateStatus(uuid: String, status: String, reason: String?)
}

@Dao
interface AuditDao {
    @Insert suspend fun insert(audit: AuditEntity)
}

@Dao
interface OutboxDao {
    @Insert(onConflict = OnConflictStrategy.IGNORE) suspend fun insert(entry: OutboxEntity): Long
    @Query("SELECT * FROM outbox WHERE status = 'PENDING' ORDER BY id ASC LIMIT :limit")
    suspend fun nextPending(limit: Int): List<OutboxEntity>
    @Update suspend fun update(entry: OutboxEntity)
    @Query("SELECT COUNT(*) FROM outbox WHERE status = 'PENDING'") fun observePending(): Flow<Int>
    @Query("SELECT * FROM outbox WHERE status = 'FAILED' ORDER BY id") suspend fun failed(): List<OutboxEntity>
    @Query("UPDATE outbox SET status = 'PENDING', attempts = 0 WHERE status = 'FAILED'") suspend fun resetFailed()
    @Query("SELECT * FROM outbox ORDER BY id") suspend fun all(): List<OutboxEntity>
}
```

`AppDatabase.kt`:
```kotlin
package com.unison.stockopname.data.db

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
    entities = [
        ItemEntity::class, WarehouseEntity::class, PrinterEntity::class, SessionEntity::class,
        CountEntity::class, ProposalEntity::class, AuditEntity::class, OutboxEntity::class,
    ],
    version = 1,
    exportSchema = false,
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun items(): ItemDao
    abstract fun warehouses(): WarehouseDao
    abstract fun printers(): PrinterDao
    abstract fun sessions(): SessionDao
    abstract fun counts(): CountDao
    abstract fun proposals(): ProposalDao
    abstract fun audits(): AuditDao
    abstract fun outbox(): OutboxDao
}
```

- [ ] **Step 5: Jalankan, pastikan lulus**

Run: `./gradlew :app:testDebugUnitTest --tests "*DaoTest"`
Expected: PASS, 9 tests. (Run pertama mengunduh Robolectric android-all 34, butuh internet.)

- [ ] **Step 6: Commit**

```bash
git add android/app/src
git commit -m "feat(android): add Room entities, DAOs and database with outbox"
```

---

### Task 7: Klien API (model, ApiResult, Retrofit)

**Files:**
- Create: `android/app/src/main/java/com/unison/stockopname/data/api/Models.kt`
- Create: `android/app/src/main/java/com/unison/stockopname/data/api/ApiResult.kt`
- Create: `android/app/src/main/java/com/unison/stockopname/data/api/WmsApi.kt`
- Create: `android/app/src/main/java/com/unison/stockopname/data/api/ApiFactory.kt`
- Test: `android/app/src/test/java/com/unison/stockopname/data/api/ApiClientTest.kt`

**Interfaces:**
- Consumes: kontrak endpoint dari plan backend.
- Produces:
  - `ApiEnvelope<T>(success, data, message)`; DTO: `LoginRequest`, `LoginData`, `WarehouseDto`, `MasterItemDto`, `MasterPage`, `CountPayload`, `AuditPayload`, `ProposalPayload`, `DuplicateAck`, `ProposalStatusDto`.
  - `sealed class ApiResult<out T> { data class Ok<T>(val data: T); object AuthExpired; data class Failure(val message: String, val retryable: Boolean) }`
  - `suspend fun <T> apiCall(unauthorizedIsExpiry: Boolean = true, block: suspend () -> Response<ApiEnvelope<T>>): ApiResult<T>`
  - `fun <T> ApiResult<T>.asUnit(): ApiResult<Unit>`
  - `interface WmsApi` (metode di bawah), `ApiFactory.create(baseUrl: String, tokenProvider: () -> String?): WmsApi`

- [ ] **Step 1: Tulis tes yang gagal**

```kotlin
package com.unison.stockopname.data.api

import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class ApiClientTest {
    private lateinit var server: MockWebServer
    private var token: String? = "tok123"
    private lateinit var api: WmsApi

    @Before fun setUp() {
        server = MockWebServer().also { it.start() }
        api = ApiFactory.create(server.url("/stock/api/").toString()) { token }
    }

    @After fun tearDown() { server.shutdown() }

    private fun json(body: String, code: Int = 200) =
        MockResponse().setResponseCode(code).setHeader("Content-Type", "application/json").setBody(body)

    @Test fun loginParsesTokenAndSendsCredentialsWithoutAuthHeaderWhenNoToken() = runBlocking {
        token = null
        server.enqueue(json("""{"success":true,"data":{"token":"T","iduser":7,"username":"kirana","user_divisi":"Gudang","user_level":2}}"""))
        val r = apiCall(unauthorizedIsExpiry = false) { api.login(LoginRequest("kirana", "rahasia", "TC26")) }

        assertTrue(r is ApiResult.Ok)
        assertEquals("T", (r as ApiResult.Ok).data.token)
        assertEquals("Gudang", r.data.userDivisi)
        val req = server.takeRequest()
        assertEquals("/stock/api/login.php", req.path)
        assertEquals("POST", req.method)
        assertNull(req.getHeader("X-Auth-Token"))
        assertTrue(req.body.readUtf8().contains("\"username\":\"kirana\""))
    }

    @Test fun authenticatedCallsCarryTokenHeader() = runBlocking {
        server.enqueue(json("""{"success":true,"data":[{"code":"U2 GUDANG1","name":"Gudang 1"}]}"""))
        val r = apiCall { api.warehouses() }

        assertEquals("U2 GUDANG1", (r as ApiResult.Ok).data[0].code)
        assertEquals("tok123", server.takeRequest().getHeader("X-Auth-Token"))
    }

    @Test fun masterQueryParamsAndNullableFields() = runBlocking {
        server.enqueue(json(
            """{"success":true,"data":{"items":[{"id":1,"item_code":"AB6C50","item_name":"BAUT","stock":8500,
               "unit":"PCS","pack":"KARUNG","isi_per_pack":1000,"warehouse_code":null}],
               "next_after_id":1,"done":true,"server_time":"2026-09-19 10:00:00","supports_delta":false}}"""
        ))
        val r = apiCall { api.master(afterId = 0, limit = 2000, updatedSince = null) }

        val page = (r as ApiResult.Ok).data
        assertNull(page.items[0].warehouseCode)
        assertTrue(page.done)
        val path = server.takeRequest().path!!
        assertTrue(path.startsWith("/stock/api/master.php?"))
        assertTrue(path.contains("after_id=0") && path.contains("limit=2000"))
        assertFalse(path.contains("updated_since"))
    }

    @Test fun http401OnAuthCallMeansAuthExpired() = runBlocking {
        server.enqueue(json("""{"success":false,"message":"Token tidak valid."}""", 401))
        assertEquals(ApiResult.AuthExpired, apiCall { api.warehouses() })
    }

    @Test fun http401OnLoginIsPlainFailureWithServerMessage() = runBlocking {
        server.enqueue(json("""{"success":false,"message":"Username atau password salah."}""", 401))
        val r = apiCall(unauthorizedIsExpiry = false) { api.login(LoginRequest("a", "b", "d")) }
        assertEquals(ApiResult.Failure("Username atau password salah.", retryable = false), r)
    }

    @Test fun http503IsRetryable() = runBlocking {
        server.enqueue(json("""{"success":false,"message":"Tabel wms_counts belum dibuat."}""", 503))
        val r = apiCall { api.warehouses() } as ApiResult.Failure
        assertTrue(r.retryable)
        assertEquals("Tabel wms_counts belum dibuat.", r.message)
    }

    @Test fun http422IsNotRetryable() = runBlocking {
        server.enqueue(json("""{"success":false,"message":"qty_physical harus bilangan bulat >= 0"}""", 422))
        val r = apiCall { api.warehouses() } as ApiResult.Failure
        assertFalse(r.retryable)
    }

    @Test fun nonJsonErrorBodyFallsBackToHttpCodeMessage() = runBlocking {
        server.enqueue(MockResponse().setResponseCode(502).setBody("<html>Bad Gateway</html>"))
        val r = apiCall { api.warehouses() } as ApiResult.Failure
        assertTrue(r.retryable)
        assertTrue(r.message.contains("502"))
    }

    @Test fun networkDownIsRetryableFailure() = runBlocking {
        server.shutdown()
        val r = apiCall { api.warehouses() } as ApiResult.Failure
        assertTrue(r.retryable)
        assertTrue(r.message.contains("koneksi"))
    }

    @Test fun countPostSendsSnakeCaseJson() = runBlocking {
        server.enqueue(json("""{"success":true,"data":{"duplicate":false}}"""))
        val payload = CountPayload(
            clientUuid = "3f2b8c1e-5d4a-4c3b-9a1e-0123456789ab", sessionUuid = "4f2b8c1e-5d4a-4c3b-9a1e-0123456789ab",
            warehouseCode = "U2 GUDANG2", itemCode = "AB6C50", itemName = "BAUT", qtySystem = 100.0,
            qtyPhysical = 90, variance = -10.0, rackCode = null, note = "", supersedesUuid = null,
            createdAtDevice = "2026-09-19T10:00:00Z",
        )
        val r = apiCall { api.count(payload) }

        assertFalse((r as ApiResult.Ok).data.duplicate)
        val body = server.takeRequest().body.readUtf8()
        assertTrue(body.contains("\"client_uuid\":\"3f2b8c1e"))
        assertTrue(body.contains("\"qty_physical\":90"))
        assertTrue(body.contains("\"created_at_device\":\"2026-09-19T10:00:00Z\""))
    }

    @Test fun asUnitKeepsFailureAndDropsData() = runBlocking {
        server.enqueue(json("""{"success":true,"data":{"duplicate":true}}"""))
        assertEquals(ApiResult.Ok(Unit), apiCall { api.audit(AuditPayload("3f2b8c1e-5d4a-4c3b-9a1e-0123456789ab", "print", "printer_socket", null, "x", null, "2026-09-19T10:00:00Z")) }.asUnit())
    }
}
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `./gradlew :app:testDebugUnitTest --tests "*ApiClientTest"`
Expected: FAIL kompilasi `Unresolved reference: ApiFactory`.

- [ ] **Step 3: Implementasi model**

`Models.kt`:
```kotlin
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
```

- [ ] **Step 4: Implementasi ApiResult**

`ApiResult.kt`:
```kotlin
package com.unison.stockopname.data.api

import com.google.gson.Gson
import com.google.gson.JsonParseException
import retrofit2.Response
import java.io.IOException

sealed class ApiResult<out T> {
    data class Ok<T>(val data: T) : ApiResult<T>()
    object AuthExpired : ApiResult<Nothing>()
    data class Failure(val message: String, val retryable: Boolean) : ApiResult<Nothing>()
}

fun <T> ApiResult<T>.asUnit(): ApiResult<Unit> = when (this) {
    is ApiResult.Ok -> ApiResult.Ok(Unit)
    is ApiResult.AuthExpired -> ApiResult.AuthExpired
    is ApiResult.Failure -> this
}

private val gson = Gson()

/**
 * Bungkus satu panggilan Retrofit. 401 di endpoint terautentikasi = token kedaluwarsa;
 * di endpoint login (unauthorizedIsExpiry = false) itu hanya password salah.
 */
suspend fun <T> apiCall(
    unauthorizedIsExpiry: Boolean = true,
    block: suspend () -> Response<ApiEnvelope<T>>,
): ApiResult<T> = try {
    val r = block()
    if (r.isSuccessful) {
        val body = r.body()
        val data = body?.data
        if (body != null && body.success && data != null) ApiResult.Ok(data)
        else ApiResult.Failure(body?.message ?: "Respons server kosong.", retryable = false)
    } else {
        val message = errorMessage(r)
        when {
            r.code() == 401 && unauthorizedIsExpiry -> ApiResult.AuthExpired
            r.code() >= 500 -> ApiResult.Failure(message, retryable = true)
            else -> ApiResult.Failure(message, retryable = false)
        }
    }
} catch (e: IOException) {
    ApiResult.Failure("Tidak ada koneksi ke server.", retryable = true)
} catch (e: JsonParseException) {
    ApiResult.Failure("Respons server tidak valid.", retryable = false)
}

private fun errorMessage(r: Response<*>): String {
    val raw = try { r.errorBody()?.string() } catch (e: IOException) { null }
    val parsed = try { gson.fromJson(raw, ApiEnvelope::class.java)?.message } catch (e: JsonParseException) { null }
    return parsed?.takeIf { it.isNotBlank() } ?: "Server error (HTTP ${r.code()})."
}
```

- [ ] **Step 5: Implementasi Retrofit**

`WmsApi.kt`:
```kotlin
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
}
```

`ApiFactory.kt`:
```kotlin
package com.unison.stockopname.data.api

import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object ApiFactory {
    fun create(baseUrl: String, tokenProvider: () -> String?): WmsApi {
        val client = OkHttpClient.Builder()
            .connectTimeout(8, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .addInterceptor { chain ->
                val token = tokenProvider()
                val request = if (token != null) chain.request().newBuilder().header("X-Auth-Token", token).build()
                else chain.request()
                chain.proceed(request)
            }
            .build()
        return Retrofit.Builder()
            .baseUrl(baseUrl.trimEnd('/') + "/")
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(WmsApi::class.java)
    }
}
```

- [ ] **Step 6: Jalankan, pastikan lulus**

Run: `./gradlew :app:testDebugUnitTest --tests "*ApiClientTest"`
Expected: PASS, 11 tests.
Bila `networkDownIsRetryableFailure` gagal karena `shutdown()` dua kali di `tearDown`, MockWebServer 4.12 menoleransi shutdown ganda; jika tidak, bungkus `tearDown` dengan `try { } catch (_: IOException) {}`.

- [ ] **Step 7: Commit**

```bash
git add android/app/src
git commit -m "feat(android): add Retrofit API client, DTOs and ApiResult mapping"
```

---

### Task 8: Payloads, OutboxProcessor, ApiOutboxSender

**Files:**
- Create: `android/app/src/main/java/com/unison/stockopname/data/api/Payloads.kt`
- Create: `android/app/src/main/java/com/unison/stockopname/sync/SyncTrigger.kt`
- Create: `android/app/src/main/java/com/unison/stockopname/sync/OutboxProcessor.kt`
- Create: `android/app/src/main/java/com/unison/stockopname/sync/ApiOutboxSender.kt`
- Test: `.../data/api/PayloadsTest.kt`, `.../sync/OutboxProcessorTest.kt`, `.../sync/ApiOutboxSenderTest.kt`

**Interfaces:**
- Consumes: `OutboxDao`, `OutboxEntity`, `WmsApi`, `apiCall`, `asUnit`, DTO payload (Task 6-7).
- Produces:
  - `object Payloads { fun isoUtc(epochMs: Long): String; fun count(c: CountEntity): String; fun audit(a: AuditEntity): String; fun proposal(p: ProposalEntity): String; fun <T> parse(json: String, cls: Class<T>): T }`
  - `fun interface SyncTrigger { fun request() }`, `enum class SyncOutcome { DONE, RETRY, AUTH_EXPIRED }`
  - `interface OutboxSender { suspend fun send(entry: OutboxEntity): ApiResult<Unit> }`
  - `class OutboxProcessor(dao: OutboxDao, sender: OutboxSender, maxAttempts: Int = 5) { suspend fun runOnce(): SyncOutcome }`
  - `class ApiOutboxSender(api: WmsApi) : OutboxSender`

- [ ] **Step 1: Tulis tes yang gagal**

`PayloadsTest.kt`:
```kotlin
package com.unison.stockopname.data.api

import com.unison.stockopname.data.db.AuditEntity
import com.unison.stockopname.data.db.CountEntity
import com.unison.stockopname.data.db.ProposalEntity
import com.unison.stockopname.data.db.ProposalStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PayloadsTest {
    @Test fun isoUtcFormatsEpochMillis() {
        assertEquals("2026-09-19T10:00:00Z", Payloads.isoUtc(1789812000000L))
        assertEquals("2026-09-19T10:00:00.123Z", Payloads.isoUtc(1789812000123L))
    }

    @Test fun countPayloadUsesSnakeCaseAndOmitsNullRack() {
        val c = CountEntity("c1", "s1", "U2 GUDANG2", "AB6C50", "BAUT", 100.0, 90, -10.0, null, "ok", null, 1789812000000L, "kirana")
        val json = Payloads.count(c)
        assertTrue(json.contains("\"client_uuid\":\"c1\""))
        assertTrue(json.contains("\"created_at_device\":\"2026-09-19T10:00:00Z\""))
        assertFalse(json.contains("rack_code"))
        assertEquals(90, Payloads.parse(json, CountPayload::class.java).qtyPhysical)
    }

    @Test fun auditPayloadRoundTrips() {
        val a = AuditEntity("a1", "print", "printer_socket", null, "cetak label", "{\"ip\":\"192.168.1.50\"}", 1789812000000L, "kirana")
        val p = Payloads.parse(Payloads.audit(a), AuditPayload::class.java)
        assertEquals("print", p.action)
        assertEquals("{\"ip\":\"192.168.1.50\"}", p.detailJson)
    }

    @Test fun proposalPayloadKeepsPhotoPathForLocalUse() {
        val p = ProposalEntity("p1", "s1", "899", "BAUT BARU", "Baut", 500, "U2 GUDANG2", "", "/data/photos/p1.jpg",
            "a".repeat(64), ProposalStatus.PENDING, null, 1789812000000L, "kirana")
        val parsed = Payloads.parse(Payloads.proposal(p), ProposalPayload::class.java)
        assertEquals("/data/photos/p1.jpg", parsed.photoPath)
        assertEquals("a".repeat(64), parsed.photoSha256)
        assertEquals(500, parsed.proposedQty)
    }
}
```

`OutboxProcessorTest.kt`:
```kotlin
package com.unison.stockopname.sync

import com.unison.stockopname.data.api.ApiResult
import com.unison.stockopname.data.db.AppDatabase
import com.unison.stockopname.data.db.OutboxEntity
import com.unison.stockopname.data.db.OutboxStatus
import com.unison.stockopname.newTestDb
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

private class FakeSender(private val script: (OutboxEntity) -> ApiResult<Unit>) : OutboxSender {
    val sent = mutableListOf<String>()
    override suspend fun send(entry: OutboxEntity): ApiResult<Unit> {
        sent += entry.clientUuid
        return script(entry)
    }
}

@RunWith(RobolectricTestRunner::class)
class OutboxProcessorTest {
    private lateinit var db: AppDatabase

    @Before fun setUp() { db = newTestDb() }
    @After fun tearDown() { db.close() }

    private suspend fun add(uuid: String, attempts: Int = 0) {
        db.outbox().insert(OutboxEntity(type = "COUNT", clientUuid = uuid, payloadJson = "{}", attempts = attempts, createdAt = 1L))
    }

    private suspend fun byUuid() = db.outbox().all().associateBy { it.clientUuid }

    @Test fun emptyOutboxIsDone() = runBlocking {
        assertEquals(SyncOutcome.DONE, OutboxProcessor(db.outbox(), FakeSender { ApiResult.Ok(Unit) }).runOnce())
    }

    @Test fun allSentInOrderMarksSent() = runBlocking {
        add("u1"); add("u2"); add("u3")
        val sender = FakeSender { ApiResult.Ok(Unit) }
        assertEquals(SyncOutcome.DONE, OutboxProcessor(db.outbox(), sender).runOnce())
        assertEquals(listOf("u1", "u2", "u3"), sender.sent)
        assertEquals(setOf(OutboxStatus.SENT), db.outbox().all().map { it.status }.toSet())
    }

    @Test fun retryableFailureStopsAndLeavesRestUntouched() = runBlocking {
        add("u1"); add("u2"); add("u3")
        val sender = FakeSender { if (it.clientUuid == "u2") ApiResult.Failure("Tidak ada koneksi", true) else ApiResult.Ok(Unit) }
        assertEquals(SyncOutcome.RETRY, OutboxProcessor(db.outbox(), sender).runOnce())

        assertEquals(listOf("u1", "u2"), sender.sent)
        val m = byUuid()
        assertEquals(OutboxStatus.SENT, m["u1"]!!.status)
        assertEquals(OutboxStatus.PENDING, m["u2"]!!.status)
        assertEquals(1, m["u2"]!!.attempts)
        assertEquals("Tidak ada koneksi", m["u2"]!!.lastError)
        assertEquals(0, m["u3"]!!.attempts)
    }

    @Test fun nonRetryableFailureMarksFailedAndContinues() = runBlocking {
        add("u1"); add("u2")
        val sender = FakeSender { if (it.clientUuid == "u1") ApiResult.Failure("qty_physical tidak valid", false) else ApiResult.Ok(Unit) }
        assertEquals(SyncOutcome.DONE, OutboxProcessor(db.outbox(), sender).runOnce())

        val m = byUuid()
        assertEquals(OutboxStatus.FAILED, m["u1"]!!.status)
        assertEquals("qty_physical tidak valid", m["u1"]!!.lastError)
        assertEquals(OutboxStatus.SENT, m["u2"]!!.status)
    }

    @Test fun authExpiredStopsWithoutChangingAnything() = runBlocking {
        add("u1"); add("u2")
        val sender = FakeSender { ApiResult.AuthExpired }
        assertEquals(SyncOutcome.AUTH_EXPIRED, OutboxProcessor(db.outbox(), sender).runOnce())
        assertEquals(listOf("u1"), sender.sent)
        assertEquals(setOf(OutboxStatus.PENDING), db.outbox().all().map { it.status }.toSet())
        assertEquals(0, byUuid()["u1"]!!.attempts)
    }

    @Test fun fifthRetryableFailureBecomesFailed() = runBlocking {
        add("u1", attempts = 4)
        val sender = FakeSender { ApiResult.Failure("Server error (HTTP 503).", true) }
        assertEquals(SyncOutcome.DONE, OutboxProcessor(db.outbox(), sender, maxAttempts = 5).runOnce())
        val e = byUuid()["u1"]!!
        assertEquals(OutboxStatus.FAILED, e.status)
        assertEquals(5, e.attempts)
    }
}
```

`ApiOutboxSenderTest.kt`:
```kotlin
package com.unison.stockopname.sync

import com.unison.stockopname.data.api.ApiFactory
import com.unison.stockopname.data.api.ApiResult
import com.unison.stockopname.data.api.Payloads
import com.unison.stockopname.data.db.AuditEntity
import com.unison.stockopname.data.db.CountEntity
import com.unison.stockopname.data.db.OutboxEntity
import com.unison.stockopname.data.db.OutboxType
import com.unison.stockopname.data.db.ProposalEntity
import com.unison.stockopname.data.db.ProposalStatus
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class ApiOutboxSenderTest {
    @get:Rule val tmp = TemporaryFolder()
    private lateinit var server: MockWebServer
    private lateinit var sender: ApiOutboxSender

    @Before fun setUp() {
        server = MockWebServer().also { it.start() }
        sender = ApiOutboxSender(ApiFactory.create(server.url("/stock/api/").toString()) { "tok" })
    }

    @After fun tearDown() { server.shutdown() }

    private fun ok(duplicate: Boolean = false) = MockResponse().setHeader("Content-Type", "application/json")
        .setBody("""{"success":true,"data":{"duplicate":$duplicate}}""")

    private fun entry(type: String, payload: String) =
        OutboxEntity(id = 1, type = type, clientUuid = "x", payloadJson = payload, createdAt = 1L)

    @Test fun countGoesToCountEndpoint() = runBlocking {
        server.enqueue(ok())
        val c = CountEntity("c1", "s1", "U2 GUDANG2", "AB6C50", "BAUT", 100.0, 90, -10.0, null, "", null, 1L, "kirana")
        assertEquals(ApiResult.Ok(Unit), sender.send(entry(OutboxType.COUNT, Payloads.count(c))))
        assertEquals("/stock/api/count.php", server.takeRequest().path)
    }

    @Test fun auditGoesToAuditEndpointAndDuplicateCountsAsOk() = runBlocking {
        server.enqueue(ok(duplicate = true))
        val a = AuditEntity("a1", "print", "printer_socket", null, "cetak", null, 1L, "kirana")
        assertEquals(ApiResult.Ok(Unit), sender.send(entry(OutboxType.AUDIT, Payloads.audit(a))))
        assertEquals("/stock/api/audit.php", server.takeRequest().path)
    }

    @Test fun proposalSendsMultipartWithPhotoFile() = runBlocking {
        server.enqueue(ok())
        val photo = tmp.newFile("p1.jpg").apply { writeBytes(byteArrayOf(1, 2, 3, 4)) }
        val p = ProposalEntity("p1", "s1", "899", "BAUT BARU", "Baut", 500, "U2 GUDANG2", "", photo.absolutePath,
            "a".repeat(64), ProposalStatus.PENDING, null, 1L, "kirana")

        assertEquals(ApiResult.Ok(Unit), sender.send(entry(OutboxType.PROPOSAL, Payloads.proposal(p))))

        val req = server.takeRequest()
        assertEquals("/stock/api/proposal.php", req.path)
        assertTrue(req.getHeader("Content-Type")!!.startsWith("multipart/form-data"))
        val body = req.body.readUtf8()
        assertTrue(body.contains("name=\"client_uuid\""))
        assertTrue(body.contains("name=\"photo_sha256\""))
        assertTrue(body.contains("name=\"photo\"; filename=\"p1.jpg\""))
        assertFalse("photo_path must not be sent", body.contains("photo_path"))
    }

    @Test fun missingPhotoFileIsPermanentFailure() = runBlocking {
        val p = ProposalEntity("p1", "s1", "899", "BAUT", "Baut", 1, "U2 GUDANG2", "", "/tidak/ada.jpg",
            "a".repeat(64), ProposalStatus.PENDING, null, 1L, "kirana")
        val r = sender.send(entry(OutboxType.PROPOSAL, Payloads.proposal(p))) as ApiResult.Failure
        assertFalse(r.retryable)
        assertTrue(r.message.contains("foto"))
    }

    @Test fun unknownTypeIsPermanentFailure() = runBlocking {
        val r = sender.send(entry("BEDA", "{}")) as ApiResult.Failure
        assertFalse(r.retryable)
    }
}
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `./gradlew :app:testDebugUnitTest --tests "*PayloadsTest" --tests "*OutboxProcessorTest" --tests "*ApiOutboxSenderTest"`
Expected: FAIL kompilasi `Unresolved reference: Payloads`.

- [ ] **Step 3: Implementasi**

`Payloads.kt`:
```kotlin
package com.unison.stockopname.data.api

import com.google.gson.Gson
import com.unison.stockopname.data.db.AuditEntity
import com.unison.stockopname.data.db.CountEntity
import com.unison.stockopname.data.db.ProposalEntity
import java.time.Instant

object Payloads {
    private val gson = Gson()

    fun isoUtc(epochMs: Long): String = Instant.ofEpochMilli(epochMs).toString()

    fun count(c: CountEntity): String = gson.toJson(
        CountPayload(
            clientUuid = c.uuid, sessionUuid = c.sessionUuid, warehouseCode = c.warehouseCode,
            itemCode = c.itemCode, itemName = c.itemName, qtySystem = c.qtySystem,
            qtyPhysical = c.qtyPhysical, variance = c.variance, rackCode = c.rackCode, note = c.note,
            supersedesUuid = c.supersedesUuid, createdAtDevice = isoUtc(c.createdAtDevice),
        )
    )

    fun audit(a: AuditEntity): String = gson.toJson(
        AuditPayload(
            clientUuid = a.uuid, action = a.action, entityType = a.entityType, entityUuid = a.entityUuid,
            description = a.description, detailJson = a.detailJson, createdAtDevice = isoUtc(a.createdAtDevice),
        )
    )

    fun proposal(p: ProposalEntity): String = gson.toJson(
        ProposalPayload(
            clientUuid = p.uuid, sessionUuid = p.sessionUuid, barcode = p.barcode, name = p.name,
            category = p.category, proposedQty = p.proposedQty, warehouseCode = p.warehouseCode,
            notes = p.notes, createdAtDevice = isoUtc(p.createdAtDevice), photoSha256 = p.photoSha256,
            photoPath = p.photoPath,
        )
    )

    fun <T> parse(json: String, cls: Class<T>): T = gson.fromJson(json, cls)
}
```

`SyncTrigger.kt`:
```kotlin
package com.unison.stockopname.sync

/** Minta sinkronisasi outbox dijalankan (WorkManager di produksi, palsu di tes). */
fun interface SyncTrigger {
    fun request()
}

enum class SyncOutcome { DONE, RETRY, AUTH_EXPIRED }
```

`OutboxProcessor.kt`:
```kotlin
package com.unison.stockopname.sync

import com.unison.stockopname.data.api.ApiResult
import com.unison.stockopname.data.db.OutboxDao
import com.unison.stockopname.data.db.OutboxEntity
import com.unison.stockopname.data.db.OutboxStatus

interface OutboxSender {
    suspend fun send(entry: OutboxEntity): ApiResult<Unit>
}

/**
 * Kirim outbox berurutan (id naik). Gagal sementara (jaringan/5xx): berhenti supaya tidak menghajar server,
 * attempts naik, jadi FAILED setelah [maxAttempts]. Gagal permanen (4xx): FAILED, lanjut ke entri berikutnya.
 * 401: berhenti tanpa mengubah apa pun.
 */
class OutboxProcessor(
    private val dao: OutboxDao,
    private val sender: OutboxSender,
    private val maxAttempts: Int = 5,
) {
    suspend fun runOnce(): SyncOutcome {
        while (true) {
            val batch = dao.nextPending(BATCH)
            if (batch.isEmpty()) return SyncOutcome.DONE
            for (entry in batch) {
                when (val result = sender.send(entry)) {
                    is ApiResult.Ok -> dao.update(entry.copy(status = OutboxStatus.SENT, lastError = null))
                    is ApiResult.AuthExpired -> return SyncOutcome.AUTH_EXPIRED
                    is ApiResult.Failure -> {
                        val attempts = entry.attempts + 1
                        if (!result.retryable || attempts >= maxAttempts) {
                            dao.update(entry.copy(status = OutboxStatus.FAILED, attempts = attempts, lastError = result.message))
                        } else {
                            dao.update(entry.copy(attempts = attempts, lastError = result.message))
                            return SyncOutcome.RETRY
                        }
                    }
                }
            }
        }
    }

    private companion object { const val BATCH = 50 }
}
```

`ApiOutboxSender.kt`:
```kotlin
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
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `./gradlew :app:testDebugUnitTest --tests "*PayloadsTest" --tests "*OutboxProcessorTest" --tests "*ApiOutboxSenderTest"`
Expected: PASS, 15 tests (4 + 6 + 5).

- [ ] **Step 5: Commit**

```bash
git add android/app/src
git commit -m "feat(android): add outbox processor, API sender and payload builders"
```

---

### Task 9: Service tulis (audit, sesi gudang, scan, hitung, proposal)

**Files:**
- Modify: `android/app/src/main/java/com/unison/stockopname/data/db/Daos.kt` (tambah `SessionDao.finishOthers`)
- Modify: `android/app/src/test/java/com/unison/stockopname/TestSupport.kt` (tambah `FakeSyncTrigger`, `seqUuid`)
- Create: `android/app/src/main/java/com/unison/stockopname/data/repo/{AuditWriter,SessionService,ScanService,CountService,ProposalService}.kt`
- Test: `.../data/repo/{SessionServiceTest,ScanServiceTest,CountServiceTest,ProposalServiceTest}.kt`

**Interfaces:**
- Consumes: DAO/entity (Task 6), `Payloads`, `SyncTrigger` (Task 8), aturan domain (Task 2-3).
- Produces:
  - `class AuditWriter(db, clock: () -> Long = System::currentTimeMillis, newUuid: () -> String = { UUID.randomUUID().toString() }) { suspend fun record(operator: String, action: String, entityType: String, entityUuid: String?, description: String, detailJson: String? = null) }`
  - `sealed class LockResult { data class Locked(val session: SessionEntity, val warehouse: WarehouseEntity, val created: Boolean); data class UnknownWarehouse(val scanned: String) }`
  - `class SessionService(db, audit: AuditWriter, clock, newUuid) { suspend fun lock(operator: String, scannedCode: String): LockResult }`
  - `sealed class ScanOutcome { Found(item, misplacement: Misplacement?); Pending(proposal); Rejected(proposal); NotFound(barcode) }`, `data class ScanResult(val parsed: ParsedBarcode, val outcome: ScanOutcome)`, `class ScanService(db) { suspend fun lookup(raw: String, sessionWarehouse: String): ScanResult? }`
  - `sealed class SaveCountResult { Saved(record: CountEntity); NeedsResolution(existing: CountEntity) }`, `class CountService(db, sync: SyncTrigger, audit: AuditWriter, clock, newUuid) { suspend fun save(session: SessionEntity, item: ItemEntity, qty: Int, rackCode: String?, note: String, action: DuplicateAction?): SaveCountResult }`
  - `class ProposalService(db, sync: SyncTrigger, audit: AuditWriter, clock, newUuid) { suspend fun create(session: SessionEntity, barcode: String, name: String, category: String, proposedQty: Int, notes: String, photo: File): ProposalEntity }`
  - `object Hashing { fun sha256Hex(file: File): String }`

- [ ] **Step 1: Tambah `finishOthers` ke `SessionDao`** (satu sesi aktif per operator)

Di `Daos.kt`, dalam `interface SessionDao` tambah:
```kotlin
    @Query(
        "UPDATE session SET finishedAt = :at WHERE operator = :operator AND finishedAt IS NULL " +
            "AND warehouseCode <> :keepWarehouse"
    )
    suspend fun finishOthers(operator: String, keepWarehouse: String, at: Long)
```

- [ ] **Step 2: Tambah helper tes**

Di `TestSupport.kt` tambah (import `com.unison.stockopname.sync.SyncTrigger`, `com.unison.stockopname.data.db.*`):
```kotlin
class FakeSyncTrigger : SyncTrigger {
    var calls = 0
    override fun request() { calls++ }
}

/** Generator UUID deterministik: uuid-1, uuid-2, ... */
fun seqUuid(prefix: String = "uuid"): () -> String {
    var n = 0
    return { "$prefix-${++n}" }
}

fun testSession(operator: String = "kirana", warehouse: String = "U2 GUDANG2") =
    SessionEntity("sess-1", operator, warehouse, 1L, null)

fun testItem(code: String = "AB6C50", stock: Double = 100.0, warehouse: String? = "U2 GUDANG2") =
    ItemEntity(1, code, "BAUT $code", stock, "PCS", "KARUNG", 1000.0, warehouse)
```

- [ ] **Step 3: Tulis tes yang gagal**

`SessionServiceTest.kt`:
```kotlin
package com.unison.stockopname.data.repo

import com.unison.stockopname.data.db.AppDatabase
import com.unison.stockopname.data.db.OutboxType
import com.unison.stockopname.data.db.WarehouseEntity
import com.unison.stockopname.newTestDb
import com.unison.stockopname.seqUuid
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class SessionServiceTest {
    private lateinit var db: AppDatabase
    private lateinit var service: SessionService

    @Before fun setUp() {
        db = newTestDb()
        val uuid = seqUuid()
        service = SessionService(db, AuditWriter(db, { 100L }, uuid), { 100L }, uuid)
        runBlocking {
            db.warehouses().replaceAll(listOf(WarehouseEntity("U2 GUDANG1", "G1", 0), WarehouseEntity("U2 GUDANG2", "G2", 1)))
        }
    }

    @After fun tearDown() { db.close() }

    @Test fun scanningKnownWarehouseCreatesSessionAndAudit() = runBlocking {
        val r = service.lock("kirana", "u2 gudang2") as LockResult.Locked
        assertTrue(r.created)
        assertEquals("U2 GUDANG2", r.session.warehouseCode)
        assertEquals("kirana", r.session.operator)
        assertEquals(listOf(OutboxType.AUDIT), db.outbox().all().map { it.type })
    }

    @Test fun lockingSameWarehouseAgainReusesSession() = runBlocking {
        val first = service.lock("kirana", "U2 GUDANG2") as LockResult.Locked
        val second = service.lock("kirana", "U2 GUDANG2") as LockResult.Locked
        assertFalse(second.created)
        assertEquals(first.session.uuid, second.session.uuid)
        assertEquals(1, db.outbox().all().size)
    }

    @Test fun lockingAnotherWarehouseFinishesPreviousSession() = runBlocking {
        service.lock("kirana", "U2 GUDANG1")
        service.lock("kirana", "U2 GUDANG2")
        assertNull(db.sessions().findOpen("kirana", "U2 GUDANG1"))
        assertEquals("U2 GUDANG2", db.sessions().findOpen("kirana", "U2 GUDANG2")!!.warehouseCode)
    }

    @Test fun unknownWarehouseIsRejected() = runBlocking {
        assertEquals(LockResult.UnknownWarehouse("XYZ"), service.lock("kirana", "XYZ"))
        assertEquals(0, db.outbox().all().size)
    }
}
```

`ScanServiceTest.kt`:
```kotlin
package com.unison.stockopname.data.repo

import com.unison.stockopname.data.db.AppDatabase
import com.unison.stockopname.data.db.ProposalEntity
import com.unison.stockopname.data.db.ProposalStatus
import com.unison.stockopname.newTestDb
import com.unison.stockopname.testItem
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

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
}
```

`CountServiceTest.kt`:
```kotlin
package com.unison.stockopname.data.repo

import com.unison.stockopname.data.db.AppDatabase
import com.unison.stockopname.data.db.OutboxType
import com.unison.stockopname.domain.DuplicateAction
import com.unison.stockopname.FakeSyncTrigger
import com.unison.stockopname.newTestDb
import com.unison.stockopname.seqUuid
import com.unison.stockopname.testItem
import com.unison.stockopname.testSession
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class CountServiceTest {
    private lateinit var db: AppDatabase
    private lateinit var sync: FakeSyncTrigger
    private lateinit var service: CountService
    private var now = 1000L

    @Before fun setUp() {
        db = newTestDb()
        sync = FakeSyncTrigger()
        val uuid = seqUuid()
        val clock = { now++ }
        service = CountService(db, sync, AuditWriter(db, clock, uuid), clock, uuid)
    }

    @After fun tearDown() { db.close() }

    private val session = testSession()
    private val item = testItem("AB6C50", stock = 100.0)

    @Test fun firstSaveRecordsVarianceAndQueuesCountAndAudit() = runBlocking {
        val saved = service.save(session, item, 90, null, "  ok  ", null) as SaveCountResult.Saved

        assertEquals(90, saved.record.qtyPhysical)
        assertEquals(-10.0, saved.record.variance, 0.0001)
        assertEquals("ok", saved.record.note)
        assertEquals("U2 GUDANG2", saved.record.warehouseCode)
        assertNull(saved.record.supersedesUuid)
        assertEquals(listOf(OutboxType.COUNT, OutboxType.AUDIT), db.outbox().all().map { it.type })
        assertEquals(1, sync.calls)
    }

    @Test fun secondSaveWithoutActionAsksForResolutionAndWritesNothing() = runBlocking {
        service.save(session, item, 90, null, "", null)
        val r = service.save(session, item, 10, null, "", null)

        assertEquals(90, (r as SaveCountResult.NeedsResolution).existing.qtyPhysical)
        assertEquals(2, db.outbox().all().size)
        assertEquals(1, sync.calls)
    }

    @Test fun overwriteReplacesQtyAndLinksSupersedes() = runBlocking {
        val first = (service.save(session, item, 90, null, "", null) as SaveCountResult.Saved).record
        val second = (service.save(session, item, 40, null, "", DuplicateAction.OVERWRITE) as SaveCountResult.Saved).record

        assertEquals(40, second.qtyPhysical)
        assertEquals(-60.0, second.variance, 0.0001)
        assertEquals(first.uuid, second.supersedesUuid)
    }

    @Test fun addSumsWithPreviousCount() = runBlocking {
        service.save(session, item, 90, null, "", null)
        val second = (service.save(session, item, 40, null, "", DuplicateAction.ADD) as SaveCountResult.Saved).record
        assertEquals(130, second.qtyPhysical)
        assertEquals(30.0, second.variance, 0.0001)
    }

    @Test fun blankRackBecomesNullAndRealRackIsKept() = runBlocking {
        val a = (service.save(session, item, 1, "   ", "", null) as SaveCountResult.Saved).record
        assertNull(a.rackCode)
        val other = testItem("AB6102")
        val b = (service.save(session, other, 1, " RAK-B-03 ", "", null) as SaveCountResult.Saved).record
        assertEquals("RAK-B-03", b.rackCode)
    }

    @Test fun negativeQtyIsRejected() {
        assertThrows(IllegalArgumentException::class.java) {
            runBlocking { service.save(session, item, -1, null, "", null) }
        }
    }
}
```

`ProposalServiceTest.kt`:
```kotlin
package com.unison.stockopname.data.repo

import com.unison.stockopname.FakeSyncTrigger
import com.unison.stockopname.data.db.AppDatabase
import com.unison.stockopname.data.db.OutboxType
import com.unison.stockopname.data.db.ProposalStatus
import com.unison.stockopname.newTestDb
import com.unison.stockopname.seqUuid
import com.unison.stockopname.testSession
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.File

@RunWith(RobolectricTestRunner::class)
class ProposalServiceTest {
    @get:Rule val tmp = TemporaryFolder()
    private lateinit var db: AppDatabase
    private lateinit var sync: FakeSyncTrigger
    private lateinit var service: ProposalService

    @Before fun setUp() {
        db = newTestDb()
        sync = FakeSyncTrigger()
        val uuid = seqUuid()
        service = ProposalService(db, sync, AuditWriter(db, { 5L }, uuid), { 5L }, uuid)
    }

    @After fun tearDown() { db.close() }

    private fun photo(content: String = "abc"): File = tmp.newFile().apply { writeText(content) }

    @Test fun createsPendingProposalWithPhotoHashAndQueuesIt() = runBlocking {
        val p = service.create(testSession(), " 8992001001999 ", " BAUT BARU ", "Baut", 500, "temuan", photo("abc"))

        assertEquals(ProposalStatus.PENDING, p.status)
        assertEquals("8992001001999", p.barcode)
        assertEquals("BAUT BARU", p.name)
        assertEquals("U2 GUDANG2", p.warehouseCode)
        assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", p.photoSha256)
        assertEquals(p.uuid, db.proposals().findByBarcode("8992001001999")!!.uuid)
        assertEquals(listOf(OutboxType.PROPOSAL, OutboxType.AUDIT), db.outbox().all().map { it.type })
        assertEquals(1, sync.calls)
    }

    @Test fun photoIsMandatory() {
        val missing = File(tmp.root, "tidak-ada.jpg")
        assertThrows(IllegalArgumentException::class.java) {
            runBlocking { service.create(testSession(), "1", "BAUT", "Baut", 1, "", missing) }
        }
        assertEquals(0, runBlocking { db.outbox().all().size })
    }

    @Test fun emptyPhotoFileIsRejected() {
        assertThrows(IllegalArgumentException::class.java) {
            runBlocking { service.create(testSession(), "1", "BAUT", "Baut", 1, "", photo("")) }
        }
    }

    @Test fun blankNameIsRejected() {
        assertThrows(IllegalArgumentException::class.java) {
            runBlocking { service.create(testSession(), "1", "   ", "Baut", 1, "", photo()) }
        }
    }
}
```

- [ ] **Step 4: Jalankan, pastikan gagal**

Run: `./gradlew :app:testDebugUnitTest --tests "*SessionServiceTest" --tests "*ScanServiceTest" --tests "*CountServiceTest" --tests "*ProposalServiceTest"`
Expected: FAIL kompilasi `Unresolved reference: AuditWriter`.

- [ ] **Step 5: Implementasi**

`AuditWriter.kt`:
```kotlin
package com.unison.stockopname.data.repo

import com.unison.stockopname.data.api.Payloads
import com.unison.stockopname.data.db.AppDatabase
import com.unison.stockopname.data.db.AuditEntity
import com.unison.stockopname.data.db.OutboxEntity
import com.unison.stockopname.data.db.OutboxType
import java.util.UUID

/** Catat audit lokal + antrikan ke outbox. Panggil di dalam transaksi pemanggil bila perlu atomik. */
class AuditWriter(
    private val db: AppDatabase,
    private val clock: () -> Long = System::currentTimeMillis,
    private val newUuid: () -> String = { UUID.randomUUID().toString() },
) {
    suspend fun record(
        operator: String,
        action: String,
        entityType: String,
        entityUuid: String?,
        description: String,
        detailJson: String? = null,
    ) {
        val audit = AuditEntity(newUuid(), action, entityType, entityUuid, description, detailJson, clock(), operator)
        db.audits().insert(audit)
        db.outbox().insert(
            OutboxEntity(
                type = OutboxType.AUDIT, clientUuid = audit.uuid,
                payloadJson = Payloads.audit(audit), createdAt = clock(),
            )
        )
    }
}
```

`SessionService.kt`:
```kotlin
package com.unison.stockopname.data.repo

import androidx.room.withTransaction
import com.unison.stockopname.data.db.AppDatabase
import com.unison.stockopname.data.db.SessionEntity
import com.unison.stockopname.data.db.WarehouseEntity
import java.util.UUID

sealed class LockResult {
    data class Locked(val session: SessionEntity, val warehouse: WarehouseEntity, val created: Boolean) : LockResult()
    data class UnknownWarehouse(val scanned: String) : LockResult()
}

/** Penguncian sesi gudang (Bab 2.1): satu sesi aktif per operator. */
class SessionService(
    private val db: AppDatabase,
    private val audit: AuditWriter,
    private val clock: () -> Long = System::currentTimeMillis,
    private val newUuid: () -> String = { UUID.randomUUID().toString() },
) {
    suspend fun lock(operator: String, scannedCode: String): LockResult {
        val warehouse = db.warehouses().findByCode(scannedCode.trim())
            ?: return LockResult.UnknownWarehouse(scannedCode.trim())

        return db.withTransaction {
            val open = db.sessions().findOpen(operator, warehouse.code)
            if (open != null) {
                LockResult.Locked(open, warehouse, created = false)
            } else {
                db.sessions().finishOthers(operator, warehouse.code, clock())
                val session = SessionEntity(newUuid(), operator, warehouse.code, clock(), null)
                db.sessions().insert(session)
                audit.record(operator, "session_lock", "session", session.uuid, "Sesi opname terkunci di ${warehouse.code}")
                LockResult.Locked(session, warehouse, created = true)
            }
        }
    }
}
```

`ScanService.kt`:
```kotlin
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
```

`CountService.kt`:
```kotlin
package com.unison.stockopname.data.repo

import androidx.room.withTransaction
import com.unison.stockopname.data.api.Payloads
import com.unison.stockopname.data.db.AppDatabase
import com.unison.stockopname.data.db.CountEntity
import com.unison.stockopname.data.db.ItemEntity
import com.unison.stockopname.data.db.OutboxEntity
import com.unison.stockopname.data.db.OutboxType
import com.unison.stockopname.data.db.SessionEntity
import com.unison.stockopname.domain.DuplicateAction
import com.unison.stockopname.domain.DuplicateCountPolicy
import com.unison.stockopname.domain.VarianceCalculator
import com.unison.stockopname.sync.SyncTrigger
import java.util.UUID

sealed class SaveCountResult {
    data class Saved(val record: CountEntity) : SaveCountResult()
    data class NeedsResolution(val existing: CountEntity) : SaveCountResult()
}

class CountService(
    private val db: AppDatabase,
    private val sync: SyncTrigger,
    private val audit: AuditWriter,
    private val clock: () -> Long = System::currentTimeMillis,
    private val newUuid: () -> String = { UUID.randomUUID().toString() },
) {
    /** [action] null saat hitungan pertama; bila sudah ada hitungan, wajib diisi operator (timpa/tambah). */
    suspend fun save(
        session: SessionEntity,
        item: ItemEntity,
        qty: Int,
        rackCode: String?,
        note: String,
        action: DuplicateAction?,
    ): SaveCountResult {
        require(qty >= 0) { "Qty tidak boleh negatif" }

        val existing = db.counts().latestForItem(session.uuid, item.itemCode)
        if (existing != null && action == null) return SaveCountResult.NeedsResolution(existing)

        val finalQty = DuplicateCountPolicy.resolve(existing?.qtyPhysical, qty, action)
        val variance = VarianceCalculator.variance(finalQty, item.stock)
        val record = CountEntity(
            uuid = newUuid(), sessionUuid = session.uuid, warehouseCode = session.warehouseCode,
            itemCode = item.itemCode, itemName = item.itemName, qtySystem = item.stock,
            qtyPhysical = finalQty, variance = variance,
            rackCode = rackCode?.trim()?.takeIf { it.isNotEmpty() },
            note = note.trim(), supersedesUuid = existing?.uuid,
            createdAtDevice = clock(), operator = session.operator,
        )

        db.withTransaction {
            db.counts().insert(record)
            db.outbox().insert(
                OutboxEntity(type = OutboxType.COUNT, clientUuid = record.uuid, payloadJson = Payloads.count(record), createdAt = clock())
            )
            audit.record(
                session.operator, "stock_count", "count_record", record.uuid,
                "Hitung fisik ${item.itemName} di ${session.warehouseCode}: sistem ${fmt(item.stock)}, " +
                    "fisik $finalQty, selisih ${fmt(variance)}"
            )
        }
        sync.request()
        return SaveCountResult.Saved(record)
    }

    private fun fmt(d: Double): String = if (d % 1.0 == 0.0) d.toLong().toString() else d.toString()
}
```

`ProposalService.kt`:
```kotlin
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
```

- [ ] **Step 6: Jalankan, pastikan lulus**

Run: `./gradlew :app:testDebugUnitTest --tests "*SessionServiceTest" --tests "*ScanServiceTest" --tests "*CountServiceTest" --tests "*ProposalServiceTest"`
Expected: PASS, 4 + 8 + 6 + 4 = 22 tests.
Bila Room `withTransaction` menggantung di Robolectric, pastikan tes memakai `runBlocking` (bukan `runTest`) seperti di atas.

- [ ] **Step 7: Jalankan seluruh tes untuk memastikan Task 6 tidak rusak**

Run: `./gradlew :app:testDebugUnitTest`
Expected: semua PASS.

- [ ] **Step 8: Commit**

```bash
git add android/app/src
git commit -m "feat(android): add session, scan, count and proposal services with audit and outbox"
```

---

### Task 10: KeyValueStore, sync master item/gudang, status proposal

**Files:**
- Create: `android/app/src/main/java/com/unison/stockopname/data/prefs/KeyValueStore.kt`
- Create: `android/app/src/main/java/com/unison/stockopname/data/repo/MasterSyncService.kt`
- Create: `android/app/src/main/java/com/unison/stockopname/data/repo/ProposalStatusSync.kt`
- Modify: `android/app/src/test/java/com/unison/stockopname/TestSupport.kt` (tambah `InMemoryKeyValueStore`)
- Test: `.../data/repo/MasterSyncServiceTest.kt`, `.../data/repo/ProposalStatusSyncTest.kt`

**Interfaces:**
- Consumes: `WmsApi`, `apiCall`, `ItemDao`, `WarehouseDao`, `ProposalDao`.
- Produces:
  - `interface KeyValueStore { fun getString(key: String): String?; fun putString(key: String, value: String?) }` (`null` = hapus)
  - `sealed class MasterSyncResult { Ok(itemsWritten: Int, fullCycle: Boolean); AuthExpired; Failed(message: String, retryable: Boolean) }`
  - `class MasterSyncService(api: WmsApi, itemDao: ItemDao, warehouseDao: WarehouseDao, store: KeyValueStore, pageSize: Int = 2000, clock: () -> Long = System::currentTimeMillis, fullRefreshEveryMs: Long = 7 hari, noDeltaMinIntervalMs: Long = 6 jam) { suspend fun syncWarehouses(): MasterSyncResult; suspend fun syncItems(): MasterSyncResult }`
  - `class ProposalStatusSync(api: WmsApi, dao: ProposalDao) { suspend fun refresh(): ApiResult<Int> }`
- Kebijakan sync item:
  1. Ada kursor `master_after_id` berarti siklus sebelumnya terputus, lanjutkan dari situ.
  2. Server mendukung delta dan siklus penuh terakhir < 7 hari: kirim `updated_since` = `server_time` halaman pertama siklus lalu.
  3. Server tanpa delta: ulangi siklus penuh hanya bila terakhir > 6 jam lalu, jika tidak lewati (return `Ok(0, false)` tanpa panggilan jaringan).
  4. Selain itu siklus penuh. Delta tidak menyebarkan penghapusan, karena itu siklus penuh paksa tiap 7 hari.

- [ ] **Step 1: Tambah `InMemoryKeyValueStore` ke `TestSupport.kt`**

```kotlin
class InMemoryKeyValueStore : com.unison.stockopname.data.prefs.KeyValueStore {
    private val map = mutableMapOf<String, String>()
    override fun getString(key: String): String? = map[key]
    override fun putString(key: String, value: String?) { if (value == null) map.remove(key) else map[key] = value }
}
```

- [ ] **Step 2: Tulis tes yang gagal**

`MasterSyncServiceTest.kt`:
```kotlin
package com.unison.stockopname.data.repo

import com.unison.stockopname.InMemoryKeyValueStore
import com.unison.stockopname.data.api.ApiFactory
import com.unison.stockopname.data.db.AppDatabase
import com.unison.stockopname.newTestDb
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class MasterSyncServiceTest {
    private lateinit var db: AppDatabase
    private lateinit var server: MockWebServer
    private lateinit var store: InMemoryKeyValueStore
    private var now = 1_000_000_000L
    private val hour = 3_600_000L

    @Before fun setUp() {
        db = newTestDb()
        server = MockWebServer().also { it.start() }
        store = InMemoryKeyValueStore()
    }

    @After fun tearDown() { db.close(); server.shutdown() }

    private fun service() = MasterSyncService(
        ApiFactory.create(server.url("/stock/api/").toString()) { "tok" },
        db.items(), db.warehouses(), store, pageSize = 2, clock = { now },
    )

    private fun item(id: Int, wh: String? = "U2 GUDANG2") =
        """{"id":$id,"item_code":"C$id","item_name":"BAUT $id","stock":${id * 10},"unit":"PCS","pack":"KARUNG","isi_per_pack":1000,"warehouse_code":${if (wh == null) "null" else "\"$wh\""}}"""

    private fun page(ids: List<Int>, next: Int, done: Boolean, serverTime: String = "2026-09-19 10:00:00", delta: Boolean = true) =
        MockResponse().setHeader("Content-Type", "application/json").setBody(
            """{"success":true,"data":{"items":[${ids.joinToString(",") { item(it) }}],"next_after_id":$next,"done":$done,"server_time":"$serverTime","supports_delta":$delta}}"""
        )

    @Test fun fullSyncWritesAllPagesAndClearsCursor() = runBlocking {
        server.enqueue(page(listOf(1, 2), next = 2, done = false))
        server.enqueue(page(listOf(3), next = 3, done = true))

        val r = service().syncItems() as MasterSyncResult.Ok

        assertEquals(3, r.itemsWritten)
        assertTrue(r.fullCycle)
        assertEquals(3, db.items().count())
        assertNull(store.getString("master_after_id"))
        server.takeRequest()
        assertEquals("2", server.takeRequest().requestUrl!!.queryParameter("after_id"))
    }

    @Test fun nullWarehouseFromServerIsStoredAsNull() = runBlocking {
        server.enqueue(
            MockResponse().setHeader("Content-Type", "application/json").setBody(
                """{"success":true,"data":{"items":[${item(9, wh = null)}],"next_after_id":9,"done":true,"server_time":"t","supports_delta":false}}"""
            )
        )
        service().syncItems()
        assertNull(db.items().findByCode("C9")!!.warehouseCode)
    }

    @Test fun resumesFromStoredCursor() = runBlocking {
        store.putString("master_after_id", "2")
        store.putString("master_cycle_since", "")
        server.enqueue(page(listOf(3), next = 3, done = true))

        service().syncItems()

        assertEquals("2", server.takeRequest().requestUrl!!.queryParameter("after_id"))
    }

    @Test fun failureMidwayKeepsCursorAndReportsRetryable() = runBlocking {
        server.enqueue(page(listOf(1, 2), next = 2, done = false))
        server.enqueue(MockResponse().setResponseCode(503).setBody("""{"success":false,"message":"DB sibuk"}"""))

        val r = service().syncItems() as MasterSyncResult.Failed

        assertTrue(r.retryable)
        assertEquals("2", store.getString("master_after_id"))
        assertEquals(2, db.items().count())
    }

    @Test fun deltaCycleSendsUpdatedSinceFromFirstPageServerTime() = runBlocking {
        server.enqueue(page(listOf(1), next = 1, done = true, serverTime = "2026-09-19 10:00:00", delta = true))
        service().syncItems()
        server.takeRequest()

        now += hour
        server.enqueue(page(listOf(1), next = 1, done = true, serverTime = "2026-09-19 11:00:00", delta = true))
        val second = service().syncItems() as MasterSyncResult.Ok

        assertEquals(false, second.fullCycle)
        assertEquals("2026-09-19 10:00:00", server.takeRequest().requestUrl!!.queryParameter("updated_since"))
    }

    @Test fun fullCycleForcedAfterSevenDays() = runBlocking {
        server.enqueue(page(listOf(1), next = 1, done = true, delta = true))
        service().syncItems()
        server.takeRequest()

        now += 8 * 24 * hour
        server.enqueue(page(listOf(1), next = 1, done = true, delta = true))
        val r = service().syncItems() as MasterSyncResult.Ok

        assertTrue(r.fullCycle)
        assertNull(server.takeRequest().requestUrl!!.queryParameter("updated_since"))
    }

    @Test fun serverWithoutDeltaIsSkippedWithinSixHours() = runBlocking {
        server.enqueue(page(listOf(1), next = 1, done = true, delta = false))
        service().syncItems()

        now += 2 * hour
        val r = service().syncItems() as MasterSyncResult.Ok

        assertEquals(0, r.itemsWritten)
        assertEquals(1, server.requestCount)
    }

    @Test fun serverWithoutDeltaSyncsFullAgainAfterSixHours() = runBlocking {
        server.enqueue(page(listOf(1), next = 1, done = true, delta = false))
        service().syncItems()

        now += 7 * hour
        server.enqueue(page(listOf(1), next = 1, done = true, delta = false))
        val r = service().syncItems() as MasterSyncResult.Ok

        assertTrue(r.fullCycle)
        assertEquals(2, server.requestCount)
    }

    @Test fun stalledServerCursorIsPermanentFailure() = runBlocking {
        server.enqueue(page(listOf(1), next = 0, done = false))
        val r = service().syncItems() as MasterSyncResult.Failed
        assertEquals(false, r.retryable)
    }

    @Test fun expiredTokenReportsAuthExpired() = runBlocking {
        server.enqueue(MockResponse().setResponseCode(401).setBody("""{"success":false,"message":"Token tidak valid."}"""))
        assertEquals(MasterSyncResult.AuthExpired, service().syncItems())
    }

    @Test fun warehousesReplaceTableInServerOrder() = runBlocking {
        server.enqueue(
            MockResponse().setHeader("Content-Type", "application/json")
                .setBody("""{"success":true,"data":[{"code":"U2 GUDANG1","name":"G1"},{"code":"U1","name":"U1"}]}""")
        )
        val r = service().syncWarehouses() as MasterSyncResult.Ok
        assertEquals(2, r.itemsWritten)
        assertEquals(listOf("U2 GUDANG1", "U1"), db.warehouses().all().map { it.code })
    }
}
```

`ProposalStatusSyncTest.kt`:
```kotlin
package com.unison.stockopname.data.repo

import com.unison.stockopname.data.api.ApiFactory
import com.unison.stockopname.data.api.ApiResult
import com.unison.stockopname.data.db.AppDatabase
import com.unison.stockopname.data.db.ProposalEntity
import com.unison.stockopname.data.db.ProposalStatus
import com.unison.stockopname.newTestDb
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class ProposalStatusSyncTest {
    private lateinit var db: AppDatabase
    private lateinit var server: MockWebServer

    @Before fun setUp() { db = newTestDb(); server = MockWebServer().also { it.start() } }
    @After fun tearDown() { db.close(); server.shutdown() }

    private fun sync() = ProposalStatusSync(ApiFactory.create(server.url("/stock/api/").toString()) { "tok" }, db.proposals())

    private suspend fun local(uuid: String, barcode: String) = db.proposals().insert(
        ProposalEntity(uuid, "s1", barcode, "BAUT", "Baut", 1, "U2 GUDANG2", "", "/x.jpg", "a".repeat(64),
            ProposalStatus.PENDING, null, 1L, "kirana")
    )

    @Test fun appliesApprovedAndRejectedStatuses() = runBlocking {
        local("p1", "111"); local("p2", "222")
        server.enqueue(
            MockResponse().setHeader("Content-Type", "application/json").setBody(
                """{"success":true,"data":[
                    {"client_uuid":"p1","status":"active","rejection_reason":null,"approved_at":"2026-09-19 12:00:00"},
                    {"client_uuid":"p2","status":"rejected","rejection_reason":"Foto blur","approved_at":"2026-09-19 12:01:00"}]}"""
            )
        )
        assertEquals(ApiResult.Ok(2), sync().refresh())
        assertEquals(ProposalStatus.ACTIVE, db.proposals().findByBarcode("111")!!.status)
        val rejected = db.proposals().findByBarcode("222")!!
        assertEquals(ProposalStatus.REJECTED, rejected.status)
        assertEquals("Foto blur", rejected.rejectionReason)
    }

    @Test fun unknownStatusValueIsIgnored() = runBlocking {
        local("p1", "111")
        server.enqueue(
            MockResponse().setHeader("Content-Type", "application/json")
                .setBody("""{"success":true,"data":[{"client_uuid":"p1","status":"aneh","rejection_reason":null,"approved_at":null}]}""")
        )
        assertEquals(ApiResult.Ok(0), sync().refresh())
        assertEquals(ProposalStatus.PENDING, db.proposals().findByBarcode("111")!!.status)
    }

    @Test fun authExpiredIsPropagated() = runBlocking {
        server.enqueue(MockResponse().setResponseCode(401).setBody("""{"success":false,"message":"x"}"""))
        assertEquals(ApiResult.AuthExpired, sync().refresh())
    }
}
```

- [ ] **Step 3: Jalankan, pastikan gagal**

Run: `./gradlew :app:testDebugUnitTest --tests "*MasterSyncServiceTest" --tests "*ProposalStatusSyncTest"`
Expected: FAIL kompilasi `Unresolved reference: MasterSyncService`.

- [ ] **Step 4: Implementasi**

`KeyValueStore.kt`:
```kotlin
package com.unison.stockopname.data.prefs

/** Penyimpanan kunci-nilai sederhana. `putString(key, null)` menghapus kunci. */
interface KeyValueStore {
    fun getString(key: String): String?
    fun putString(key: String, value: String?)
}
```

`MasterSyncService.kt`:
```kotlin
package com.unison.stockopname.data.repo

import com.unison.stockopname.data.api.ApiResult
import com.unison.stockopname.data.api.WmsApi
import com.unison.stockopname.data.api.apiCall
import com.unison.stockopname.data.db.ItemDao
import com.unison.stockopname.data.db.ItemEntity
import com.unison.stockopname.data.db.WarehouseDao
import com.unison.stockopname.data.db.WarehouseEntity
import com.unison.stockopname.data.prefs.KeyValueStore

sealed class MasterSyncResult {
    data class Ok(val itemsWritten: Int, val fullCycle: Boolean) : MasterSyncResult()
    object AuthExpired : MasterSyncResult()
    data class Failed(val message: String, val retryable: Boolean) : MasterSyncResult()
}

class MasterSyncService(
    private val api: WmsApi,
    private val itemDao: ItemDao,
    private val warehouseDao: WarehouseDao,
    private val store: KeyValueStore,
    private val pageSize: Int = 2000,
    private val clock: () -> Long = System::currentTimeMillis,
    private val fullRefreshEveryMs: Long = 7L * 24 * 3_600_000,
    private val noDeltaMinIntervalMs: Long = 6L * 3_600_000,
) {
    private sealed class Plan {
        object Skip : Plan()
        object Full : Plan()
        data class Delta(val since: String) : Plan()
    }

    suspend fun syncWarehouses(): MasterSyncResult = when (val r = apiCall { api.warehouses() }) {
        is ApiResult.Ok -> {
            warehouseDao.replaceAll(r.data.mapIndexed { i, w -> WarehouseEntity(w.code, w.name, i) })
            MasterSyncResult.Ok(r.data.size, fullCycle = true)
        }
        is ApiResult.AuthExpired -> MasterSyncResult.AuthExpired
        is ApiResult.Failure -> MasterSyncResult.Failed(r.message, r.retryable)
    }

    suspend fun syncItems(): MasterSyncResult {
        var afterId = store.getString(K_AFTER_ID)?.toLongOrNull()
        val since: String?
        if (afterId != null) {
            since = store.getString(K_CYCLE_SINCE)?.takeIf { it.isNotEmpty() }   // lanjutkan siklus terputus
        } else {
            since = when (val plan = plan()) {
                Plan.Skip -> return MasterSyncResult.Ok(0, fullCycle = false)
                Plan.Full -> null
                is Plan.Delta -> plan.since
            }
            afterId = 0L
            store.putString(K_CYCLE_SINCE, since ?: "")
            store.putString(K_CYCLE_SERVER_TIME, null)
        }

        var written = 0
        while (true) {
            when (val r = apiCall { api.master(afterId!!, pageSize, since) }) {
                is ApiResult.AuthExpired -> return MasterSyncResult.AuthExpired
                is ApiResult.Failure -> return MasterSyncResult.Failed(r.message, r.retryable)
                is ApiResult.Ok -> {
                    val page = r.data
                    itemDao.upsertAll(page.items.map {
                        ItemEntity(it.id, it.itemCode, it.itemName, it.stock, it.unit, it.pack, it.isiPerPack, it.warehouseCode)
                    })
                    written += page.items.size
                    if (store.getString(K_CYCLE_SERVER_TIME) == null) store.putString(K_CYCLE_SERVER_TIME, page.serverTime)

                    if (page.done) {
                        finishCycle(page.supportsDelta, fullCycle = since == null)
                        return MasterSyncResult.Ok(written, fullCycle = since == null)
                    }
                    if (page.nextAfterId <= afterId!!) {
                        return MasterSyncResult.Failed("Server tidak memajukan halaman master item.", retryable = false)
                    }
                    afterId = page.nextAfterId
                    store.putString(K_AFTER_ID, afterId.toString())
                }
            }
        }
    }

    private fun plan(): Plan {
        val lastFullAt = store.getString(K_LAST_FULL_AT)?.toLongOrNull() ?: return Plan.Full
        val age = clock() - lastFullAt
        val lastServerTime = store.getString(K_LAST_SERVER_TIME)
        return when {
            lastServerTime != null && age < fullRefreshEveryMs -> Plan.Delta(lastServerTime)
            lastServerTime == null && age < noDeltaMinIntervalMs -> Plan.Skip
            else -> Plan.Full
        }
    }

    private fun finishCycle(supportsDelta: Boolean, fullCycle: Boolean) {
        val cycleTime = store.getString(K_CYCLE_SERVER_TIME)
        store.putString(K_AFTER_ID, null)
        store.putString(K_CYCLE_SINCE, null)
        store.putString(K_CYCLE_SERVER_TIME, null)
        store.putString(K_LAST_SERVER_TIME, if (supportsDelta) cycleTime else null)
        if (fullCycle) store.putString(K_LAST_FULL_AT, clock().toString())
    }

    private companion object {
        const val K_AFTER_ID = "master_after_id"
        const val K_CYCLE_SINCE = "master_cycle_since"
        const val K_CYCLE_SERVER_TIME = "master_cycle_server_time"
        const val K_LAST_SERVER_TIME = "master_last_server_time"
        const val K_LAST_FULL_AT = "master_last_full_at"
    }
}
```

`ProposalStatusSync.kt`:
```kotlin
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
```

- [ ] **Step 5: Jalankan, pastikan lulus**

Run: `./gradlew :app:testDebugUnitTest --tests "*MasterSyncServiceTest" --tests "*ProposalStatusSyncTest"`
Expected: PASS, 10 + 3 = 13 tests.

- [ ] **Step 6: Commit**

```bash
git add android/app/src
git commit -m "feat(android): add paged resumable master sync with delta policy and proposal status pull"
```

---

### Task 11: Auth, pengaturan, penyimpanan kunci-nilai (SharedPreferences dan terenkripsi)

**Files:**
- Create: `android/app/src/main/java/com/unison/stockopname/data/prefs/SharedPrefsKeyValueStore.kt`
- Create: `android/app/src/main/java/com/unison/stockopname/data/prefs/AppSettings.kt`
- Create: `android/app/src/main/java/com/unison/stockopname/data/repo/AuthRepository.kt`
- Test: `.../data/prefs/AppSettingsTest.kt`, `.../data/prefs/SharedPrefsKeyValueStoreTest.kt`, `.../data/repo/AuthRepositoryTest.kt`

**Interfaces:**
- Consumes: `KeyValueStore`, `WmsApi`, `apiCall`, `LoginRequest`.
- Produces:
  - `class SharedPrefsKeyValueStore(prefs: SharedPreferences) : KeyValueStore`
  - `object KeyValueStores { fun plain(context: Context): KeyValueStore; fun secure(context: Context): KeyValueStore }` (`secure` memakai `EncryptedSharedPreferences`, tidak bisa dites di JVM karena butuh Android Keystore)
  - `class AppSettings(store: KeyValueStore, defaultBaseUrl: String) { var baseUrl: String }` (setter menormalkan akhiran `/`, menolak selain `http://`/`https://` dengan `IllegalArgumentException`)
  - `data class SessionUser(val username: String, val division: String?, val level: Int)`
  - `class AuthRepository(apiProvider: () -> WmsApi, secure: KeyValueStore, deviceName: String) { suspend fun login(username: String, password: String): ApiResult<SessionUser>; fun token(): String?; fun currentUser(): SessionUser?; fun markExpired(); fun logout() }`

- [ ] **Step 1: Tulis tes yang gagal**

`SharedPrefsKeyValueStoreTest.kt`:
```kotlin
package com.unison.stockopname.data.prefs

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class SharedPrefsKeyValueStoreTest {
    private fun store() = SharedPrefsKeyValueStore(
        ApplicationProvider.getApplicationContext<Context>().getSharedPreferences("t", Context.MODE_PRIVATE)
    )

    @Test fun putGetAndRemove() {
        val s = store()
        assertNull(s.getString("k"))
        s.putString("k", "v")
        assertEquals("v", s.getString("k"))
        s.putString("k", null)
        assertNull(s.getString("k"))
    }
}
```

`AppSettingsTest.kt`:
```kotlin
package com.unison.stockopname.data.prefs

import com.unison.stockopname.InMemoryKeyValueStore
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class AppSettingsTest {
    private val default = "http://192.168.1.140/stock/api/"

    @Test fun usesDefaultUntilChanged() {
        assertEquals(default, AppSettings(InMemoryKeyValueStore(), default).baseUrl)
    }

    @Test fun setterAddsTrailingSlashAndTrims() {
        val s = AppSettings(InMemoryKeyValueStore(), default)
        s.baseUrl = "  http://192.168.1.159/stock/api  "
        assertEquals("http://192.168.1.159/stock/api/", s.baseUrl)
    }

    @Test fun valueSurvivesNewInstanceOnSameStore() {
        val store = InMemoryKeyValueStore()
        AppSettings(store, default).baseUrl = "http://192.168.1.159/x/"
        assertEquals("http://192.168.1.159/x/", AppSettings(store, default).baseUrl)
    }

    @Test fun rejectsNonHttpUrl() {
        val s = AppSettings(InMemoryKeyValueStore(), default)
        assertThrows(IllegalArgumentException::class.java) { s.baseUrl = "ftp://192.168.1.140/" }
        assertThrows(IllegalArgumentException::class.java) { s.baseUrl = "   " }
    }

    @Test fun blankStoredValueFallsBackToDefault() {
        val store = InMemoryKeyValueStore().apply { putString("base_url", "  ") }
        assertEquals(default, AppSettings(store, default).baseUrl)
    }
}
```

`AuthRepositoryTest.kt`:
```kotlin
package com.unison.stockopname.data.repo

import com.unison.stockopname.InMemoryKeyValueStore
import com.unison.stockopname.data.api.ApiFactory
import com.unison.stockopname.data.api.ApiResult
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class AuthRepositoryTest {
    private lateinit var server: MockWebServer
    private lateinit var store: InMemoryKeyValueStore
    private lateinit var auth: AuthRepository

    @Before fun setUp() {
        server = MockWebServer().also { it.start() }
        store = InMemoryKeyValueStore()
        auth = AuthRepository(
            { ApiFactory.create(server.url("/stock/api/").toString()) { store.getString("token") } }, store, "ZEBRA TC26"
        )
    }

    @After fun tearDown() { server.shutdown() }

    private fun loginOk() = MockResponse().setHeader("Content-Type", "application/json").setBody(
        """{"success":true,"data":{"token":"TKN","iduser":7,"username":"kirana","user_divisi":"Gudang","user_level":2}}"""
    )

    @Test fun successfulLoginStoresTokenAndUser() = runBlocking {
        server.enqueue(loginOk())
        val r = auth.login("  Kirana ", "rahasia") as ApiResult.Ok

        assertEquals(SessionUser("kirana", "Gudang", 2), r.data)
        assertEquals("TKN", auth.token())
        assertEquals(SessionUser("kirana", "Gudang", 2), auth.currentUser())
        val body = server.takeRequest().body.readUtf8()
        assertTrue(body.contains("\"username\":\"Kirana\"") || body.contains("\"username\":\"kirana\""))
        assertTrue(body.contains("ZEBRA TC26"))
    }

    @Test fun wrongPasswordFailsWithoutStoringToken() = runBlocking {
        server.enqueue(MockResponse().setResponseCode(401).setBody("""{"success":false,"message":"Username atau password salah."}"""))
        val r = auth.login("kirana", "salah") as ApiResult.Failure
        assertEquals("Username atau password salah.", r.message)
        assertFalse(r.retryable)
        assertNull(auth.token())
    }

    @Test fun blankCredentialsNeverHitNetwork() = runBlocking {
        val r = auth.login(" ", "") as ApiResult.Failure
        assertEquals("Username dan password wajib diisi.", r.message)
        assertEquals(0, server.requestCount)
    }

    @Test fun networkDownIsRetryableFailure() = runBlocking {
        server.shutdown()
        val r = auth.login("kirana", "x") as ApiResult.Failure
        assertTrue(r.retryable)
    }

    @Test fun markExpiredClearsTokenButKeepsUser() = runBlocking {
        server.enqueue(loginOk())
        auth.login("kirana", "x")
        auth.markExpired()
        assertNull(auth.token())
        assertNotNull(auth.currentUser())
    }

    @Test fun logoutClearsEverything() = runBlocking {
        server.enqueue(loginOk())
        auth.login("kirana", "x")
        auth.logout()
        assertNull(auth.token())
        assertNull(auth.currentUser())
    }
}
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `./gradlew :app:testDebugUnitTest --tests "*SharedPrefsKeyValueStoreTest" --tests "*AppSettingsTest" --tests "*AuthRepositoryTest"`
Expected: FAIL kompilasi `Unresolved reference: SharedPrefsKeyValueStore`.

- [ ] **Step 3: Implementasi**

`SharedPrefsKeyValueStore.kt`:
```kotlin
package com.unison.stockopname.data.prefs

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class SharedPrefsKeyValueStore(private val prefs: SharedPreferences) : KeyValueStore {
    override fun getString(key: String): String? = prefs.getString(key, null)
    override fun putString(key: String, value: String?) {
        prefs.edit().apply { if (value == null) remove(key) else putString(key, value) }.apply()
    }
}

object KeyValueStores {
    fun plain(context: Context): KeyValueStore =
        SharedPrefsKeyValueStore(context.getSharedPreferences("stockopname_prefs", Context.MODE_PRIVATE))

    /** Token login disimpan terenkripsi (Android Keystore). Tidak bisa dites di JVM. */
    fun secure(context: Context): KeyValueStore {
        val masterKey = MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
        val prefs = EncryptedSharedPreferences.create(
            context, "stockopname_secure", masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
        return SharedPrefsKeyValueStore(prefs)
    }
}
```

`AppSettings.kt`:
```kotlin
package com.unison.stockopname.data.prefs

class AppSettings(private val store: KeyValueStore, private val defaultBaseUrl: String) {
    var baseUrl: String
        get() = store.getString(KEY_BASE_URL)?.trim()?.takeIf { it.isNotEmpty() } ?: defaultBaseUrl
        set(value) {
            val v = value.trim()
            require(v.startsWith("http://") || v.startsWith("https://")) { "Alamat server harus diawali http:// atau https://" }
            store.putString(KEY_BASE_URL, v.trimEnd('/') + "/")
        }

    private companion object { const val KEY_BASE_URL = "base_url" }
}
```

`AuthRepository.kt`:
```kotlin
package com.unison.stockopname.data.repo

import com.unison.stockopname.data.api.ApiResult
import com.unison.stockopname.data.api.LoginRequest
import com.unison.stockopname.data.api.WmsApi
import com.unison.stockopname.data.api.apiCall
import com.unison.stockopname.data.prefs.KeyValueStore

data class SessionUser(val username: String, val division: String?, val level: Int)

class AuthRepository(
    private val apiProvider: () -> WmsApi,
    private val secure: KeyValueStore,
    private val deviceName: String,
) {
    suspend fun login(username: String, password: String): ApiResult<SessionUser> {
        val u = username.trim()
        if (u.isEmpty() || password.isEmpty()) {
            return ApiResult.Failure("Username dan password wajib diisi.", retryable = false)
        }
        return when (val r = apiCall(unauthorizedIsExpiry = false) { apiProvider().login(LoginRequest(u, password, deviceName)) }) {
            is ApiResult.Ok -> {
                val user = SessionUser(r.data.username, r.data.userDivisi, r.data.userLevel)
                secure.putString(K_TOKEN, r.data.token)
                secure.putString(K_USER, user.username)
                secure.putString(K_DIVISION, user.division)
                secure.putString(K_LEVEL, user.level.toString())
                ApiResult.Ok(user)
            }
            is ApiResult.AuthExpired -> ApiResult.AuthExpired
            is ApiResult.Failure -> r
        }
    }

    fun token(): String? = secure.getString(K_TOKEN)

    fun currentUser(): SessionUser? {
        val username = secure.getString(K_USER) ?: return null
        return SessionUser(username, secure.getString(K_DIVISION), secure.getString(K_LEVEL)?.toIntOrNull() ?: 0)
    }

    /** Token ditolak server (401): hapus token, biarkan data lokal dan identitas terakhir. */
    fun markExpired() = secure.putString(K_TOKEN, null)

    fun logout() {
        listOf(K_TOKEN, K_USER, K_DIVISION, K_LEVEL).forEach { secure.putString(it, null) }
    }

    private companion object {
        const val K_TOKEN = "token"
        const val K_USER = "user"
        const val K_DIVISION = "division"
        const val K_LEVEL = "level"
    }
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `./gradlew :app:testDebugUnitTest --tests "*SharedPrefsKeyValueStoreTest" --tests "*AppSettingsTest" --tests "*AuthRepositoryTest"`
Expected: PASS, 1 + 5 + 6 = 12 tests.

- [ ] **Step 5: Commit**

```bash
git add android/app/src
git commit -m "feat(android): add auth repository, app settings and encrypted key-value store"
```

---

### Task 12: UpdateManager (auto-update ala MVNative)

**Files:**
- Create: `android/app/src/main/java/com/unison/stockopname/update/UpdateManager.kt`
- Create: `android/app/src/main/res/xml/file_paths.xml`
- Modify: `android/app/src/main/AndroidManifest.xml`
- Test: `android/app/src/test/java/com/unison/stockopname/update/UpdateManagerTest.kt`

**Interfaces:**
- Consumes: OkHttp.
- Produces:
  - `data class UpdateInfo(versionCode: Int = 0, versionName: String = "", apkFileName: String = "", notes: String = "", mandatory: Boolean = false)`
  - `class UpdateManager(client: OkHttpClient = ...) { fun updatesBaseUrl(apiBaseUrl: String): String; suspend fun checkForUpdate(apiBaseUrl: String, currentVersionCode: Int): UpdateInfo?; fun enqueueDownload(context: Context, apiBaseUrl: String, info: UpdateInfo): Long; fun installDownloadedApk(context: Context, apkFileName: String) }`
- Perilaku sama dengan MVNative: server tidak terjangkau atau `version.json` rusak berarti `null` (diam, bukan error). Tambahan keamanan: `apkFileName` yang mengandung `/`, `\`, `..` atau tidak berakhiran `.apk` ditolak (`null`). UI banner/dialog (tampil 4 detik setelah app terbuka, wajib bila `mandatory`) ada di plan UI.

- [ ] **Step 1: Tulis tes yang gagal**

```kotlin
package com.unison.stockopname.update

import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class UpdateManagerTest {
    private lateinit var server: MockWebServer
    private val manager = UpdateManager()
    private lateinit var apiBase: String

    @Before fun setUp() {
        server = MockWebServer().also { it.start() }
        apiBase = server.url("/stock/api/").toString()
    }

    @After fun tearDown() { server.shutdown() }

    private fun versionJson(code: Int = 2, apk: String = "StockOpname-1.1.apk", mandatory: Boolean = false) =
        MockResponse().setHeader("Content-Type", "application/json").setBody(
            """{"versionCode":$code,"versionName":"1.1","apkFileName":"$apk","notes":"Perbaikan","mandatory":$mandatory}"""
        )

    @Test fun updatesFolderSitsBesideApiFolder() {
        assertEquals("http://h/stock/updates/", manager.updatesBaseUrl("http://h/stock/api/"))
        assertEquals("http://h/stock/updates/", manager.updatesBaseUrl("http://h/stock/api"))
        assertEquals("http://h/stock/updates/", manager.updatesBaseUrl("http://h/stock"))
    }

    @Test fun newerVersionIsOffered() = runBlocking {
        server.enqueue(versionJson(code = 2, mandatory = true))
        val info = manager.checkForUpdate(apiBase, currentVersionCode = 1)!!
        assertEquals("StockOpname-1.1.apk", info.apkFileName)
        assertTrue(info.mandatory)
        assertEquals("/stock/updates/version.json", server.takeRequest().path)
    }

    @Test fun sameOrOlderVersionIsNotOffered() = runBlocking {
        server.enqueue(versionJson(code = 2))
        assertNull(manager.checkForUpdate(apiBase, currentVersionCode = 2))
        server.enqueue(versionJson(code = 1))
        assertNull(manager.checkForUpdate(apiBase, currentVersionCode = 2))
    }

    @Test fun serverErrorMalformedJsonAndBlankApkAreSilentlyIgnored() = runBlocking {
        server.enqueue(MockResponse().setResponseCode(404))
        assertNull(manager.checkForUpdate(apiBase, 1))
        server.enqueue(MockResponse().setBody("<html>bukan json</html>"))
        assertNull(manager.checkForUpdate(apiBase, 1))
        server.enqueue(versionJson(code = 2, apk = ""))
        assertNull(manager.checkForUpdate(apiBase, 1))
    }

    @Test fun unsafeApkFileNamesAreRejected() = runBlocking {
        for (bad in listOf("../evil.apk", "a/b.apk", "a\\\\b.apk", "app.zip", "..apk")) {
            server.enqueue(versionJson(code = 2, apk = bad))
            assertNull("must reject $bad", manager.checkForUpdate(apiBase, 1))
        }
        server.enqueue(versionJson(code = 2, apk = "StockOpname-1.1.apk"))
        assertNotNull(manager.checkForUpdate(apiBase, 1))
    }

    @Test fun unreachableServerReturnsNull() = runBlocking {
        server.shutdown()
        assertNull(manager.checkForUpdate(apiBase, 1))
        assertFalse(server.requestCount > 5)
    }
}
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `./gradlew :app:testDebugUnitTest --tests "*UpdateManagerTest"`
Expected: FAIL kompilasi `Unresolved reference: UpdateManager`.

- [ ] **Step 3: Implementasi**

`UpdateManager.kt`:
```kotlin
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
```

`android/app/src/main/res/xml/file_paths.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- APK update diunduh ke folder khusus app (tanpa izin storage tambahan) sebelum dipasang. -->
    <external-files-path name="updates" path="updates/" />
    <!-- Foto proposal sebelum dikirim. -->
    <files-path name="photos" path="photos/" />
</paths>
```

Ubah `AndroidManifest.xml` menjadi:
```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <!-- Pasang APK update yang diunduh sendiri (bukan Play Store). Pengguna tetap melihat dialog sistem sekali. -->
    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />

    <application
        android:name=".StockOpnameApp"
        android:allowBackup="false"
        android:label="@string/app_name"
        android:networkSecurityConfig="@xml/network_security_config"
        android:supportsRtl="true">

        <!-- Bagikan APK hasil unduhan ke Package Installer lewat content:// (file:// dilarang sejak Android 7). -->
        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>
    </application>
</manifest>
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `./gradlew :app:testDebugUnitTest --tests "*UpdateManagerTest"`
Expected: PASS, 6 tests.
Catatan: di string Kotlin `"a\\\\b.apk"` menghasilkan `a\\b.apk` (dua backslash), tetap mengandung `\` dan harus ditolak.

- [ ] **Step 5: Verifikasi manifest valid**

Run: `./gradlew :app:assembleDebug`
Expected: `BUILD SUCCESSFUL` (memastikan merge manifest dan FileProvider valid).

- [ ] **Step 6: Commit**

```bash
git add android/app/src
git commit -m "feat(android): add MVNative-style auto-update manager with safe APK name check"
```

---

### Task 13: Worker, SyncScheduler, AppContainer, Application

**Files:**
- Create: `android/app/src/main/java/com/unison/stockopname/sync/SyncScheduler.kt`
- Create: `android/app/src/main/java/com/unison/stockopname/sync/SyncWorker.kt`
- Create: `android/app/src/main/java/com/unison/stockopname/sync/MasterSyncWorker.kt`
- Create: `android/app/src/main/java/com/unison/stockopname/AppContainer.kt`
- Modify: `android/app/src/main/java/com/unison/stockopname/StockOpnameApp.kt`

**Interfaces:**
- Consumes: semua service dari Task 5-12.
- Produces:
  - `class AppContainer(context: Context)` dengan: `db`, `settings: AppSettings`, `auth: AuthRepository`, `sessions: SessionService`, `scan: ScanService`, `counts: CountService`, `proposals: ProposalService`, `printerClient: PrinterClient`, `updates: UpdateManager`, `fun api(): WmsApi`, `fun newOutboxProcessor(): OutboxProcessor`, `fun newMasterSync(): MasterSyncService`, `fun newProposalStatusSync(): ProposalStatusSync`, `suspend fun ensurePrintersSeeded()`
  - `object SyncScheduler { fun requestOutboxSync(context: Context); fun requestMasterSync(context: Context); fun schedulePeriodic(context: Context) }`
  - `StockOpnameApp.container: AppContainer`
- Worker dan container tidak punya unit test JVM (butuh WorkManager/Keystore nyata). Verifikasi: kompilasi + seluruh suite tes + `assembleDebug`, dan uji manual di perangkat (catat di laporan akhir). Logika keputusan sudah teruji di `OutboxProcessor` dan `MasterSyncService`.

- [ ] **Step 1: Buat `SyncScheduler.kt`**

```kotlin
package com.unison.stockopname.sync

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

/** Sinkronisasi otomatis saat WiFi/jaringan tersedia (Bab 4.2). */
object SyncScheduler {
    private const val OUTBOX = "outbox-sync"
    private const val OUTBOX_PERIODIC = "outbox-sync-periodic"
    private const val MASTER = "master-sync"
    private const val MASTER_PERIODIC = "master-sync-periodic"

    private val connected = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

    fun requestOutboxSync(context: Context) {
        val work = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(connected)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork(OUTBOX, ExistingWorkPolicy.APPEND_OR_REPLACE, work)
    }

    fun requestMasterSync(context: Context) {
        val work = OneTimeWorkRequestBuilder<MasterSyncWorker>()
            .setConstraints(connected)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork(MASTER, ExistingWorkPolicy.KEEP, work)
    }

    fun schedulePeriodic(context: Context) {
        val wm = WorkManager.getInstance(context)
        wm.enqueueUniquePeriodicWork(
            OUTBOX_PERIODIC, ExistingPeriodicWorkPolicy.KEEP,
            PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES).setConstraints(connected).build()
        )
        wm.enqueueUniquePeriodicWork(
            MASTER_PERIODIC, ExistingPeriodicWorkPolicy.KEEP,
            PeriodicWorkRequestBuilder<MasterSyncWorker>(6, TimeUnit.HOURS).setConstraints(connected).build()
        )
    }
}
```

- [ ] **Step 2: Buat `SyncWorker.kt` dan `MasterSyncWorker.kt`**

`SyncWorker.kt`:
```kotlin
package com.unison.stockopname.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.unison.stockopname.StockOpnameApp

class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val c = (applicationContext as StockOpnameApp).container
        if (c.auth.token() == null) return Result.success() // belum login: outbox tetap menunggu

        return when (c.newOutboxProcessor().runOnce()) {
            SyncOutcome.DONE -> {
                c.newProposalStatusSync().refresh() // best-effort, gagal tidak menggagalkan sync
                Result.success()
            }
            SyncOutcome.RETRY -> Result.retry()
            SyncOutcome.AUTH_EXPIRED -> {
                c.auth.markExpired() // data lokal aman; operator login ulang saat membuka app
                Result.success()
            }
        }
    }
}
```

`MasterSyncWorker.kt`:
```kotlin
package com.unison.stockopname.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.unison.stockopname.StockOpnameApp
import com.unison.stockopname.data.repo.MasterSyncResult

class MasterSyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val c = (applicationContext as StockOpnameApp).container
        if (c.auth.token() == null) return Result.success()

        val service = c.newMasterSync()
        val results = listOf(service.syncWarehouses(), service.syncItems())

        if (results.any { it is MasterSyncResult.AuthExpired }) {
            c.auth.markExpired()
            return Result.success()
        }
        val failed = results.filterIsInstance<MasterSyncResult.Failed>()
        return when {
            failed.isEmpty() -> Result.success()
            failed.any { it.retryable } -> Result.retry()
            else -> Result.failure()
        }
    }
}
```

- [ ] **Step 3: Buat `AppContainer.kt`**

```kotlin
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

    /** Isi printer bawaan sekali; IP yang sudah diubah operator tidak ditimpa (OnConflict IGNORE). */
    suspend fun ensurePrintersSeeded() {
        db.printers().upsertAll(PrinterSeeds.printers.map { PrinterEntity(it.id, it.name, it.host, it.port, it.paper.name) })
    }
}
```

- [ ] **Step 4: Ubah `StockOpnameApp.kt`**

```kotlin
package com.unison.stockopname

import android.app.Application
import com.unison.stockopname.sync.SyncScheduler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class StockOpnameApp : Application() {
    lateinit var container: AppContainer
        private set

    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        SyncScheduler.schedulePeriodic(this)
        appScope.launch { container.ensurePrintersSeeded() }
    }
}
```

- [ ] **Step 5: Verifikasi kompilasi dan seluruh tes**

Run: `./gradlew :app:testDebugUnitTest :app:assembleDebug`
Expected: `BUILD SUCCESSFUL`, semua tes PASS (total ±118 tes dari Task 1-12).

- [ ] **Step 6: Commit**

```bash
git add android/app/src
git commit -m "feat(android): add WorkManager sync workers, scheduler and app container wiring"
```

---

### Task 14: Panduan rilis, keystore, verifikasi akhir

**Files:**
- Create: `android/RELEASE.md`
- Modify: `docs/superpowers/specs/2026-09-19-android-native-operator-design.md` (selaraskan revisi)

- [ ] **Step 1: Buat `android/RELEASE.md`**

```markdown
# Rilis APK Stock Opname

Meniru alur MVNative (MEview). Server: 192.168.1.140, folder `stock/updates/`.

## Sekali saja: keystore rilis
Keystore HARUS sama untuk semua rilis. Kalau ganti atau hilang, Android menolak update dan semua HP harus install ulang manual.

    keytool -genkeypair -v -keystore android/keystore/stockopname-release.jks \
      -alias stockopname -keyalg RSA -keysize 2048 -validity 10000

Buat `android/keystore.properties` (tidak ter-commit):

    storeFile=keystore/stockopname-release.jks
    storePassword=...
    keyAlias=stockopname
    keyPassword=...

Backup `.jks` dan kata sandinya di tempat aman di luar repo dan luar PC ini.
Tanpa `keystore.properties`, build release jatuh ke debug keystore (hanya untuk uji lokal, JANGAN diedarkan).

## Setiap rilis
1. Naikkan `versionCode` dan `versionName` di `android/app/build.gradle.kts`.
2. `cd android && ./gradlew :app:testDebugUnitTest :app:assembleRelease`
3. Salin `app/build/outputs/apk/release/app-release.apk` menjadi `StockOpname-<versionName>.apk`.
4. Upload APK ke `ftp://192.168.1.140/stock/updates/` (user `cseon`, sandi ditanyakan, jangan disimpan di file).
5. Verifikasi: `curl -sI http://192.168.1.140/stock/updates/StockOpname-<versionName>.apk` harus `200`.
6. **Baru** upload `version.json` yang naik (`versionCode`, `versionName`, `apkFileName`, `notes`, `mandatory`).
   Bila terbalik, semua HP langsung ditawari update yang APK-nya belum ada.

`updates/*.apk` tidak ikut commit (`*.apk` ada di `.gitignore`).
```

- [ ] **Step 2: Verifikasi build rilis lokal dan tes penuh**

Run: `cd android && ./gradlew clean :app:testDebugUnitTest :app:assembleRelease`
Expected: `BUILD SUCCESSFUL`. APK ada di `android/app/build/outputs/apk/release/app-release.apk` (ter-sign debug karena belum ada `keystore.properties`).

- [ ] **Step 3: Pastikan spec sudah selaras dengan implementasi**

Penyelarasan (compileSdk 34, package `com.unison.stockopname`, tabel `wms_counts/proposals/audit_logs` tanpa `wms_sessions`, endpoint `warehouses`/`audit`, distribusi ala MVNative) sudah diterapkan saat plan ini ditulis. Verifikasi:

Run: `grep -n "id.co.unison\|wms_sessions\|app_version\|targetSdk 35" docs/superpowers/specs/2026-09-19-android-native-operator-design.md`
Expected: tidak ada keluaran.

- [ ] **Step 4: Commit**

```bash
git add android/RELEASE.md
git commit -m "docs(android): add release guide"
```

---

## Self-Review

**1. Cakupan spec**

| Spec | Task |
|---|---|
| Parser 2D barcode (bag. 4) | 2 |
| Variance, alert relokasi, hitung ganda (bag. 4, 5) | 3, 9 |
| Label DRAFT + Code128, cetak TCP 9100 LAN, printer default per gudang (bag. 4) | 4, 5 |
| Room offline-first, outbox idempoten, audit lokal (bag. 5) | 6, 8, 9 |
| Login ke `user_produksi`, token di Keystore (bag. 7, 8) | 11, 13 |
| Sync master paged, delta opsional, lanjut dari kursor (bag. 6) | 10 |
| WorkManager auto-sync saat online, backoff, FAILED setelah 5 (bag. 4, 10) | 8, 13 |
| Foto kamera-only, watermark, hash, cek jam (bag. 8) | hash + pengiriman di 8, 9. **Kamera dan watermark bitmap ada di plan UI** (butuh Android graphics/CameraX) |
| Auto-update ala MVNative (bag. 9) | 12, 14 |
| Cleartext hanya host terdaftar (bag. 8) | 1 |
| Tanpa data karangan (bag. 12.3) | 10 (`warehouse_code` null), 9 (rack null bila kosong) |

Sengaja tidak di plan ini (masuk plan UI): layar Compose, DataWedge receiver, CameraX, watermark bitmap, banner/dialog update, layar Status Sync, pengaturan printer/URL.

**2. Pemindaian placeholder:** tidak ada "TBD/TODO". Langkah "Ubah spec" di Task 14 memberi daftar perubahan eksplisit.

**3. Konsistensi tipe:** `SyncTrigger` dan `SyncOutcome` didefinisikan di Task 8 dan dipakai Task 9, 13. `KeyValueStore` didefinisikan di Task 10 dan dipakai Task 11, 13. `TestSupport.kt` dibangun bertahap (Task 6, 9, 10) dengan nama yang sama (`newTestDb`, `FakeSyncTrigger`, `seqUuid`, `testSession`, `testItem`, `InMemoryKeyValueStore`). `ProposalStatus`/`OutboxType`/`OutboxStatus` adalah string konstanta di `Entities.kt`.

**4. Risiko dan hal yang belum terverifikasi (jujur):**
- **Stok sistem bisa basi.** Tanpa kolom waktu-ubah di `item`, master hanya di-refresh ≥ 6 jam sekali. `qty_system` (dan variance) memakai nilai cache. Bila operasional butuh stok segar, tambah lookup online per item (`item.php`) di plan UI atau tambahkan kolom waktu-ubah di DB.
- **Format kode gudang.** `MisplacementChecker` membandingkan `item.WCODE` dengan kode gudang dari `wip_lokasi_m.kode`. Belum dipastikan keduanya berformat sama (`U2 GUDANG2` vs kode lain). Bila beda, alert relokasi keliru. Cek satu baris `SELECT DISTINCT WCODE FROM item` vs `SELECT kode FROM wip_lokasi_m` sebelum rilis.
- **Rak/bin nyata** belum punya sumber di server. `CountEntity.rackCode` diisi operator (nullable). Tampilan UI harus "—" bila kosong.
- `EncryptedSharedPreferences`, WorkManager, `DownloadManager`/install APK, DataWedge dan printer fisik hanya bisa diuji di perangkat, tidak di JVM.
- Endpoint PHP hanya lulus `php -l` (tanpa DB).
