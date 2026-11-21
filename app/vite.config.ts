import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        // Separa UI y adapters para evitar un único bundle >500 kB.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (
            id.includes("@solana/wallet-adapter-wallets") ||
            id.includes("@reown") ||
            id.includes("@walletconnect") ||
            id.includes("@ledgerhq") ||
            id.includes("@trezor")
          ) return "wallets";
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/scheduler/")
          ) return "react";
        },
      },
    },
  },
});
