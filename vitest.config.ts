import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    // Nilai palsu agar impor "@/env" tidak gagal di tes. Tes integrasi menimpa DATABASE_URL
    // dengan TEST_DATABASE_URL (lihat tests/master-integration.test.ts).
    env: {
      SKIP_ENV_VALIDATION: "1",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      ID_SALT: "salt-uji-minimal-16-karakter",
      AUTH_SECRET: "secret-uji-minimal-16-karakter",
    },
  },
});
