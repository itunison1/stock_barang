package com.unison.stockopname.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

@Composable
fun StockOpnameTheme(content: @Composable () -> Unit) {
    val isDark = isSystemInDarkTheme()

    val colorScheme = if (isDark) {
        darkColorScheme(
            primary = Accent,
            onPrimary = TextPrimary,
            primaryContainer = AccentDark,
            onPrimaryContainer = TextPrimary,
            secondary = ChartPurple,
            background = BgDark,
            onBackground = TextPrimary,
            surface = Surface,
            onSurface = TextPrimary,
            surfaceVariant = SurfaceVariant,
            onSurfaceVariant = TextMuted,
            outline = Outline,
            error = StatusError,
            onError = TextPrimary,
        )
    } else {
        lightColorScheme(
            primary = Accent,
            onPrimary = androidx.compose.ui.graphics.Color.White,
            primaryContainer = AccentDark,
            onPrimaryContainer = androidx.compose.ui.graphics.Color.White,
            secondary = ChartPurple,
            background = BgDark,
            onBackground = TextPrimary,
            surface = Surface,
            onSurface = TextPrimary,
            surfaceVariant = SurfaceVariant,
            onSurfaceVariant = TextMuted,
            outline = Outline,
            error = StatusError,
            onError = androidx.compose.ui.graphics.Color.White,
        )
    }

    val view = LocalView.current
    if (!view.isInEditMode) {
        val bgColorArgb = BgDark.toArgb()
        val window = (view.context as? android.app.Activity)?.window
        window?.let {
            it.statusBarColor = bgColorArgb
            it.navigationBarColor = bgColorArgb
            WindowCompat.getInsetsController(it, view).isAppearanceLightStatusBars = !isDark
            WindowCompat.getInsetsController(it, view).isAppearanceLightNavigationBars = !isDark
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = StockOpnameTypography,
        shapes = StockOpnameShapes,
        content = content
    )
}