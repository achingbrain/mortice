import delay from 'delay'
import type { Mortice } from '../../src/index.js'

export interface Counts {
  read: number
  write: number
}

export interface LockOptions {
  timeout?: number
  signal?: AbortSignal
  finalize?: boolean
}

export async function lock (type: 'read' | 'write', mutex: Mortice, counts: Counts, result: string[], options: LockOptions = {}): Promise<void> {
  counts[type]++
  const index = counts[type]

  result.push(`${type} ${index} waiting`)

  try {
    const release = await mutex[`${type}Lock`](options)

    result.push(`${type} ${index} start`)

    if (options.timeout != null && options.timeout > 0) {
      await delay(options.timeout)
    }

    result.push(`${type} ${index} complete`)

    release()

    if (options.finalize === true) {
      mutex.finalize()
      result.push(`${type} ${index} finalize`)
      await delay(10)
    }
  } catch (err: any) {
    result.push(`${type} ${index} error ${err.message}`)
  }
}
