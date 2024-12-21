import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: './src/extension.ts',
      formats: ['cjs'],
      fileName: () => 'extension.js',
    },
    rollupOptions: {
      external: [
        'vscode',
        '@bsv/sdk',
        'node-fetch',
        'bpu-ts',
        'bmapjs',
        'core-js',
        /node:.*/, // Externalize all Node.js built-in modules
      ],
      output: {
        format: 'cjs',
        manualChunks: undefined,
        inlineDynamicImports: true,
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
    sourcemap: true,
    outDir: 'dist',
    minify: true,
    target: 'node16',
    reportCompressedSize: true,
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
});
