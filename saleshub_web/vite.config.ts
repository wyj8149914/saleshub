import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
    base: '/sales',
    plugins: [vue(), vueDevTools()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    // Vite 8 使用 Oxc 压缩：打包时丢弃 console / debugger（仅 production build）
    build: {
        rolldownOptions: {
            output: {
                minify: {
                    compress: {
                        dropConsole: true,
                        dropDebugger: true,
                    },
                },
            },
        },
    },
})
