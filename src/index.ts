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
 *
 * ## Clean up
 *
 * Mutexes are stored globally reference by name, this is so you can obtain the
 * same lock from different contexts, including workers.
 *
 * When a mutex is no longer required, the `.finalize` function should be called
 * to remove any internal references to it.
 *
 * ```javascript
 * import mortice from 'mortice'
 *
 * const mutex = mortice()
 *
 * // ...some time later
 *
 * mutex.finalize()
 * ```
 */

import { Queue } from 'it-queue'
import { createMutex } from './mortice.ts'
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
  /**
   * Acquire a read lock. Multiple reads will occur simultaneously up to the
   * concurrency limit passed to the constructor.
   */
  readLock(options?: AbortOptions): Promise<Release>

  /**
   * Acquire a write lock. The write lock will wait for any in-flight reads to
   * complete, then prevent any further reads or writes until the lock is
   * released.
   */
  writeLock(options?: AbortOptions): Promise<Release>

  /**
   * Removes this mutex from the global state, after invoking this method it
   * cannot be used any more.
   */
  finalize(): void

  /**
   * If this is the main thread, the state of the read/write queue may be
   * inspected here
   */
  queue?: Queue
}

export interface Release {
  (): void
}

const defaultOptions = {
  name: 'lock',
  concurrency: Infinity,
  singleProcess: false
}

export default function createMortice (options?: MorticeOptions): Mortice {
  const opts: Required<MorticeOptions> = Object.assign({}, defaultOptions, options)

  return createMutex(opts.name, opts)
}
