import { DEFAULT_PORT } from './config.mjs'

export function resolvePort(value) {
  return Number(value) || DEFAULT_PORT
}
