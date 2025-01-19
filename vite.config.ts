import { defineConfig } from 'vite';
import { builtinModules } from 'node:module';
import path from 'node:path';

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
          // Split vendor chunks
          'vendor-bsv': ['@bsv/sdk'],
          'vendor-fetch': ['node-fetch'],
          'vendor-html': ['typed-html'],
          'vendor-bmap': ['bmapjs', 'bpu-ts'],
          // Keep webview-related code in separate chunks
          webview: ['./src/commands/convertData/script.ts', './src/commands/convertData/styles.ts'],
        },
        inlineDynamicImports: false,
        entryFileNames: '[name].js',
        chunkFileNames: chunks => {
          if (chunks.name.includes('vendor')) {
            return `vendor/${chunks.name}.js`;
          }
          return 'webview/[name].js';
        },
        assetFileNames: 'assets/[name].[ext]',
      },
    },
    sourcemap: false,
    outDir: 'dist',
    minify: true,
    target: 'node16',
    reportCompressedSize: true,
    commonjsOptions: {
      include: [
        /node_modules/,
        /typed-html/,
        /@bsv\/sdk/,
        /node-fetch/,
        /bmapjs/,
        /bpu-ts/,
      ],
      transformMixedEsModules: true,
      // Optimize CommonJS dependencies
      defaultIsModuleExports: true,
      ignoreDynamicRequires: true,
    },
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx', '.mjs', '.cjs'],
    alias: {
      'typed-html': path.resolve(__dirname, 'node_modules/typed-html/dist/src/elements.js'),
      '@bsv/sdk': path.resolve(__dirname, 'node_modules/@bsv/sdk/dist/cjs/mod.js'),
    },
    mainFields: ['module', 'main'],
  },
  optimizeDeps: {
    include: [
      'typed-html',
      '@bsv/sdk',
      'node-fetch',
      'bmapjs',
      'bpu-ts',
    ],
    exclude: [
      // Exclude unused @bsv/sdk modules
      '@bsv/sdk/auth',
      '@bsv/sdk/overlay-tools',
      '@bsv/sdk/totp',
    ],
    // Optimize dependency pre-bundling
    esbuildOptions: {
      target: 'node16',
      treeShaking: true,
      minify: true,
      keepNames: true,
    },
  },
});
