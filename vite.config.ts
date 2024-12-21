import { defineConfig } from 'vite';

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
        '@bsv/sdk',
        'node-fetch',
        'bpu-ts',
        'bmapjs',
        'core-js',
        'typed-html',
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
    extensions: ['.tsx', '.ts', '.js'],
  },
});
