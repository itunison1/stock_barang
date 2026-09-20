package com.unison.stockopname.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.unison.stockopname.ui.theme.*

private fun statusColorOf(status: String): Color {
    val s = status.lowercase()
    return when {
        "run" in s -> StatusRunning
        "stop" in s -> StatusStopped
        "error" in s -> StatusError
        "warning" in s -> StatusWarning
        else -> StatusOffline
    }
}

@Composable
fun StatusBadge(status: String) {
    val color = statusColorOf(status)
    Text(
        text = status.uppercase(),
        style = MaterialTheme.typography.labelSmall,
        color = color,
        fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(color.copy(alpha = 0.15f))
            .padding(horizontal = 8.dp, vertical = 4.dp)
    )
}

@Composable
fun PulsingDot(color: Color, size: androidx.compose.ui.unit.Dp, pulsing: Boolean) {
    val scale by animateFloatAsState(
        targetValue = if (pulsing) 1.3f else 1f,
        animationSpec = tween(durationMillis = 700),
        label = "pulse"
    )
    Box(
        Modifier
            .size(size)
            .scale(scale)
            .clip(CircleShape)
            .background(color)
    )
}