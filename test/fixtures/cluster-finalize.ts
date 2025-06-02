import cluster from 'cluster'
import mortice from '../../src/index.js'
import { lock } from './lock.js'

async function run (): Promise<void> {
  const mutex = mortice()
  const counts = {
    read: 0,
    write: 0
  }
  const result: string[] = []

  if (cluster.isPrimary) {
    const mutex2 = mortice()

    if (mutex !== mutex2) {
      throw new Error('Mutex was different')
    }

    cluster.on('message', (worker, message) => {
      if (message.type === 'done') {
        worker.kill()

        const mutex3 = mortice()

        if (mutex === mutex3) {
          throw new Error('Mutex was not different')
        }

        console.info(JSON.stringify(message.result)) // eslint-disable-line no-console
      }
    })

    cluster.fork()
  } else {
    const controller = new AbortController()

    // queue up requests, the second should abort and the third should continue
    const p = [
      lock('write', mutex, counts, result, {
        timeout: 500
      }),
      lock('write', mutex, counts, result, {
        timeout: 500
      }),
      lock('write', mutex, counts, result, {
        timeout: 500,
        finalize: true
      })
    ]

    controller.abort()

    await Promise.all(p)

    // @ts-expect-error only available in worker threads
    process.send({ type: 'done', result })
  }
}

void run()
