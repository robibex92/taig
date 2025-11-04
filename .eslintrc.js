module.exports = {
  env: {
    node: true,
    commonjs: true,
    es2021: true,
  },
  extends: ["eslint:recommended", "plugin:node/recommended"],
  parserOptions: {
    ecmaVersion: 12,
  },
  rules: {
    "no-unused-vars": "warn",
    "no-console": "off",
    "node/exports-style": ["error", "module.exports"],
    "node/file-extension-in-import": ["error", "always"],
    "node/no-unpublished-require": "off",
    "node/no-extraneous-import": "off",
    "node/no-missing-require": "off",
  },
};
