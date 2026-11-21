const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './ui',
  testMatch: '**/*.spec.cjs',
  use: { browserName: 'chromium', locale: 'zh-TW', timezoneId: 'UTC' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } }
  ]
});
