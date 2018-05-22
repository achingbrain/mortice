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
$ npm install --save lock
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
