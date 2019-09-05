const mortice = require('../../')

async function read (muxex, index, timeout = 0) {
  const release = await muxex.readLock()
  await new Promise((resolve) => {
    console.info(`read ${index}`)

    setTimeout(() => {
      console.info('read 1 complete')
      resolve()
    }, timeout)
  })

  release()
}

async function write (muxex, index, timeout = 0) {
  const release = await muxex.writeLock()

  await new Promise((resolve) => {
    console.info(`write ${index}`)

    setTimeout(() => {
      resolve()
    }, timeout)
  })

  release()
}

async function run () {
  const mutex = mortice()

  // read should complete before write
  read(mutex, 1, 500)
  write(mutex, 1)
}

run()
  .then(() => {})
