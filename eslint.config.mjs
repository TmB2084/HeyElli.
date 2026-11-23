import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/platform/ui/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["radix-ui", "radix-ui/**", "@radix-ui/*", "@base-ui/*", "@/platform/ui/**", "!@/platform/ui/ai-elements"],
          message: "Bedienelemente über @/platform/ui oder @/platform/ui/ai-elements verwenden.",
        }],
      }],
      "no-restricted-syntax": ["error", {
        selector: "JSXOpeningElement[name.name=/^(button|input|select|textarea|dialog)$/]",
        message: "Bedienelement in @/platform/ui verwenden oder dort als gemeinsamen Baustein ergänzen.",
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".local/**",
    ".next-platform-test/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
