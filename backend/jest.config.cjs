/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  clearMocks: true,
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          module: "CommonJS",
          moduleResolution: "node",
          esModuleInterop: true,
          isolatedModules: true,
          strict: false,
          noImplicitAny: false,
          strictNullChecks: false,
          useUnknownInCatchVariables: false,
          skipLibCheck: true,
          types: ["node", "jest"],
        },
        diagnostics: {
          ignoreCodes: [151002, 2451, 2339, 2345, 2554],
        },
      },
    ],
  },
};
