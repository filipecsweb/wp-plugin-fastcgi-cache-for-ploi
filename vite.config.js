import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

const hotFile = path.resolve('public/build/hot')

/**
 * Writes a "hot" file containing the dev-server origin while `vite` runs, and
 * removes it on shutdown. The Foundation's Vite enqueuer detects this file to
 * switch between dev-server and built-manifest modes.
 */
function wpHotFile() {
  return {
    name: 'fastcgi-cache-for-ploi-hot-file',
    apply: 'serve',
    configureServer(server) {
      const write = () => {
        const address = server.httpServer && server.httpServer.address()
        if (!address || typeof address === 'string') return
        fs.mkdirSync(path.dirname(hotFile), { recursive: true })
        fs.writeFileSync(hotFile, `http://localhost:${address.port}`)
      }
      if (server.httpServer) server.httpServer.once('listening', write)

      const clean = () => {
        try {
          fs.unlinkSync(hotFile)
        } catch (e) {
          /* already gone */
        }
      }
      process.on('exit', clean)
      for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
        process.on(signal, () => {
          clean()
          process.exit()
        })
      }
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [tailwindcss(), wpHotFile()],
  build: {
    outDir: 'public/build',
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: 'resources/js/admin.js',
    },
  },
})
