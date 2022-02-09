import delay from 'delay'
import type { Mortice } from '../../src'

export interface Counts {
  read: number
  write: number
}

export async function lock (type: 'read' | 'write', muxex: Mortice, counts: Counts, result: string[], timeout = 0) {
  counts[type]++
  const index = counts[type]

  result.push(`${type} ${index} waiting`)

  const release = await muxex[`${type}Lock`]()

  result.push(`${type} ${index} start`)

  if (timeout > 0) {
    await delay(timeout)
  }

  result.push(`${type} ${index} complete`)

  release()
}
