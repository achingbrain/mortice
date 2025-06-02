import delay from 'delay'
import type { Mortice } from '../../src/index.js'

export interface Counts {
  read: number
  write: number
}

export async function lock (type: 'read' | 'write', mutex: Mortice, counts: Counts, result: string[], timeout = 0, signal?: AbortSignal): Promise<void> {
  counts[type]++
  const index = counts[type]

  result.push(`${type} ${index} waiting`)

  try {
    const release = await mutex[`${type}Lock`]({
      signal
    })

    result.push(`${type} ${index} start`)

    if (timeout > 0) {
      await delay(timeout)
    }

    result.push(`${type} ${index} complete`)

    release()
  } catch (err: any) {
    result.push(`${type} ${index} error ${err.message}`)
  }
}
