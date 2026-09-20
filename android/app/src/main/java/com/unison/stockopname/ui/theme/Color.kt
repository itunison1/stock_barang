package com.unison.stockopname.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Palet gelap (Deep Navy)
private val DarkBg = Color(0xFF0A0E16)
private val DarkSurface = Color(0xFF131A2A)
private val DarkSurfaceVariant = Color(0xFF161E31)
private val DarkOutline = Color(0xFF232C3F)
private val DarkTextPrimary = Color(0xFFEAF0F7)
private val DarkTextMuted = Color(0xFF8A95A8)

// Palet terang
private val LightBg = Color(0xFFF4F6FB)
private val LightSurface = Color(0xFFFFFFFF)
private val LightSurfaceVariant = Color(0xFFEEF1F8)
private val LightOutline = Color(0xFFE1E6F0)
private val LightTextPrimary = Color(0xFF131A2A)
private val LightTextMuted = Color(0xFF64708A)

val BgDark: Color
    @Composable get() = if (isSystemInDarkTheme()) DarkBg else LightBg

val Surface: Color
    @Composable get() = if (isSystemInDarkTheme()) DarkSurface else LightSurface

val SurfaceVariant: Color
    @Composable get() = if (isSystemInDarkTheme()) DarkSurfaceVariant else LightSurfaceVariant

val Outline: Color
    @Composable get() = if (isSystemInDarkTheme()) DarkOutline else LightOutline

val TextPrimary: Color
    @Composable get() = if (isSystemInDarkTheme()) DarkTextPrimary else LightTextPrimary

val TextMuted: Color
    @Composable get() = if (isSystemInDarkTheme()) DarkTextMuted else LightTextMuted

// Aksen & status (sama di kedua tema)
val Accent = Color(0xFF2563EB)
val AccentDark = Color(0xFF1D4ED8)
val AccentGlow = Color(0x3B2563EB)

val StatusRunning = Color(0xFF22C55E)
val StatusStopped = Color(0xFF64748B)
val StatusWarning = Color(0xFFF59E0B)
val StatusError = Color(0xFFEF4444)
val StatusOffline = Color(0xFF6B7280)

val ChartPurple = Color(0xFFA78BFA)
val ChartCyan = Color(0xFF22D3EE)

val AccentGradientStart = Color(0xFF2563EB)
val AccentGradientEnd = Color(0xFF3B82F6)