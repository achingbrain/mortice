import type { Mortice, MorticeOptions } from './index.js'

export interface MorticeImplementation {
  isWorker: boolean
  readLock(name: string, options: MorticeOptions): Mortice['readLock']
  writeLock(name: string, options: MorticeOptions): Mortice['writeLock']
}

export type RequestType = 'requestReadLock' | 'requestWriteLock'
export type AbortRequestType = 'abortReadLockRequest' | 'abortWriteLockRequest'
