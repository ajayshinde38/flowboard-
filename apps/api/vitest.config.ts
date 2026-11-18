import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 20000,
    hookTimeout: 20000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        'postgresql://flowboard:flowboard_dev_password@localhost:5432/flowboard_test?schema=public',
      JWT_ACCESS_SECRET: 'test-access-secret-key-at-least-32-characters-long',
      JWT_REFRESH_SECRET: 'test-refresh-secret-key-at-least-32-characters-long',
      FRONTEND_URL: 'http://localhost:5173',
    },
  },
});
