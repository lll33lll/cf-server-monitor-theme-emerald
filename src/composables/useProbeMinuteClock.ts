import { onScopeDispose, ref } from 'vue'

const clock = ref(Math.floor(Date.now() / 60_000) * 60_000)
let users = 0
let timer: ReturnType<typeof setInterval> | null = null

/** One shared minute boundary for every card/list: switching view cannot change bucket phase. */
export function useProbeMinuteClock() {
  clock.value = Math.floor(Date.now() / 60_000) * 60_000
  users++
  timer ??= setInterval(() => {
    clock.value = Math.floor(Date.now() / 60_000) * 60_000
  }, 1000)
  onScopeDispose(() => {
    users--
    if (!users && timer !== null) {
      clearInterval(timer)
      timer = null
    }
  })
  return clock
}
