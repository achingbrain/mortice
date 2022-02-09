import { expect } from 'aegir/utils/chai.js'
import observe from 'observable-webworkers'
import type { WebworkerEventListener } from 'observable-webworkers'

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

async function runWorker (path: string) {
  return await new Promise<string[]>((resolve, reject) => {
    const worker = new Worker(path, {
      type: 'module'
    })
    observe(worker)

    const messageListener: WebworkerEventListener<WorkerEvent> = (worker, event) => {
      if (event.data.type === 'log') {
        console.info(event.data.message) // eslint-disable-line no-console
      }

      if (event.data.type === 'error') {
        worker.terminate()

        const err = new Error(event.data.error.message)
        err.stack = event.data.error.stack

        reject(err)
      }

      if (event.data.type === 'done') {
        worker.terminate()

        resolve(event.data.result)
      }
    }

    observe.addEventListener('message', messageListener)
  })
}

describe('webworkers', function () {
  if (globalThis.Worker == null) {
    return it.skip('No worker support in environment')
  }

  it('execute locks in correct order', async () => {
    await expect(runWorker('dist/worker.js')).to.eventually.deep.equal([
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
    await expect(runWorker('dist/worker.js')).to.eventually.deep.equal([
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
})
