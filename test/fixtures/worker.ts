import mortice from '../../src/index.js'
import { lock } from './lock.js'

async function run (): Promise<string[]> {
  const mutex = mortice()
  const counts = {
    read: 0,
    write: 0
  }
  const result: string[] = []

  void lock('write', mutex, counts, result)
  void lock('read', mutex, counts, result)
  void lock('read', mutex, counts, result)
  void lock('read', mutex, counts, result, 500)
  void lock('write', mutex, counts, result)
  await lock('read', mutex, counts, result)

  return result
}

run().then((result: string[] = []) => {
  globalThis.postMessage({
    type: 'done',
    result
  })
}, err => {
  globalThis.postMessage({
    type: 'error',
    error: {
      message: err.message,
      stack: err.stack
    }
  })
})

export {}
