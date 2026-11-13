import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Cegah XSS (temuan M3): data pengguna tidak boleh di-render sebagai HTML mentah.
      "react/no-danger": "error",
    },
  },
];

export default eslintConfig;
