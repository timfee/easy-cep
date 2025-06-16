/* eslint-disable tsdoc/syntax */
/** @type {import("prettier").Config} */
const config = {
  experimentalOperatorPosition: "start",
  singleQuote: false,
  jsxSingleQuote: false,
  semi: true,
  trailingComma: "none",
  objectWrap: "collapse",
  experimentalTernaries: true,
  bracketSameLine: true,
  plugins: ["prettier-plugin-organize-imports", "prettier-plugin-packagejson"],
  overrides: [
    {
      files: ["**/.vscode/*.json", "**/tsconfig.json", "**/tsconfig.*.json"],
      options: { parser: "jsonc" }
    }
  ]
};

export default config;
