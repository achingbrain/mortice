import cluster from 'node:cluster'
import mortice from '../../src/index.js'
import { lock } from './lock.js'

async function run (): Promise<void> {
  const mutex = mortice({
    singleProcess: true
  })
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
    // queue up read/write requests, the third read should block the second write
    void lock('write', mutex, counts, result)
    void lock('read', mutex, counts, result)
    void lock('read', mutex, counts, result)
    void lock('read', mutex, counts, result, {
      timeout: 500
    })
    void lock('write', mutex, counts, result)
    await lock('read', mutex, counts, result)

    // @ts-expect-error only available in worker threads
    process.send({ type: 'done', result })
  }
}

void run()
