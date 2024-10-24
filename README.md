# mortice

[![codecov](https://img.shields.io/codecov/c/github/achingbrain/mortice.svg?style=flat-square)](https://codecov.io/gh/achingbrain/mortice)
[![CI](https://img.shields.io/github/actions/workflow/status/achingbrain/mortice/js-test-and-release.yml?branch=main\&style=flat-square)](https://github.com/achingbrain/mortice/actions/workflows/js-test-and-release.yml?query=branch%3Amain)

> Isomorphic read/write lock that works in single processes, node clusters and web workers

# About

<!--

!IMPORTANT!

Everything in this README between "# About" and "# Install" is automatically
generated and will be overwritten the next time the doc generator is run.

To make changes to this section, please update the @packageDocumentation section
of src/index.js or src/index.ts

To experiment with formatting, please run "npm run docs" from the root of this
repo and examine the changes made.

-->

- Reads occur concurrently
- Writes occur one at a time
- No reads occur while a write operation is in progress
- Locks can be created with different names
- Reads/writes can time out

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

# Install

```console
$ npm i mortice
```

## Browser `<script>` tag

Loading this module through a script tag will make its exports available as `Mortice` in the global namespace.

```html
<script src="https://unpkg.com/mortice/dist/index.min.js"></script>
```

# API Docs

- <https://achingbrain.github.io/mortice>

# License

Licensed under either of

- Apache 2.0, ([LICENSE-APACHE](https://github.com/achingbrain/mortice/LICENSE-APACHE) / <http://www.apache.org/licenses/LICENSE-2.0>)
- MIT ([LICENSE-MIT](https://github.com/achingbrain/mortice/LICENSE-MIT) / <http://opensource.org/licenses/MIT>)

# Contribution

Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in the work by you, as defined in the Apache-2.0 license, shall be dual licensed as above, without any additional terms or conditions.
