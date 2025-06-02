import worker from 'node:worker_threads'

export function postMessage (val: any) {
  worker.parentPort?.postMessage(val)
}
