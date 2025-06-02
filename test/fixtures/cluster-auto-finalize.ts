import cluster from 'cluster'
import { pEvent } from 'p-event'
import mortice from '../../src/index.js'
import { lock } from './lock.js'

async function run (): Promise<void> {
  const mutex = mortice({
    autoFinalize: true
  })
  const counts = {
    read: 0,
    write: 0
  }
  const result: string[] = []

  if (cluster.isPrimary) {
    const mutex2 = mortice({
      autoFinalize: true
    })

    if (mutex !== mutex2) {
      console.info('"Mutex was different"') // eslint-disable-line no-console
      return
    }

    cluster.on('message', (worker, message) => {
      void Promise.resolve()
        .then(async () => {
          if (message.type === 'done') {
            worker.kill()

            if (mutex.queue == null) {
              throw new Error('No queue')
            }

            await pEvent(mutex.queue, 'idle')

            const mutex3 = mortice({
              autoFinalize: true
            })

            if (mutex === mutex3) {
              console.info('"Mutex was not different"') // eslint-disable-line no-console
              return
            }

            console.info(JSON.stringify(message.result)) // eslint-disable-line no-console
          }
        })
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
        timeout: 500
      })
    ]

    controller.abort()

    await Promise.all(p)

    // @ts-expect-error only available in worker threads
    process.send({ type: 'done', result })
  }
}

void run()
