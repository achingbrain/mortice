import worker from 'node:worker_threads'

export function postMessage (val: any): void {
  worker.parentPort?.postMessage(val)
}
