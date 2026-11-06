export default {
  testEnvironment: "node",
  transform: {},
  moduleFileExtensions: ["js", "json"],
  testMatch: ["**/__tests__/**/*.test.js"],
  // Копии проекта в worktree-папках (.kilo/, .gigacode_vsc/) лежат рядом с src и
  // при дефолтном шаблоне попадали в прогон: счётчик сюит врал, а падающие тесты
  // ссылались на модули, которых в рабочем дереве нет.
  testPathIgnorePatterns: ["/node_modules/", "/\\.kilo/", "/\\.gigacode_vsc/"],
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/**/*.test.js",
    "!src/__tests__/**",
    "!src/server.js",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  verbose: true,
  testTimeout: 10000,
};
