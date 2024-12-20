import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/extension.ts'),
      formats: ['cjs'],
      fileName: () => 'extension.js',
    },
    rollupOptions: {
      external: [
        'vscode',
        'node:path',
        'node:fs',
        'node-fetch',
        '@libitx/shapeshifter.js',
        '@bsv/sdk',
      ],
      output: {
        sourcemap: true,
        format: 'cjs',
        exports: 'named',
      },
    },
    sourcemap: true,
    outDir: 'dist',
    minify: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
