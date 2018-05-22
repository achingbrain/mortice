import test from 'ava'
import exec from 'execa'

test('runs a cluster', (t) => {
  return exec('echo', ['unicorns'])
  .then(result => {
    t.is(result.stdout, 'unicorns')
  })
})