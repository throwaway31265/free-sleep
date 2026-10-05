import { sentryVitePlugin } from '@sentry/vite-plugin';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import info from '../server/src/serverInfo.json' with { type: 'json' };

const isDemoMode = process.env.VITE_ENV === 'demo';
const isPrMode = process.env.VITE_ENV === 'pr';
const isProdMode = process.env.VITE_ENV === 'prod';

const plugins = [react()];

if (isProdMode) {
  plugins.push(sentryVitePlugin({
    org: 'free-sleep',
    project: 'app',
    release: {
      name: info.version,
    }
  }));
}

export default defineConfig({
  plugins,
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    host: '0.0.0.0', // This makes the server accessible to other devices on the network
    port: 5173, // Optional: specify a port if you want something other than the default
  },
  build: {
    sourcemap: !isDemoMode,
    // PR builds omit production Sentry code and must not overwrite committed assets.
    outDir: isDemoMode || isPrMode ? './dist/' : '../server/public/',
    rolldownOptions: {
      output: {
        entryFileNames: 'index.js', // Set the name for the JS entry file
        chunkFileNames: '[name]-[hash].js', // Names for dynamic imports
        assetFileNames: ({ names }) => {
          if (names.some(name => name.endsWith('.css'))) {
            return 'index.css';
          }
          return '[name]-[hash].[ext]';
        },
      },
    },
  },
});
