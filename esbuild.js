import { build } from 'esbuild'

async function main () {
  await Promise.all([
    build({
      entryPoints: ['./test/fixtures/worker.ts'],
      bundle: true,
      outfile: './dist/worker.js'
    }),
    build({
      entryPoints: ['./test/fixtures/worker-single-thread.ts'],
      bundle: true,
      outfile: './dist/worker-single-thread.js'
    }),
    build({
      entryPoints: ['./test/fixtures/worker-abort.ts'],
      bundle: true,
      outfile: './dist/worker-abort.js'
    }),
    build({
      entryPoints: ['./test/fixtures/worker-finalize.ts'],
      bundle: true,
      outfile: './dist/worker-finalize.js'
    })
  ])
}

main()
