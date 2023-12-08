import { expect } from 'aegir/chai'
import mortice, { type Mortice } from '../src/index.js'
import { lock } from './fixtures/lock.js'

describe('mortice', () => {
  it('executes locks in correct order', async () => {
    const mutex = mortice()
    const result: string[] = []
    const counts = {
      read: 0,
      write: 0
    }

    // queue up read/write requests, the third read should block the second write
    void lock('write', mutex, counts, result)
    void lock('read', mutex, counts, result)
    void lock('read', mutex, counts, result)
    void lock('read', mutex, counts, result, 500)
    void lock('write', mutex, counts, result)
    await lock('read', mutex, counts, result)

    expect(result).to.deep.equal([
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

  it('executes read then waits to start write', async () => {
    const mutex = mortice()
    const result: string[] = []
    const counts = {
      read: 0,
      write: 0
    }

    // read should complete before write starts
    void lock('read', mutex, counts, result, 500)
    await lock('write', mutex, counts, result)

    expect(result).to.deep.equal([
      'read 1 waiting',
      'write 1 waiting',
      'read 1 start',
      'read 1 complete',
      'write 1 start',
      'write 1 complete'
    ])
  })

  it('continues processing after error', async () => {
    const mutex = mortice()
    const result: string[] = []

    async function read (muxex: Mortice): Promise<void> {
      const release = await muxex.readLock()

      try {
        result.push('read 1')

        throw new Error('err')
      } finally {
        release()
      }
    }

    async function write (muxex: Mortice): Promise<void> {
      const release = await muxex.writeLock()

      await new Promise<void>((resolve) => {
        result.push('write 1')

        resolve()
      })

      release()
    }

    // read should complete before write
    void read(mutex).catch(() => {})
    await write(mutex)

    expect(result).to.deep.equal([
      'read 1',
      'write 1'
    ])
  })
})
