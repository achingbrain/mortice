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
    cluster.on('message', (worker, message) => {
      if (message.type === 'done') {
        worker.kill()
        console.info(JSON.stringify(message.result)) // eslint-disable-line no-console
      }
    })

    cluster.fork()
  } else {
    const controller = new AbortController()

    // queue up requests, the second should abort and the third should continue
    const p = [
      lock('write', mutex, counts, result, 500),
      lock('write', mutex, counts, result, 500, controller.signal).catch(() => {}),
      lock('write', mutex, counts, result, 500)
    ]

    controller.abort()

    await Promise.all(p)

    // @ts-expect-error only available in worker threads
    process.send({ type: 'done', result })
  }
}

void run()
