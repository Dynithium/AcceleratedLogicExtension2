import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';

// Copy PDF.js and Tesseract.js assets from node_modules to the root workspace directory so they are served in dev
const setupLocalAssets = () => {
  const pdfJsSrc = path.resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.min.mjs');
  const pdfWorkerSrc = path.resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
  
  const pdfJsDest = path.resolve(__dirname, 'pdf.min.mjs');
  const pdfWorkerDest = path.resolve(__dirname, 'pdf.worker.min.mjs');

  if (fs.existsSync(pdfJsSrc)) {
    fs.copyFileSync(pdfJsSrc, pdfJsDest);
  }
  if (fs.existsSync(pdfWorkerSrc)) {
    fs.copyFileSync(pdfWorkerSrc, pdfWorkerDest);
  }

  // Tesseract.js assets
  const tessSrc = path.resolve(__dirname, 'node_modules/tesseract.js/dist/tesseract.esm.min.js');
  const tessWorkerSrc = path.resolve(__dirname, 'node_modules/tesseract.js/dist/worker.min.js');
  const tessCoreSrc = path.resolve(__dirname, 'node_modules/tesseract.js-core/tesseract-core.wasm.js');
  const tessCoreWasmSrc = path.resolve(__dirname, 'node_modules/tesseract.js-core/tesseract-core.wasm');

  const tessDest = path.resolve(__dirname, 'tesseract.esm.min.js');
  const tessWorkerDest = path.resolve(__dirname, 'worker.min.js');
  const tessCoreDest = path.resolve(__dirname, 'tesseract-core.wasm.js');
  const tessCoreWasmDest = path.resolve(__dirname, 'tesseract-core.wasm');

  if (fs.existsSync(tessSrc)) fs.copyFileSync(tessSrc, tessDest);
  if (fs.existsSync(tessWorkerSrc)) fs.copyFileSync(tessWorkerSrc, tessWorkerDest);
  if (fs.existsSync(tessCoreSrc)) fs.copyFileSync(tessCoreSrc, tessCoreDest);
  if (fs.existsSync(tessCoreWasmSrc)) fs.copyFileSync(tessCoreWasmSrc, tessCoreWasmDest);
};

setupLocalAssets();

// A simple custom plugin to copy our extension files to dist/ after bundling
const copyExtensionFiles = () => {
  return {
    name: 'copy-extension-files',
    closeBundle() {
      const files = [
        'manifest.json', 
        'popup.html', 
        'popup.js', 
        'background.js', 
        'icon16.png', 
        'icon48.png', 
        'icon128.png',
        'pdf.min.mjs',
        'pdf.worker.min.mjs',
        'tesseract.esm.min.js',
        'worker.min.js',
        'tesseract-core.wasm.js',
        'tesseract-core.wasm'
      ];
      const distDir = path.resolve(__dirname, 'dist');
      if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
      }
      files.forEach(file => {
        const src = path.resolve(__dirname, file);
        const dest = path.join(distDir, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
        }
      });
    }
  };
};

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), copyExtensionFiles()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
