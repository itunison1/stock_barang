package com.unison.stockopname.util

import android.graphics.Bitmap
import com.unison.stockopname.domain.WatermarkSpec
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.File

@RunWith(RobolectricTestRunner::class)
class WatermarkerTest {
    @Test
    fun testApplyWatermarkReturnsBitmap() {
        val src = Bitmap.createBitmap(400, 300, Bitmap.Config.ARGB_8888)
        val spec = WatermarkSpec(
            operator = "cseon",
            warehouse = "U2 GUDANG1",
            timestamp = "2026-09-19 21:00:00",
            barcode = "BM-HEX-M10-50"
        )
        val watermarked = Watermarker.applyWatermark(src, spec)
        assertNotNull(watermarked)
        assertEquals(400, watermarked.width)
        assertEquals(300, watermarked.height)
    }

    @Test
    fun testApplyWatermarkToFile() {
        val src = Bitmap.createBitmap(200, 200, Bitmap.Config.ARGB_8888)
        val tempIn = File.createTempFile("wm_in", ".jpg")
        tempIn.outputStream().use { src.compress(Bitmap.CompressFormat.JPEG, 90, it) }

        val tempOut = File.createTempFile("wm_out", ".jpg")
        val spec = WatermarkSpec(
            operator = "operator1",
            warehouse = "U2 GUDANG2",
            timestamp = "2026-09-19 21:05:00",
            barcode = "MUR-M8"
        )
        Watermarker.applyWatermark(tempIn, tempOut, spec)
        assert(tempOut.exists() && tempOut.length() > 0)
        tempIn.delete()
        tempOut.delete()
    }
}
