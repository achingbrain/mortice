const mortice = require('../../')

const mutex = mortice()

mutex.readLock(() => {
  return new Promise((resolve, reject) => {
    console.info('read 1')

    reject(new Error('err'))
  })
})

mutex.writeLock(() => {
  return new Promise((resolve, reject) => {
    console.info('write 1')

    resolve()
  })
})
