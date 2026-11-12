module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  extends: "eslint:recommended",
  plugins: {
    preact: require("eslint-plugin-preact"),
  },
  settings: {
    preact: {
      pragma: "h",
    },
  },
  rules: {
    ...require("eslint:recommended").rules,
    "@typescript-eslint/no-unused-vars": "warn",
    "preact/display-name": "warn",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
  },
  ignores: ["dist/**", "node_modules/**"],
};
