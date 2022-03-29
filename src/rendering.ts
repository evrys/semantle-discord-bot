

export function renderPercentile(percentile: number | undefined) {
  if (percentile === 1000) {
    return "FOUND!"
  } else if (percentile != null) {
    const blocks = Math.round((percentile / 1000) * 10)
    return `${percentile.toString().padStart(4, ' ')}/1000 ` + "🟩".repeat(blocks) + "⬛".repeat(10 - blocks)
  } else {
    return "(cold)"
  }
}

export function renderDuration(duration: number): string {
  const hours = duration / 1000 / 3600
  const leftoverMinutes = (hours - Math.floor(hours)) * 60
  return `${Math.floor(hours)}h${Math.floor(leftoverMinutes)}m`
}
