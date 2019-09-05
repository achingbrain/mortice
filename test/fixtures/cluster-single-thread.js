const cluster = require('cluster')
const mortice = require('../../')

async function read (muxex, index, timeout = 0) {
  const release = await muxex.readLock()
  await new Promise((resolve) => {
    console.info(`read ${index}`)

    setTimeout(() => {
      resolve()

      if (index === 4) {
        process.send('done')
      }
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
  const mutex = mortice({
    singleProcess: true
  })

  if (cluster.isMaster) {
    cluster.on('message', (worker, message) => {
      if (message === 'done') {
        worker.kill()
      }
    })

    cluster.fork()
  } else {
    // queue up read/write requests, the third read should block the second write
    write(mutex, 1)
    read(mutex, 1)
    read(mutex, 2)
    read(mutex, 3, 500)
    write(mutex, 2)
    read(mutex, 4)
  }
}

run()
  .then(() => {})
