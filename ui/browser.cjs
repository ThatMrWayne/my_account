const { test: base, expect } = require('@playwright/test');
const { createServer } = require('node:http');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { once } = require('node:events');

const test = base.extend({
  site: [async ({}, use) => {
    const html = readFileSync(join(__dirname, '..', 'Index.html'));
    const server = createServer((request, response) => {
      if (request.url !== '/Index.html') {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
      await use('http://127.0.0.1:' + server.address().port + '/Index.html');
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  }, { scope: 'worker' }],

  ledger: async ({ page, site }, use) => {
    // UTC is still January. Taipei is already in February.
    await page.clock.setFixedTime(new Date('2025-01-31T16:15:00Z'));
    await page.addInitScript(() => {
      window.google = { script: { run: {
        withSuccessHandler(success) {
          return {
            withFailureHandler(failure) {
              return {
                readLedger() {
                  const pending = new Promise(resolve => { window.replyToLedger = resolve; });
                  pending.then(({ error, result }) => {
                    delete window.replyToLedger;
                    if (error) failure(new Error(error));
                    else success(result);
                  });
                }
              };
            }
          };
        }
      } } };
    });
    await page.goto(site);
    async function reply(payload) {
      await page.waitForFunction(() => typeof window.replyToLedger === 'function');
      await page.evaluate(value => window.replyToLedger(value), payload);
    }
    await use({
      success: entries => reply({ result: { entries, fetchedAt: '2025-01-31T16:15:00Z' } }),
      failure: () => reply({ error: '模擬讀取失敗' })
    });
  }
});

module.exports = { test, expect };
