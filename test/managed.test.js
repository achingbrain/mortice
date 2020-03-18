import test from 'ava'

const mortice = require('../')

test('should manage returned read mutexes', async (t) => {
  const name = 'aLock'

  const readLockRelease = await mortice.managed.readLock(name)
  const mutexAtFirstAccess = mortice(name);

  await readLockRelease();

  await mortice.managed.readLock(name)
  const mutexAtSecondAccess = mortice(name);

  t.true(mutexAtFirstAccess !== mutexAtSecondAccess)
})

test('should manage returned write mutexes', async (t) => {
  const name = 'bLock'

  const readLockRelease = await mortice.managed.writeLock(name)
  const mutexAtFirstAccess = mortice(name);

  await readLockRelease();

  await mortice.managed.readLock(name)
  const mutexAtSecondAccess = mortice(name);

  t.true(mutexAtFirstAccess !== mutexAtSecondAccess)
})
