import { Worker } from 'node:worker_threads'
import { expect } from 'aegir/chai'
import { isNode, isElectronMain } from 'wherearewe'
import mortice from '../src/index.js'
import type { Mortice } from '../src/index.js'

interface ResultEvent {
  type: 'done'
  result: string[]
}

interface LogEvent {
  type: 'log'
  message: string
}

interface ErrorEvent {
  type: 'error'
  error: { message: string, stack: string }
}

type WorkerEvent = ResultEvent | LogEvent | ErrorEvent

async function runWorker (path: string): Promise<string[]> {
  return new Promise<string[]>((resolve, reject) => {
    const worker = new Worker(path)

    worker.on('message', (event: WorkerEvent) => {
      if (event.type === 'log') {
        console.info(event.message) // eslint-disable-line no-console
      }

      if (event.type === 'error') {
        worker.terminate()

        const err = new Error(event.error.message)
        err.stack = event.error.stack

        reject(err)
      }

      if (event.type === 'done') {
        worker.terminate()
          .then(() => {
            resolve(event.result)
          })
          .catch(err => {
            reject(err)
          })
      }
    })
  })
}

describe('worker threads', function () {
  if (!isNode && !isElectronMain) {
    return it.skip('cluster tests only run on node')
  }

  // hold lock in main thread
  let mutex: Mortice

  beforeEach(() => {
    mutex = mortice()
  })

  afterEach(() => {
    mutex?.finalize()
  })

  it('execute locks in correct order', async () => {
    await expect(runWorker('./dist/test/fixtures/worker.js')).to.eventually.deep.equal([
      'write 1 waiting',
      'read 1 waiting',
      'read 2 waiting',
      'read 3 waiting',
      'write 2 waiting',
      'read 4 waiting',
      'write 1 start',
      'write 1 complete',
      'read 1 start',
      'read 1 complete',
      'read 2 start',
      'read 2 complete',
      'read 3 start',
      'read 3 complete',
      'write 2 start',
      'write 2 complete',
      'read 4 start',
      'read 4 complete'
    ])
  })

  it('execute locks in correct order in a single thread', async () => {
    await expect(runWorker('./dist/test/fixtures/worker-single-thread.js')).to.eventually.deep.equal([
      'write 1 waiting',
      'read 1 waiting',
      'read 2 waiting',
      'read 3 waiting',
      'write 2 waiting',
      'read 4 waiting',
      'write 1 start',
      'write 1 complete',
      'read 1 start',
      'read 1 complete',
      'read 2 start',
      'read 2 complete',
      'read 3 start',
      'read 3 complete',
      'write 2 start',
      'write 2 complete',
      'read 4 start',
      'read 4 complete'
    ])
  })

  it('aborts a lock across worker threads', async () => {
    await expect(runWorker('./dist/test/fixtures/worker-abort.js')).to.eventually.deep.equal([
      'write 1 waiting',
      'write 2 waiting',
      'write 3 waiting',
      'write 1 start',
      'write 2 error The operation was aborted',
      'write 1 complete',
      'write 3 start',
      'write 3 complete'
    ])
  })

  it('finalizes a lock across worker threads', async () => {
    const mutex2 = mortice()

    if (mutex !== mutex2) {
      throw new Error('Mutex was different')
    }

    await expect(runWorker('./dist/test/fixtures/worker-finalize.js')).to.eventually.deep.equal([
      'write 1 waiting',
      'write 2 waiting',
      'write 3 waiting',
      'write 1 start',
      'write 1 complete',
      'write 2 start',
      'write 2 complete',
      'write 3 start',
      'write 3 complete',
      'write 3 finalize'
    ])

    const mutex3 = mortice()

    if (mutex === mutex3) {
      throw new Error('Mutex was not different')
    }
  })
})
