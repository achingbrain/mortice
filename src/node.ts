import cluster from 'cluster'
import { TypedEventEmitter } from 'main-event'
import {
  WORKER_REQUEST_READ_LOCK,
  WORKER_RELEASE_READ_LOCK,
  MASTER_GRANT_READ_LOCK,
  WORKER_REQUEST_WRITE_LOCK,
  WORKER_RELEASE_WRITE_LOCK,
  MASTER_GRANT_WRITE_LOCK,
  WORKER_ABORT_READ_LOCK_REQUEST,
  WORKER_ABORT_WRITE_LOCK_REQUEST,
  MASTER_READ_LOCK_ERROR,
  MASTER_WRITE_LOCK_ERROR,
  MASTER_FINALIZE,
  WORKER_FINALIZE
} from './constants.js'
import { nanoid } from './utils.js'
import type { Mortice, MorticeOptions, Release } from './index.js'
import type { AbortEventData, AbortRequestType, FinalizeEventData, MorticeEvents, RequestEventData, RequestType } from './mortice.js'
import type { AbortOptions } from 'abort-error'
import type { Worker } from 'cluster'
import type { TypedEventTarget } from 'main-event'

interface RequestEvent {
  type: string
  identifier: string
  name: string,
  error?: {
    name: string
    message: string
    stack: string
  }
}

const handleWorkerLockRequest = (emitter: EventTarget, masterEvent: RequestType, abortMasterEvent: AbortRequestType, requestType: string, abortType: string, errorType: string, releaseType: string, grantType: string) => {
  return (worker: Worker, requestEvent: RequestEvent) => {
    if (requestEvent == null) {
      return
    }

    // worker is requesting lock
    if (requestEvent.type === requestType) {
      emitter.dispatchEvent(new MessageEvent<RequestEventData>(masterEvent, {
        data: {
          name: requestEvent.name,
          identifier: requestEvent.identifier,
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
          },
          onError: (err: Error) => {
            // send error to worker
            worker.send({
              type: errorType,
              name: requestEvent.name,
              identifier: requestEvent.identifier,
              error: {
                message: err.message,
                name: err.name,
                stack: err.stack
              }
            })
          }
        }
      }))
    }

    // worker is no longer interested in requesting the lock
    if (requestEvent.type === abortType) {
      emitter.dispatchEvent(new MessageEvent<AbortEventData>(abortMasterEvent, {
        data: {
          name: requestEvent.name,
          identifier: requestEvent.identifier
        }
      }))
    }

    // worker is done with lock
    if (requestEvent.type === WORKER_FINALIZE) {
      emitter.dispatchEvent(new MessageEvent<FinalizeEventData>(MASTER_FINALIZE, {
        data: {
          name: requestEvent.name
        }
      }))
    }
  }
}

class MorticeWorker implements Mortice {
  private name: string

  constructor (name: string) {
    this.name = name
  }

  readLock (options?: AbortOptions): Promise<Release> {
    return this.sendRequest(
      WORKER_REQUEST_READ_LOCK,
      WORKER_ABORT_READ_LOCK_REQUEST,
      MASTER_GRANT_READ_LOCK,
      MASTER_READ_LOCK_ERROR,
      WORKER_RELEASE_READ_LOCK,
      options
    )
  }

  writeLock (options?: AbortOptions): Promise<Release> {
    return this.sendRequest(
      WORKER_REQUEST_WRITE_LOCK,
      WORKER_ABORT_WRITE_LOCK_REQUEST,
      MASTER_GRANT_WRITE_LOCK,
      MASTER_WRITE_LOCK_ERROR,
      WORKER_RELEASE_WRITE_LOCK,
      options
    )
  }

  finalize (): void {
    if (process.send == null) {
      throw new Error('No send method on process - are we a cluster worker?')
    }

    process.send({
      type: WORKER_FINALIZE,
      identifier: nanoid(),
      name: this.name
    })
  }

  private async sendRequest (requestType: string, abortType: string, grantType: string, errorType: string, releaseType: string, options?: AbortOptions): Promise<Release> {
    options?.signal?.throwIfAborted()

    const id = nanoid()

    if (process.send == null) {
      throw new Error('No send method on process - are we a cluster worker?')
    }

    process.send({
      type: requestType,
      identifier: id,
      name: this.name
    })

    return new Promise<Release>((resolve, reject) => {
      const abortListener = (): void => {
        process.send?.({
          type: abortType,
          identifier: id,
          name: this.name
        })
      }

      options?.signal?.addEventListener('abort', abortListener, {
        once: true
      })

      const listener = (event: RequestEvent): void => {
        if (event.identifier !== id) {
          return
        }

        if (event.type === grantType) {
          process.removeListener('message', listener)
          options?.signal?.removeEventListener('abort', abortListener)

          // lock granted
          resolve(() => {
            // release lock
            process.send?.({
              type: releaseType,
              identifier: id,
              name: this.name
            })
          })
        }

        if (event.type === errorType) {
          process.removeListener('message', listener)
          options?.signal?.removeEventListener('abort', abortListener)

          // error while waiting for grant of lock
          const err = new Error()

          if (event.error != null) {
            err.message = event.error.message
            err.name = event.error.name
            err.stack = event.error.stack
          }

          reject(err)
        }
      }

      process.on('message', listener)
    })
  }
}

export default (options: Required<MorticeOptions>): Mortice | TypedEventTarget<MorticeEvents> => {
  if (cluster.isPrimary || options.singleProcess) {
    const emitter = new TypedEventEmitter()

    cluster.on('message', handleWorkerLockRequest(
      emitter,
      'requestReadLock',
      'abortReadLockRequest',
      WORKER_REQUEST_READ_LOCK,
      WORKER_ABORT_READ_LOCK_REQUEST,
      MASTER_READ_LOCK_ERROR,
      WORKER_RELEASE_READ_LOCK,
      MASTER_GRANT_READ_LOCK
    ))
    cluster.on('message', handleWorkerLockRequest(
      emitter,
      'requestWriteLock',
      'abortWriteLockRequest',
      WORKER_REQUEST_WRITE_LOCK,
      WORKER_ABORT_WRITE_LOCK_REQUEST,
      MASTER_WRITE_LOCK_ERROR,
      WORKER_RELEASE_WRITE_LOCK,
      MASTER_GRANT_WRITE_LOCK
    ))

    return emitter
  }

  return new MorticeWorker(options.name)
}
