import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Intentional patterns: setting loading/error state at the start of an
      // async data fetch, and syncing the persisted theme on mount. These do
      // not cause cascading-render loops here. The remaining react-hooks rules
      // stay as errors.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
