export const WORKER_REQUEST_READ_LOCK = 'lock:worker:request-read'
export const WORKER_ABORT_READ_LOCK_REQUEST = 'lock:worker:abort-read-request'
export const WORKER_RELEASE_READ_LOCK = 'lock:worker:release-read'
export const MASTER_GRANT_READ_LOCK = 'lock:master:grant-read'
export const MASTER_READ_LOCK_ERROR = 'lock:master:error-read'

export const WORKER_REQUEST_WRITE_LOCK = 'lock:worker:request-write'
export const WORKER_ABORT_WRITE_LOCK_REQUEST = 'lock:worker:abort-write-request'
export const WORKER_RELEASE_WRITE_LOCK = 'lock:worker:release-write'
export const MASTER_GRANT_WRITE_LOCK = 'lock:master:grant-write'
export const MASTER_WRITE_LOCK_ERROR = 'lock:master:error-write'

export const WORKER_FINALIZE = 'lock:worker:finalize'
export const MASTER_FINALIZE = 'lock:master:finalize'
