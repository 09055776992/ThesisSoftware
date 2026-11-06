// vitest config — standalone, does not inherit vite.config.ts
export default {
  // No vite plugins needed for pure unit tests
  plugins: [],
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        url: "http://localhost/",
      },
    },
    globals: true,
    include: ["src/**/*.pbt.test.ts", "src/**/*.test.ts"],
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    testTimeout: 60000,
  },
};
