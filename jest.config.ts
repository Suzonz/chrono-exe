import type { Config } from "jest";

const config: Config = {
  testEnvironment: "node",
  testPathIgnorePatterns: ["/node_modules/", "/.next/", "/.next-app/"],
  // The integration test shares one SQLite file.
  maxWorkers: 1,
  collectCoverageFrom: ["src/lib/**/*.ts", "src/app/api/**/*.ts"],
  // PRD target: 80% of the backend (logic + API routes).
  coverageThreshold: { global: { statements: 80, lines: 80, functions: 80 } },
  transform: {
    "^.+\\.(t|j)sx?$": ["ts-jest", { tsconfig: "tsconfig.json" }]
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1"
  }
};

export default config;
