const mortice = require('../../')

const mutex = mortice()

mutex.readLock(() => {
  return new Promise((resolve, reject) => {
    console.info('read 1')

    setTimeout(() => {
      console.info('read 1 complete')
      resolve()
    }, 500)
  })
})

mutex.writeLock(() => {
  return new Promise((resolve, reject) => {
    console.info('write 1')

    resolve()
  })
})
