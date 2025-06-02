import delay from 'delay'
import mortice from '../../src/index.js'
import { lock } from './lock.js'
import { postMessage } from './worker-post-message.js'

async function run (): Promise<string[]> {
  const mutex = mortice()
  const counts = {
    read: 0,
    write: 0
  }
  const result: string[] = []

  const controller = new AbortController()

  // queue up requests, the second should abort and the third should continue
  const p = [
    lock('write', mutex, counts, result, {
      timeout: 2_000
    }),
    lock('write', mutex, counts, result, {
      timeout: 500,
      signal: controller.signal
    }).catch(() => {}),
    lock('write', mutex, counts, result, {
      timeout: 500
    })
  ]

  // wait for first write to delay, then abort controller
  while (true) {
    if (result.includes('write 1 delay 2000ms')) {
      controller.abort()
      break
    }

    await delay(10)
  }

  await Promise.all(p)

  return result
}

run().then((result: string[] = []) => {
  postMessage({
    type: 'done',
    result
  })
}, err => {
  postMessage({
    type: 'error',
    error: {
      message: err.message,
      stack: err.stack
    }
  })
})

export {}
