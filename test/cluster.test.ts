import { expect } from 'aegir/chai'
import { isNode, isElectronMain } from 'wherearewe'

describe('cluster', () => {
  if (!isNode && !isElectronMain) {
    return it.skip('cluster tests only run on node')
  }

  let exec: any

  before(async () => {
    const { execa } = await import('execa')
    exec = execa
  })

  it('executes locks in correct order across a cluster', async () => {
    const output = await exec('node', ['dist/test/fixtures/cluster.js'], {
      stderr: process.stderr
    })
    const result = JSON.parse(output.stdout)

    expect(result).to.deep.equal([
      'write 1 waiting',
      'read 1 waiting',
      'read 2 waiting',
      'read 3 waiting',
      'write 2 waiting',
      'read 4 waiting',
      'write 1 start',
      'write 1 complete',
      'read 1 start',
      'read 1 complete',
      'read 2 start',
      'read 2 complete',
      'read 3 start',
      'read 3 complete',
      'write 2 start',
      'write 2 complete',
      'read 4 start',
      'read 4 complete'
    ])
  })

  it('executes locks in correct order across a cluster in a single process', async () => {
    const output = await exec('node', ['dist/test/fixtures/cluster-single-thread.js'], {
      stderr: process.stderr
    })
    const result = JSON.parse(output.stdout)

    expect(result).to.deep.equal([
      'write 1 waiting',
      'read 1 waiting',
      'read 2 waiting',
      'read 3 waiting',
      'write 2 waiting',
      'read 4 waiting',
      'write 1 start',
      'write 1 complete',
      'read 1 start',
      'read 1 complete',
      'read 2 start',
      'read 2 complete',
      'read 3 start',
      'read 3 complete',
      'write 2 start',
      'write 2 complete',
      'read 4 start',
      'read 4 complete'
    ])
  })

  it('aborts a lock across a cluster', async () => {
    const output = await exec('node', ['dist/test/fixtures/cluster-abort.js'], {
      stderr: process.stderr
    })
    const result = JSON.parse(output.stdout)

    expect(result).to.deep.equal([
      'write 1 waiting',
      'write 2 waiting',
      'write 3 waiting',
      'write 1 start',
      'write 2 error The operation was aborted',
      'write 1 complete',
      'write 3 start',
      'write 3 complete'
    ])
  })
})
