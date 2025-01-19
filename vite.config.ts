import { defineConfig } from 'vite';
import { builtinModules } from 'module';
import path from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: './src/extension.tsx',
      formats: ['cjs'],
      fileName: () => 'extension.js',
    },
    rollupOptions: {
      external: [
        'vscode',
        ...builtinModules,
        ...builtinModules.map(m => `node:${m}`),
      ],
      output: {
        format: 'cjs',
        manualChunks: {
          // Keep webview-related code in separate chunks
          webview: ['./src/commands/convertData/script.ts', './src/commands/convertData/styles.ts'],
        },
        inlineDynamicImports: false,
        entryFileNames: '[name].js',
        chunkFileNames: 'webview/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
    sourcemap: true,
    outDir: 'dist',
    minify: true,
    target: 'node16',
    reportCompressedSize: true,
    commonjsOptions: {
      include: [
        /node_modules/,
        /typed-html/,
        /@bsv\/sdk/,
        /is-base64/,
        /is-hex/,
        /js-1sat-ord/,
        /node-fetch/,
        /bmapjs/,
        /bpu-ts/,
      ],
      transformMixedEsModules: true,
    },
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx', '.mjs', '.cjs'],
    alias: {
      'typed-html': path.resolve(__dirname, 'node_modules/typed-html/dist/src/elements.js'),
    },
    mainFields: ['module', 'main'],
  },
  optimizeDeps: {
    include: [
      'typed-html',
      '@bsv/sdk',
      'is-base64',
      'is-hex',
      'js-1sat-ord',
      'node-fetch',
      'bmapjs',
      'bpu-ts',
    ],
    esbuildOptions: {
      target: 'node16',
    },
  },
});
