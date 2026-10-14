import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 43147,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:43148",
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, ""),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // React fica num ficheiro próprio, em cache entre deploys enquanto a versão não mudar.
        manualChunks(id) {
          if (/node_modules[\/](react|react-dom|scheduler)[\/]/.test(id)) return "react";
          return undefined;
        },
      },
    },
  },
});
