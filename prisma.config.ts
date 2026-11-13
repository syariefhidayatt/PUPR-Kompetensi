import "dotenv/config"; // Prisma tidak memuat .env otomatis bila prisma.config.ts dipakai
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { seed: "tsx prisma/seed.ts" },
});
