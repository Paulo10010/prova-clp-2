import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Em desenvolvimento o Vite (porta 5173) repassa /ws e /api para o backend.
// >>> Se mudar a PORT no backend/.env, mude o "target" aqui também.
const BACKEND = 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // permite abrir de outro PC/celular na mesma rede
    fs: { allow: ['..'] },
    proxy: {
      '/ws': { target: BACKEND, ws: true },
      '/api': { target: BACKEND },
    },
  },
});
