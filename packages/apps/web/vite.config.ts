import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';

// The shared renderer: this build is the web port and is also what the Tauri
// desktop shell loads (decision D2/D3). Core stays platform-agnostic.
export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  // Tauri-friendly dev server (fixed port, quiet).
  server: { port: 5173, strictPort: true },
  clearScreen: false,
});
