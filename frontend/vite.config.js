import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The dev server forwards /api calls to the backend, so there are no CORS or URL headaches.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:5000",
      "/socket.io": { target: "http://localhost:5000", ws: true },
    },
  },
});
