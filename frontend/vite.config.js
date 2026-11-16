import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The dev server forwards /api calls to the backend, so there are no CORS or URL headaches.
// On macOS port 5000 is taken by AirPlay Receiver, so set API_URL (e.g. http://localhost:5050)
// and run the backend with the same PORT.
const API_URL = process.env.API_URL || "http://localhost:5000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": API_URL,
      "/socket.io": { target: API_URL, ws: true },
    },
  },
});
