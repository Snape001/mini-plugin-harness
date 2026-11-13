export function backoffMs(attempt) {
  return attempt * 100
}
