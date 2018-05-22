const node = require('./node')
const browser = require('./browser')
const Queue = require('p-queue')
const { timeout, TimeoutError } = require('promise-timeout')
const implementation = node || browser

const mutexes = {}

if (!implementation.isWorker) {
  // we are master, set up worker requests
  implementation.on('requestReadLock', (name, fn) => {
    mutexes[name] && mutexes[name].readLock(() => fn())
  })

  implementation.on('requestWriteLock', (name, fn) => {
    mutexes[name] && mutexes[name].writeLock(() => fn())
  })
}

const createMutex = (name, options) => {
  if (implementation.isWorker) {
    return {
      readLock: implementation.readLock(name, options),
      writeLock: implementation.writeLock(name, options)
    }
  }

  const masterQueue = new Queue({concurrency: 1})
  let readQueue = null

  return {
    readLock: fn => {
      if (!readQueue) {
        readQueue = new Queue({
          concurrency: options.concurrency,
          autoStart: false
        })

        const localReadQueue = readQueue

        masterQueue.add(() => {
            localReadQueue.start()

          return localReadQueue.onIdle()
            .then(() => {
              if (readQueue === localReadQueue) {
                readQueue = null
              }
            })
        })
      }

      return readQueue.add(() => fn())
    },
    writeLock: fn => {
      readQueue = null

      return masterQueue.add(() => fn())
    }
  }
}

const defaultOptions = {
  concurrency: Infinity,
  timeout: 600000
}

module.exports = (name, options) => {
  if (!options) {
    options = {}
  }

  if (typeof name === 'object') {
    options = name
    name = 'lock'
  }

  if (!name) {
    name = 'lock'
  }

  options = Object.assign({}, defaultOptions, options)

  if (!mutexes[name]) {
    mutexes[name] = createMutex(name, options)
  }

  return mutexes[name]
}
