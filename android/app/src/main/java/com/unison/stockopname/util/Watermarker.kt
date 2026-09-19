package com.unison.stockopname.util

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import com.unison.stockopname.domain.WatermarkSpec
import java.io.File
import java.io.FileOutputStream
import kotlin.math.max

object Watermarker {
    fun applyWatermark(sourceFile: File, destFile: File, spec: WatermarkSpec) {
        val original = BitmapFactory.decodeFile(sourceFile.absolutePath) ?: return
        val result = applyWatermark(original, spec)
        if (original != result) original.recycle()

        destFile.parentFile?.mkdirs()
        FileOutputStream(destFile).use { out ->
            result.compress(Bitmap.CompressFormat.JPEG, 85, out)
        }
        result.recycle()
    }

    fun applyWatermark(source: Bitmap, spec: WatermarkSpec): Bitmap {
        val bitmap = source.copy(Bitmap.Config.ARGB_8888, true)
        val canvas = Canvas(bitmap)
        val width = bitmap.width.toFloat()
        val height = bitmap.height.toFloat()

        // 1. Semi-transparent bottom banner (rgba(2, 6, 23, 0.88))
        val bannerHeight = max(60f, height * 0.22f)
        val bannerPaint = Paint().apply {
            color = Color.argb((255 * 0.88).toInt(), 2, 6, 23)
            style = Paint.Style.FILL
        }
        canvas.drawRect(0f, height - bannerHeight, width, height, bannerPaint)

        // 2. Gold line separator (#f59e0b)
        val goldPaint = Paint().apply {
            color = Color.parseColor("#f59e0b")
            style = Paint.Style.FILL
        }
        canvas.drawRect(0f, height - bannerHeight, width, height - bannerHeight + 4f, goldPaint)

        // 3. Text in banner
        val titleSize = max(14f, width * 0.026f)
        val subSize = max(11f, width * 0.020f)

        val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            textSize = titleSize
            typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
        }
        val subPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#93c5fd")
            textSize = subSize
            typeface = Typeface.create(Typeface.MONOSPACE, Typeface.NORMAL)
        }

        val paddingLeft = 16f
        val line1Y = height - bannerHeight + titleSize + 8f
        val line2Y = line1Y + subSize + 8f
        val line3Y = line2Y + subSize + 8f

        canvas.drawText(spec.title, paddingLeft, line1Y, textPaint)
        canvas.drawText("Operator: ${spec.operator} | Lokasi: ${spec.warehouse}", paddingLeft, line2Y, subPaint)
        canvas.drawText("Waktu: ${spec.timestamp} | Barcode: ${spec.barcode}", paddingLeft, line3Y, subPaint)

        // 4. Red QC Anti-Fraud Stamp Badge on top right
        val badgeWidth = max(160f, width * 0.25f)
        val badgeHeight = max(32f, height * 0.06f)
        val badgeRight = width - 16f
        val badgeLeft = badgeRight - badgeWidth
        val badgeTop = 16f
        val badgeBottom = badgeTop + badgeHeight

        val badgeBgPaint = Paint().apply {
            color = Color.argb((255 * 0.90).toInt(), 220, 38, 38)
            style = Paint.Style.FILL
        }
        canvas.drawRect(badgeLeft, badgeTop, badgeRight, badgeBottom, badgeBgPaint)

        val badgeTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            textSize = max(11f, badgeHeight * 0.45f)
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            textAlign = Paint.Align.CENTER
        }
        canvas.drawText(spec.badge, (badgeLeft + badgeRight) / 2f, badgeTop + (badgeHeight + badgeTextPaint.textSize) / 2f - 2f, badgeTextPaint)

        return bitmap
    }
}
