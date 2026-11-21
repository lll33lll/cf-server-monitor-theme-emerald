import { onScopeDispose, ref } from 'vue'

// Match LuminaPlus's shared clock: retain the actual initial instant, then refresh at minute+25ms.
const clock = ref(Date.now())
let minute = Math.floor(clock.value / 60_000)
let users = 0
let timer: ReturnType<typeof setTimeout> | null = null

function refresh() {
  const now = Date.now()
  const bucket = Math.floor(now / 60_000)
  if (bucket !== minute) {
    minute = bucket
    clock.value = now
  }
}

function schedule() {
  if (timer !== null || !users)
    return
  timer = setTimeout(() => {
    timer = null
    refresh()
    schedule()
  }, 60_000 - Date.now() % 60_000 + 25)
}

export function useProbeMinuteClock() {
  refresh()
  users++
  schedule()
  onScopeDispose(() => {
    users--
    if (!users && timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  })
  return clock
}
