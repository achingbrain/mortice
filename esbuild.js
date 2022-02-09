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
    })
  ])
}

main()
