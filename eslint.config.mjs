import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  {
    files: [
      "components/fifa-card.tsx",
      "components/fifa-card-layouts.tsx",
      "components/cartinha-destaque.tsx",
    ],
    rules: { "@next/next/no-img-element": "off" },
  },

  globalIgnores([

    ".next/**",
    "public/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
