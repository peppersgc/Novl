import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

const mainEntries = {
  index: resolve(__dirname, 'src/main/index.ts')
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist-electron/main',
      lib: {
        entry: mainEntries,
        formats: ['cjs']
      },
      rollupOptions: {
        output: {
          entryFileNames: '[name].js',
          dynamicImportInCjs: false
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist-electron/preload',
      lib: {
        entry: resolve(__dirname, 'src/preload/index.ts'),
        formats: ['cjs']
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react()],
    build: {
      outDir: 'dist-electron/renderer'
    }
  }
})