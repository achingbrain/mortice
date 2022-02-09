# mortice

[![Build Status](https://github.com/achingbrain/mortice/actions/workflows/js-test-and-release.yml/badge.svg?branch=main)](https://github.com/achingbrain/mortice/actions/workflows/js-test-and-release.yml)

> Isomorphic read/write lock that works in single processes, node clusters and web workers.

## Features

- Reads occur concurrently
- Writes occur one at a time
- No reads occur while a write operation is in progress
- Locks can be created with different names
- Reads/writes can time out

## Install

```sh
$ npm install --save mortice
```

## Usage

```javascript
import mortice from 'mortice'
import delay from 'delay'

// the lock name & options objects are both optional
const mutex = mortice('my-lock', {

  // how long before write locks time out (default: 24 hours)
  timeout: 30000,

   // control how many read operations are executed concurrently (default: Infinity)
  concurrency: 5,

  // by default the the lock will be held on the main thread, set this to true if the
  // a lock should reside on each worker (default: false)
  singleProcess: false
})

Promise.all([
  (async () => {
    const release = await mutex.readLock()

    try {
      console.info('read 1')
    } finally {
      release()
    }
  })(),
  (async () => {
    const release = await mutex.readLock()

    try {
      console.info('read 2')
    } finally {
      release()
    }
  })(),
  (async () => {
    const release = await mutex.writeLock()

    try {
      await delay(1000)

      console.info('write 1')
    } finally {
      release()
    }
  })(),
  (async () => {
    const release = await mutex.readLock()

    try {
      console.info('read 3')
    } finally {
      release()
    }
  })()
])
```

```
read 1
read 2
<small pause>
write 1
read 3
```

## Browser

Because there's no global way to evesdrop on messages sent by Web Workers, please pass all created Web Workers to the [`observable-webworkers`](https://npmjs.org/package/observable-webworkers) module:

```javascript
// main.js
import mortice from 'mortice'
import observe from 'observable-webworkers'

// create our lock on the main thread, it will be held here
const mutex = mortice()

const worker = new Worker('worker.js')

observe(worker)
```

```javascript
// worker.js
import mortice from 'mortice'
import delay from 'delay'

const mutex = mortice()

let release = await mutex.readLock()
// read something
release()

release = await mutex.writeLock()
// write something
release()
```
