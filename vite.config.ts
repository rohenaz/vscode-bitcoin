import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/extension.ts'),
      formats: ['es'],
      fileName: () => 'extension.js',
    },
    rollupOptions: {
      external: [
        'vscode',
        'node:path',
        'node:fs',
        'node-fetch',
        '@bsv/sdk',
        'bpu-ts',
        'bmapjs',
      ],
      output: {
        format: 'es',
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
