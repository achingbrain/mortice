import cluster from 'cluster'
import { AbortError } from 'abort-error'
import {
  WORKER_REQUEST_READ_LOCK,
  WORKER_RELEASE_READ_LOCK,
  MASTER_GRANT_READ_LOCK,
  WORKER_REQUEST_WRITE_LOCK,
  WORKER_RELEASE_WRITE_LOCK,
  MASTER_GRANT_WRITE_LOCK,
  WORKER_ABORT_READ_LOCK_REQUEST,
  WORKER_ABORT_WRITE_LOCK_REQUEST
} from './constants.js'
import { nanoid } from './utils.js'
import type { MorticeOptions, Release } from './index.js'
import type { AbortRequestType, MorticeImplementation, RequestType } from './interface.js'
import type { AbortOptions } from 'abort-error'
import type { Worker } from 'cluster'

interface RequestEvent {
  type: string
  identifier: string
  name: string
}

const handleWorkerLockRequest = (emitter: EventTarget, masterEvent: RequestType, abortMasterEvent: AbortRequestType, requestType: string, abortType: string, releaseType: string, grantType: string) => {
  return (worker: Worker, requestEvent: RequestEvent) => {
    if (requestEvent == null) {
      return
    }

    if (requestEvent.type === requestType) {
      emitter.dispatchEvent(new MessageEvent(masterEvent, {
        data: {
          name: requestEvent.name,
          handler: async () => {
            // grant lock to worker
            worker.send({
              type: grantType,
              name: requestEvent.name,
              identifier: requestEvent.identifier
            })

            // wait for worker to finish
            await new Promise<void>((resolve) => {
              const releaseEventListener = (releaseEvent: RequestEvent): void => {
                if (releaseEvent.type === releaseType && releaseEvent.identifier === requestEvent.identifier) {
                  worker.removeListener('message', releaseEventListener)
                  resolve()
                }
              }

              worker.on('message', releaseEventListener)
            })
          }
        }
      }))
    }

    if (requestEvent.type === abortType) {
      // tell worker we are no longer interested in the lock
      worker.send({
        type: abortType,
        name: requestEvent.name,
        identifier: requestEvent.identifier
      })

      emitter.dispatchEvent(new MessageEvent(abortMasterEvent, {
        data: {
          name: requestEvent.name
        }
      }))
    }
  }
}

const makeWorkerLockRequest = (name: string, requestType: string, abortType: string, grantType: string, releaseType: string) => {
  return async (options?: AbortOptions) => {
    options?.signal?.throwIfAborted()

    const id = nanoid()

    if (process.send == null) {
      throw new Error('No send method on process - are we a cluster worker?')
    }

    process.send({
      type: requestType,
      identifier: id,
      name
    })

    return new Promise<Release>((resolve, reject) => {
      const abortListener = (): void => {
        process.send?.({
          type: abortType,
          identifier: id,
          name
        })

        reject(new AbortError())
      }

      options?.signal?.addEventListener('abort', abortListener, {
        once: true
      })

      const listener = (event: RequestEvent): void => {
        if (event.type === grantType && event.identifier === id) {
          process.removeListener('message', listener)
          options?.signal?.removeEventListener('abort', abortListener)

          // grant lock
          resolve(() => {
            if (process.send == null) {
              throw new Error('No send method on process - are we a cluster worker?')
            }

            // release lock
            process.send({
              type: releaseType,
              identifier: id,
              name
            })
          })
        }
      }

      process.on('message', listener)
    })
  }
}

export default (options: Required<MorticeOptions>): MorticeImplementation | EventTarget | undefined => {
  if (cluster.isPrimary || options.singleProcess) {
    const emitter = new EventTarget()

    cluster.on('message', handleWorkerLockRequest(emitter, 'requestReadLock', 'abortReadLockRequest', WORKER_REQUEST_READ_LOCK, WORKER_ABORT_READ_LOCK_REQUEST, WORKER_RELEASE_READ_LOCK, MASTER_GRANT_READ_LOCK))
    cluster.on('message', handleWorkerLockRequest(emitter, 'requestWriteLock', 'abortWriteLockRequest', WORKER_REQUEST_WRITE_LOCK, WORKER_ABORT_WRITE_LOCK_REQUEST, WORKER_RELEASE_WRITE_LOCK, MASTER_GRANT_WRITE_LOCK))

    return emitter
  }

  return {
    isWorker: true,
    readLock: (name) => makeWorkerLockRequest(name, WORKER_REQUEST_READ_LOCK, WORKER_ABORT_READ_LOCK_REQUEST, MASTER_GRANT_READ_LOCK, WORKER_RELEASE_READ_LOCK),
    writeLock: (name) => makeWorkerLockRequest(name, WORKER_REQUEST_WRITE_LOCK, WORKER_ABORT_WRITE_LOCK_REQUEST, MASTER_GRANT_WRITE_LOCK, WORKER_RELEASE_WRITE_LOCK)
  }
}
