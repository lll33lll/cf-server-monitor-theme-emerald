export interface ProbeViewport {
  left: number
  top: number
  width: number
  height: number
}

/** Geometry only; clamp the bubble and its arrow to the actual visible viewport. */
export function placeProbeTooltip(
  anchorX: number,
  stripTop: number,
  stripHeight: number,
  bubbleWidth: number,
  bubbleHeight: number,
  viewport: ProbeViewport,
) {
  const inset = 8
  const gap = 7
  const minLeft = viewport.left + inset
  const maxRight = viewport.left + viewport.width - inset
  const minTop = viewport.top + inset
  const maxBottom = viewport.top + viewport.height - inset
  const half = bubbleWidth / 2
  const minCenter = minLeft + half
  const maxCenter = maxRight - half
  const left = minCenter <= maxCenter ? Math.max(minCenter, Math.min(maxCenter, anchorX)) : viewport.left + viewport.width / 2
  const spaceAbove = stripTop - gap - minTop
  const spaceBelow = maxBottom - stripTop - stripHeight - gap
  const below = spaceAbove < bubbleHeight && spaceBelow > spaceAbove
  const wantedTop = below ? stripTop + stripHeight + gap : stripTop - gap - bubbleHeight
  const actualTop = Math.max(minTop, Math.min(maxBottom - bubbleHeight, wantedTop))
  const arrowInset = Math.min(8, half)
  const arrow = Math.max(arrowInset, Math.min(bubbleWidth - arrowInset, anchorX - left + half))
  return { left, top: below ? actualTop : actualTop + bubbleHeight, arrow, below }
}
