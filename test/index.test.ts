import { expect } from 'aegir/chai'
import delay from 'delay'
import mortice from '../src/index.js'
import { lock } from './fixtures/lock.js'
import type { Mortice } from '../src/index.js'

describe('mortice', () => {
  it('executes write', async () => {
    const mutex = mortice()
    const result: string[] = []
    const counts = {
      read: 0,
      write: 0
    }

    await lock('write', mutex, counts, result)

    expect(result).to.deep.equal([
      'write 1 waiting',
      'write 1 start',
      'write 1 complete'
    ])
  })

  it('executes read', async () => {
    const mutex = mortice()
    const result: string[] = []
    const counts = {
      read: 0,
      write: 0
    }

    await lock('read', mutex, counts, result)

    expect(result).to.deep.equal([
      'read 1 waiting',
      'read 1 start',
      'read 1 complete'
    ])
  })

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
    void lock('read', mutex, counts, result, {
      timeout: 500
    })
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
      'read 3 delay 500ms',
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
    void lock('read', mutex, counts, result, {
      timeout: 500
    })
    await lock('write', mutex, counts, result)

    expect(result).to.deep.equal([
      'read 1 waiting',
      'write 1 waiting',
      'read 1 start',
      'read 1 delay 500ms',
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

  it('times out acquiring a read lock', async () => {
    const mutex = mortice({
      name: 'timeout-read'
    })

    void Promise.resolve().then(async () => {
      const release = await mutex.writeLock()

      try {
        await new Promise(() => {})
      } finally {
        release()
      }
    })

    await delay(10)

    await expect(mutex.readLock({
      signal: AbortSignal.timeout(100)
    })).to.eventually.be.rejected
      .with.property('name', 'AbortError')
  })

  it('times out acquiring a write lock', async () => {
    const mutex = mortice({
      name: 'timeout-write'
    })

    void Promise.resolve().then(async () => {
      const release = await mutex.readLock()

      try {
        await new Promise(() => {})
      } finally {
        release()
      }
    })

    await delay(10)

    await expect(mutex.writeLock({
      signal: AbortSignal.timeout(100)
    })).to.eventually.be.rejected
      .with.property('name', 'AbortError')
  })

  it('removes aborted lock requests that are queued', async () => {
    const mutex = mortice({
      name: 'remove-lock-request'
    })

    const result: string[] = []
    const counts = {
      read: 0,
      write: 0
    }

    const controller = new AbortController()

    void lock('write', mutex, counts, result, {
      timeout: 500
    })
    void lock('write', mutex, counts, result, {
      timeout: 500,
      signal: controller.signal
    }).catch(() => {})
    void lock('write', mutex, counts, result, {
      timeout: 500
    })

    expect(mutex.queue?.size).to.equal(3)
    controller.abort()
    // not long enough for the first lock to be released
    await delay(10)
    expect(mutex.queue?.size).to.equal(2)
  })

  it('removes mutex from the global state', () => {
    const name = 'clean-up-mutex'
    const mutex1 = mortice({
      name
    })
    const mutex2 = mortice({
      name
    })

    expect(mutex1).to.equal(mutex2)

    mutex1.finalize()

    const mutex3 = mortice({
      name
    })

    expect(mutex1).to.not.equal(mutex3)
  })
})
