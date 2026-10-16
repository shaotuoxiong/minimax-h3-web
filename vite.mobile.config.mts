import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  root: fileURLToPath(new URL('./mobile', import.meta.url)),
  envDir: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  publicDir: false,
  build: {
    target: 'es2018',
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
    lib: {
      entry: fileURLToPath(new URL('./mobile/app.ts', import.meta.url)),
      name: 'H3Video',
      formats: ['iife'],
      fileName: () => 'app.js'
    },
    sourcemap: false
  },
  plugins: [
    {
      name: 'static-video-page',
      transformIndexHtml(html, context) {
        return context.server
          ? html.replace('defer src="./app.js"', 'type="module" src="./app.ts"')
          : html
      },
      generateBundle() {
        for (const fileName of ['index.html', 'style.css']) {
          this.emitFile({
            type: 'asset',
            fileName,
            source: readFileSync(
              new URL('./mobile/' + fileName, import.meta.url),
              'utf8'
            )
          })
        }
      }
    }
  ]
})
