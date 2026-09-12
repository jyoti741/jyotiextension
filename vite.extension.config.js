import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

function copyExtensionFilesPlugin() {
  return {
    name: 'copy-extension-files',
    closeBundle() {
      // 1. Copy manifest.json and content.js to dist
      const manifestSrc = resolve(__dirname, 'manifest.json');
      const manifestDest = resolve(__dirname, 'dist/manifest.json');
      const contentSrc = resolve(__dirname, 'content.js');
      const contentDest = resolve(__dirname, 'dist/content.js');

      if (fs.existsSync(manifestSrc)) {
        fs.copyFileSync(manifestSrc, manifestDest);
      }
      if (fs.existsSync(contentSrc)) {
        fs.copyFileSync(contentSrc, contentDest);
      }

      // Copy icons to dist/icons
      const iconsSrc = resolve(__dirname, 'icons');
      const iconsDest = resolve(__dirname, 'dist/icons');
      if (fs.existsSync(iconsSrc)) {
        fs.mkdirSync(iconsDest, { recursive: true });
        const iconFiles = fs.readdirSync(iconsSrc);
        for (const file of iconFiles) {
          fs.copyFileSync(resolve(iconsSrc, file), resolve(iconsDest, file));
        }
      }

      // 2. Copy src HTML files into dist/src/
      const distPopupDir = resolve(__dirname, 'dist/src/popup');
      const distResultsDir = resolve(__dirname, 'dist/src/results');
      fs.mkdirSync(distPopupDir, { recursive: true });
      fs.mkdirSync(distResultsDir, { recursive: true });

      fs.copyFileSync(
        resolve(__dirname, 'src/popup/index.html'),
        resolve(distPopupDir, 'index.html')
      );
      fs.copyFileSync(
        resolve(__dirname, 'src/results/index.html'),
        resolve(distResultsDir, 'index.html')
      );

      // 3. Mirror compiled assets to root assets/ so loading root directory directly in Chrome works out-of-the-box!
      const rootAssetsDir = resolve(__dirname, 'assets');
      const distAssetsDir = resolve(__dirname, 'dist/assets');
      fs.mkdirSync(rootAssetsDir, { recursive: true });
      if (fs.existsSync(distAssetsDir)) {
        const files = fs.readdirSync(distAssetsDir);
        for (const file of files) {
          fs.copyFileSync(resolve(distAssetsDir, file), resolve(rootAssetsDir, file));
        }
      }
      console.log('✓ Successfully synced assets, manifest, and HTML files for both root and dist packaging!');
    }
  };
}

export default defineConfig({
  plugins: [react(), copyExtensionFilesPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/main.tsx'),
        results: resolve(__dirname, 'src/results/main.tsx'),
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
        format: 'es',
      },
    },
  },
});
