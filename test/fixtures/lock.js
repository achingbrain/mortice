const lock = require('../../')

const mutext = lock()

mutext.writeLock(() => {
  return new Promise((resolve, reject) => {
    console.info('write 1')

    resolve()
  })
})

mutext.readLock(() => {
  return new Promise((resolve, reject) => {
    console.info('read 1')

    resolve()
  })
})

mutext.readLock(() => {
  return new Promise((resolve, reject) => {
    console.info('read 2')

    resolve()
  })
})

mutext.readLock(() => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.info('read 3')

      resolve()
    }, 500)
  })
})

mutext.writeLock(() => {
  return new Promise((resolve, reject) => {
    console.info('write 2')

    resolve()
  })
})

mutext.readLock(() => {
  return new Promise((resolve, reject) => {
    console.info('read 4')

    resolve()
  })
})
