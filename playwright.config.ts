import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4318",
    channel: "chrome",
    viewport: { width: 1600, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run start",
    url: "http://127.0.0.1:4318/api/status",
    reuseExistingServer: false,
    env: {
      PORT: "4318",
      TYPESAFE_API_KEY: "",
      OPENAI_API_KEY: "",
      OPENROUTER_API_KEY: "",
      ENABLE_CODEX: "false",
      LOCAL_MODEL: "",
      JEEVES_DATA_DIR: `/tmp/jeeves-browser-${process.pid}`,
    },
  },
});
