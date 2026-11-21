const { test, expect } = require('./browser.cjs');

const february = {
  date: '2025-02-01', merchant: '晨光早餐店', item: '蛋餅', category: '餐飲',
  payment: '現金', amount: 45, note: '加起司'
};
const january = {
  date: '2025-01-28', merchant: '轉角書店', item: '筆記本', category: '文具',
  payment: '信用卡', amount: 120, note: ''
};
const entries = [
  february,
  january,
  { ...january, date: '2025-01-20', merchant: '河岸文具', item: '鉛筆', amount: 12.5 }
];

const refresh = page => page.getByRole('button', { name: '重新整理' });
const month = page => page.getByRole('combobox', { name: '選擇月份' });

async function expectMonth(page, selected, merchants, total) {
  await expect(month(page)).toBeVisible();
  await expect(month(page)).toHaveValue(selected);
  await expect(page.locator('#transactions tr td:nth-child(2)')).toHaveText(merchants);
  if (merchants.length) await expect(page.getByRole('table')).toBeVisible();
  await expect(page.locator('#month-count')).toBeVisible();
  await expect(page.locator('#month-count')).toHaveText(String(merchants.length));
  await expect(page.locator('#month-total')).toBeVisible();
  await expect(page.locator('#month-total')).toHaveText(total);
}

test('初次載入時停用重新整理，完成後顯示明細', async ({ page, ledger }) => {
  await expect(page.getByRole('status')).toHaveText('讀取中…');
  await expect(refresh(page)).toBeDisabled();
  await ledger.success(entries);
  await expect(refresh(page)).toBeEnabled();
  await expect(page.getByRole('status')).toContainText('最近讀取（台灣時間）');
  await expectMonth(page, '2025-02', ['晨光早餐店'], '$45');
  await expect(page.getByRole('row').last().getByRole('cell')).toHaveText([
    '2025-02-01', '晨光早餐店', '蛋餅', '餐飲', '現金', '$45', '加起司'
  ]);
});

test('切換月份後重新整理，保留選擇並更新明細', async ({ page, ledger }) => {
  await ledger.success(entries);
  await month(page).selectOption({ label: '2025 年 1 月' });
  await expectMonth(page, '2025-01', ['轉角書店', '河岸文具'], '$132.5');
  await refresh(page).click();
  await expect(page.getByRole('status')).toHaveText('讀取中…');
  await expect(refresh(page)).toBeDisabled();
  await ledger.success([february, { ...january, merchant: '山丘書屋', amount: 200 }]);
  await expectMonth(page, '2025-01', ['山丘書屋'], '$200');
  await expect(refresh(page)).toBeEnabled();
});

test('空帳本顯示台北當月、零元及零筆', async ({ page, ledger }) => {
  await ledger.success([]);
  await expectMonth(page, '2025-02', [], '$0');
  await expect(month(page).locator('option')).toHaveText(['2025 年 2 月']);
  await expect(page.getByText('目前沒有支出紀錄。')).toBeVisible();
  await expect(page.getByRole('table')).toBeHidden();
});

test('首次讀取失敗時提供重試', async ({ page, ledger }) => {
  await ledger.failure();
  await expect(page.getByRole('status')).toHaveText('無法讀取記帳資料，請重新整理。');
  await expect(month(page)).toBeHidden();
  await refresh(page).click();
  await ledger.success(entries);
  await expectMonth(page, '2025-02', ['晨光早餐店'], '$45');
});

test('重新整理失敗時保留前次成功資料與時間', async ({ page, ledger }) => {
  await ledger.success(entries);
  await month(page).selectOption('2025-01');
  await expectMonth(page, '2025-01', ['轉角書店', '河岸文具'], '$132.5');
  const status = page.getByRole('status');
  const timestamp = (await status.innerText()).replace('最近讀取（台灣時間） ', '');
  await refresh(page).click();
  await ledger.failure();
  await expect(status).toHaveText('更新失敗，目前顯示 ' + timestamp + ' 讀取的資料。');
  await expectMonth(page, '2025-01', ['轉角書店', '河岸文具'], '$132.5');
  await expect(refresh(page)).toBeEnabled();
});

test('篩選與按鈕可操作，寬表格在容器內捲動', async ({ page, ledger }, testInfo) => {
  await ledger.success(entries);
  await month(page).selectOption('2025-01');
  await expectMonth(page, '2025-01', ['轉角書店', '河岸文具'], '$132.5');
  await page.screenshot({ path: testInfo.outputPath('ledger.png'), fullPage: true });
  await refresh(page).click();
  await ledger.success([{ ...january, note: '跨頁明細測試文字'.repeat(30) }]);
  const region = page.getByRole('region', { name: '支出明細表' });
  await expect(region.getByText('跨頁明細測試文字', { exact: false })).toBeVisible();
  expect(await region.evaluate(el => el.scrollWidth - el.clientWidth)).toBeGreaterThan(0);
  await region.hover();
  await page.mouse.wheel(500, 0);
  await expect.poll(() => region.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
  expect(await page.evaluate(() => window.scrollX)).toBe(0);
});
