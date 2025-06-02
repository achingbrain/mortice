import observer from 'observable-webworkers'
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
  WORKER_FINALIZE
} from './constants.js'
import { nanoid } from './utils.js'
import type { Mortice, MorticeOptions, Release } from './index.js'
import type { AbortRequestType, FinalizeEventData, RequestEventData, RequestType } from './mortice.js'
import type { AbortOptions } from 'abort-error'

const handleWorkerLockRequest = (emitter: EventTarget, masterEvent: RequestType, abortMasterEvent: AbortRequestType, requestType: string, abortType: string, errorType: string, releaseType: string, grantType: string) => {
  return (worker: Worker, event: MessageEvent) => {
    if (event.data == null) {
      return
    }

    const requestEvent = {
      type: event.data.type,
      name: event.data.name,
      identifier: event.data.identifier
    }

    // worker is requesting lock
    if (requestEvent.type === requestType) {
      emitter.dispatchEvent(new MessageEvent<RequestEventData>(masterEvent, {
        data: {
          name: requestEvent.name,
          identifier: requestEvent.identifier,
          handler: async (): Promise<void> => {
            // grant lock to worker
            worker.postMessage({
              type: grantType,
              name: requestEvent.name,
              identifier: requestEvent.identifier
            })

            // wait for worker to finish
            await new Promise<void>((resolve) => {
              const releaseEventListener = (event: MessageEvent): void => {
                if (event?.data == null) {
                  return
                }

                const releaseEvent = {
                  type: event.data.type,
                  name: event.data.name,
                  identifier: event.data.identifier
                }

                if (releaseEvent.type === releaseType && releaseEvent.identifier === requestEvent.identifier) {
                  worker.removeEventListener('message', releaseEventListener)
                  resolve()
                }
              }

              worker.addEventListener('message', releaseEventListener)
            })
          },
          onError: (err: Error) => {
            // send error to worker
            worker.postMessage({
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
      emitter.dispatchEvent(new MessageEvent(abortMasterEvent, {
        data: {
          name: requestEvent.name,
          identifier: requestEvent.identifier
        }
      }))
    }

    // worker is done with lock
    if (requestEvent.type === WORKER_FINALIZE) {
      emitter.dispatchEvent(new MessageEvent<FinalizeEventData>('finalizeRequest', {
        data: {
          name: requestEvent.name
        }
      }))
    }
  }
}

const defaultOptions = {
  singleProcess: false
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
    const id = nanoid()

    globalThis.postMessage({
      type: WORKER_FINALIZE,
      identifier: id,
      name: this.name
    })
  }

  private async sendRequest (requestType: string, abortType: string, grantType: string, errorType: string, releaseType: string, options?: AbortOptions): Promise<Release> {
    options?.signal?.throwIfAborted()
    const id = nanoid()

    globalThis.postMessage({
      type: requestType,
      identifier: id,
      name: this.name
    })

    return new Promise<Release>((resolve, reject) => {
      const abortListener = (): void => {
        globalThis.postMessage({
          type: abortType,
          identifier: id,
          name: this.name
        })
      }

      options?.signal?.addEventListener('abort', abortListener, {
        once: true
      })

      const listener = (event: MessageEvent): void => {
        if (event.data?.identifier !== id) {
          return
        }

        if (event.data?.type === grantType) {
          globalThis.removeEventListener('message', listener)
          options?.signal?.removeEventListener('abort', abortListener)

          // lock granted
          resolve(() => {
            // release lock
            globalThis.postMessage({
              type: releaseType,
              identifier: id,
              name: this.name
            })
          })
        }

        if (event.data.type === errorType) {
          globalThis.removeEventListener('message', listener)
          options?.signal?.removeEventListener('abort', abortListener)

          // error while waiting for grant of lock
          const err = new Error()

          if (event.data.error != null) {
            err.message = event.data.error.message
            err.name = event.data.error.name
            err.stack = event.data.error.stack
          }

          reject(err)
        }
      }

      globalThis.addEventListener('message', listener)
    })
  }
}

export default (options: Required<MorticeOptions>): Mortice | EventTarget => {
  options = Object.assign({}, defaultOptions, options)
  const isPrimary = Boolean(globalThis.document) || options.singleProcess

  if (isPrimary) {
    const emitter = new EventTarget()

    observer.addEventListener('message', handleWorkerLockRequest(
      emitter,
      'requestReadLock',
      'abortReadLockRequest',
      WORKER_REQUEST_READ_LOCK,
      WORKER_ABORT_READ_LOCK_REQUEST,
      MASTER_READ_LOCK_ERROR,
      WORKER_RELEASE_READ_LOCK,
      MASTER_GRANT_READ_LOCK
    ))
    observer.addEventListener('message', handleWorkerLockRequest(
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
