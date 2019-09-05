const mortice = require('../../')
const globalThis = require('globalthis')()

async function read (muxex, index, timeout = 0) {
  const release = await muxex.readLock()
  await new Promise((resolve) => {
    globalThis.postMessage({
      type: 'log',
      message: `read ${index}`
    })

    setTimeout(() => {
      resolve()

      if (index === 4) {
        globalThis.postMessage({
          type: 'done'
        })
      }
    }, timeout)
  })

  release()
}

async function write (muxex, index, timeout = 0) {
  const release = await muxex.writeLock()

  await new Promise((resolve) => {
    globalThis.postMessage({
      type: 'log',
      message: `write ${index}`
    })

    setTimeout(() => {
      resolve()
    }, timeout)
  })

  release()
}

module.exports = (self) => {
  const mutex = mortice({
    singleProcess: true
  })

  write(mutex, 1)
  read(mutex, 1)
  read(mutex, 2)
  read(mutex, 3, 500)
  write(mutex, 2)
  read(mutex, 4)
}
