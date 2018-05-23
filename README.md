# mortice

Isomorphic read/write lock that works in single processes, node clusters and web workers.

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
const mortice = require('mortice')
const delay = require('delay')

const mutex = mortice()

mutex.requestRead(() => {
  return Promise.resolve().then(() => console.info('read 1'))
})

mutex.requestRead(() => {
  return Promise.resolve().then(() => console.info('read 2'))
})

mutex.requestWrite(() => {
  return delay(200).then(() => console.info('write 1'))
})

mutex.requestRead(() => {
  return Promise.resolve().then(() => console.info('read 3'))
})
```

```
read 1
read 2
<small pause>
write 1
read 3
```

## Browser

Because there's no global way to evesdrop on messages sent by Web Workers, please pass all created Web Workers to the `observable-webworkers` module:

```javascript
// main.js
const mortice = require('mortice')
const observe = require('observable-webworkers')

// create our lock on the main thread, it will be held here
const mutex = mortice()

const worker = new Worker('worker.js')

observe(worker)
```

```javascript
// worker.js
const mortice = require('mortice')
const delay = require('delay')

const mutex = mortice()

mutex.requestRead(() => {
  // return a promise
})

mutex.requestWrite(() => {
  // return a promise
})
```
