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
      timeout: 500
    }),
    lock('write', mutex, counts, result, {
      timeout: 500
    }).catch(() => {}),
    lock('write', mutex, counts, result, {
      timeout: 500,
      finalize: true
    })
  ]

  controller.abort()

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
