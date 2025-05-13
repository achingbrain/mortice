/**
 * @packageDocumentation
 *
 * - Reads occur concurrently
 * - Writes occur one at a time
 * - No reads occur while a write operation is in progress
 * - Locks can be created with different names
 * - Reads/writes can time out
 *
 * @example
 *
 * ```javascript
 * import mortice from 'mortice'
 * import delay from 'delay'
 *
 * // the lock name & options objects are both optional
 * const mutex = mortice()
 *
 * Promise.all([
 *   (async () => {
 *     const release = await mutex.readLock()
 *
 *     try {
 *       console.info('read 1')
 *     } finally {
 *       release()
 *     }
 *   })(),
 *   (async () => {
 *     const release = await mutex.readLock()
 *
 *     try {
 *       console.info('read 2')
 *     } finally {
 *       release()
 *     }
 *   })(),
 *   (async () => {
 *     const release = await mutex.writeLock()
 *
 *     try {
 *       await delay(1000)
 *
 *       console.info('write 1')
 *     } finally {
 *       release()
 *     }
 *   })(),
 *   (async () => {
 *     const release = await mutex.readLock()
 *
 *     try {
 *       console.info('read 3')
 *     } finally {
 *       release()
 *     }
 *   })()
 * ])
 * ```
 *
 *     read 1
 *     read 2
 *     <small pause>
 *     write 1
 *     read 3
 *
 * ## Browser
 *
 * Because there's no global way to eavesdrop on messages sent by Web Workers,
 * please pass all created Web Workers to the [`observable-webworkers`](https://npmjs.org/package/observable-webworkers)
 * module:
 *
 * ```javascript
 * // main.js
 * import mortice from 'mortice'
 * import observe from 'observable-webworkers'
 *
 * // create our lock on the main thread, it will be held here
 * const mutex = mortice()
 *
 * const worker = new Worker('worker.js')
 *
 * observe(worker)
 * ```
 *
 * ```javascript
 * // worker.js
 * import mortice from 'mortice'
 * import delay from 'delay'
 *
 * const mutex = mortice()
 *
 * let release = await mutex.readLock()
 * // read something
 * release()
 *
 * release = await mutex.writeLock()
 * // write something
 * release()
 * ```
 */

import { AbortError } from 'abort-error'
import PQueue from 'p-queue'
import impl from './node.js'
import type { AbortOptions } from 'abort-error'

export interface MorticeOptions {
  /**
   * An optional name for the lock
   */
  name?: string

  /**
   * How many read operations are executed concurrently
   *
   * @default Infinity
   */
  concurrency?: number

  /**
   * By default the the lock will be held on the main thread and child/worker
   * processes will coordinate to share the lock.
   *
   * Set this to true if each main/child/worker thread should maintain it's own
   * lock with no coordination between them.
   *
   * @default false
   */
  singleProcess?: boolean
}

export interface Mortice {
  readLock(options?: AbortOptions): Promise<Release>
  writeLock(options?: AbortOptions): Promise<Release>
}

export interface Release {
  (): void
}

const mutexes: Record<string, Mortice> = {}
let implementation: any

async function createReleaseable (queue: PQueue, options?: AbortOptions): Promise<Release> {
  let res: (release: Release) => void
  let rej: (err: Error) => void

  const p = new Promise<Release>((resolve, reject) => {
    res = resolve
    rej = reject
  })

  const listener = (): void => {
    rej(new AbortError())
  }

  options?.signal?.addEventListener('abort', listener, {
    once: true
  })

  queue.add(async () => {
    await new Promise<void>((resolve) => {
      res(() => {
        options?.signal?.removeEventListener('abort', listener)
        resolve()
      })
    })
  }, {
    signal: options?.signal
  })
    .catch((err) => {
      rej(err)
    })

  return p
}

const createMutex = (name: string, options: Required<MorticeOptions>): Mortice => {
  if (implementation.isWorker === true) {
    return {
      readLock: implementation.readLock(name, options),
      writeLock: implementation.writeLock(name, options)
    }
  }

  const masterQueue = new PQueue({ concurrency: 1 })
  let readQueue: PQueue | null

  return {
    async readLock (opts?: AbortOptions) {
      // If there's already a read queue, just add the task to it
      if (readQueue != null) {
        return createReleaseable(readQueue, opts)
      }

      // Create a new read queue
      readQueue = new PQueue({
        concurrency: options.concurrency,
        autoStart: false
      })
      const localReadQueue = readQueue

      // Add the task to the read queue
      const readPromise = createReleaseable(readQueue, opts)

      void masterQueue.add(async () => {
        // Start the task only once the master queue has completed processing
        // any previous tasks
        localReadQueue.start()

        // Once all the tasks in the read queue have completed, remove it so
        // that the next read lock will occur after any write locks that were
        // started in the interim
        await localReadQueue.onIdle()
          .then(() => {
            if (readQueue === localReadQueue) {
              readQueue = null
            }
          })
      })

      return readPromise
    },
    async writeLock (opts?: AbortOptions) {
      // Remove the read queue reference, so that any later read locks will be
      // added to a new queue that starts after this write lock has been
      // released
      readQueue = null

      return createReleaseable(masterQueue, opts)
    }
  }
}

const defaultOptions = {
  name: 'lock',
  concurrency: Infinity,
  singleProcess: false
}

interface EventData {
  name: string
  handler(): Promise<void>
}

export default function createMortice (options?: MorticeOptions): Mortice {
  const opts: Required<MorticeOptions> = Object.assign({}, defaultOptions, options)

  if (implementation == null) {
    implementation = impl(opts)

    if (implementation.isWorker !== true) {
      // we are master, set up worker requests
      implementation.addEventListener('requestReadLock', (event: MessageEvent<EventData>) => {
        const mutexName = event.data.name

        if (mutexes[mutexName] == null) {
          return
        }

        const abortController = new AbortController()

        const abortListener = (event: MessageEvent<EventData>): void => {
          if (event.data.name !== mutexName) {
            return
          }

          abortController.abort()
        }

        implementation.addEventListener('abortReadLockRequest', abortListener)

        void mutexes[mutexName].readLock({
          signal: abortController.signal
        })
          .then(async release => event.data.handler()
            .finally(() => {
              release()
            })
          )
          .finally(() => {
            implementation.removeEventListener('abortReadLockRequest', abortListener)
          })
      })

      implementation.addEventListener('requestWriteLock', async (event: MessageEvent<EventData>) => {
        const mutexName = event.data.name

        if (mutexes[mutexName] == null) {
          return
        }

        const abortController = new AbortController()

        const abortListener = (event: MessageEvent<EventData>): void => {
          if (event.data.name !== mutexName) {
            return
          }

          abortController.abort()
        }

        implementation.addEventListener('abortWriteLockRequest', abortListener)

        void mutexes[event.data.name].writeLock({
          signal: abortController.signal
        })
          .then(async release => event.data.handler()
            .finally(() => {
              release()
            })
          )
          .finally(() => {
            implementation.removeEventListener('abortWriteLockRequest', abortListener)
          })
      })
    }
  }

  if (mutexes[opts.name] == null) {
    mutexes[opts.name] = createMutex(opts.name, opts)
  }

  return mutexes[opts.name]
}
