import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
    base: '/',
    server: {
        port: 5173,
        host: true,
        strictPort: true,
    },
    build: {
        rollupOptions: {
            input: {
                arview:    resolve(__dirname, 'ar-view/index.html'),
                dashboard: resolve(__dirname, 'dashboard/index.html'),
                scanner:   resolve(__dirname, 'qr-scanner/index.html'),
            },
            output: {
                entryFileNames: 'assets/[name].js'
            }
        }
    }
})