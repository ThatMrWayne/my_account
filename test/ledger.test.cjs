const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');

const projectRoot = join(__dirname, '..');
const source = readFileSync(join(projectRoot, 'Code.gs'), 'utf8');
const headers = ['日期', '店家／用途', '品項', '分類', '支付方式', '金額（NT$）', '備註'];

function loadScript(services) {
  return runInNewContext(source + '\n({ readLedger, doGet })', services, {
    filename: 'Code.gs'
  });
}

function loadLedger(result) {
  return loadScript({
    Sheets: {
      Spreadsheets: {
        Values: {
          get(spreadsheetId, range, options) {
            assert.equal(typeof spreadsheetId, 'string');
            assert.ok(spreadsheetId.length > 0);
            assert.equal(range, "'支出明細'!A4:G");
            assert.deepEqual({ ...options }, {
              valueRenderOption: 'UNFORMATTED_VALUE',
              dateTimeRenderOption: 'SERIAL_NUMBER'
            });
            return result;
          }
        }
      }
    }
  });
}

test('readLedger 接受正確欄位，略過空列', () => {
  const { readLedger } = loadLedger({ values: [headers, [], ['', null]] });
  const { entries, fetchedAt } = readLedger();
  assert.deepEqual(Array.from(entries), []);
  assert.equal(new Date(fetchedAt).toISOString(), fetchedAt);
});

test('readLedger 拒絕缺少、改名或順序不符的欄位', () => {
  const [date, merchant, ...rest] = headers;
  for (const result of [
    {},
    { values: [] },
    { values: [headers.slice(0, -1)] },
    { values: [['交易日', merchant, ...rest]] },
    { values: [[merchant, date, ...rest]] }
  ]) {
    assert.throws(loadLedger(result).readLedger, {
      message: '支出明細的欄位與網站設定不一致。'
    });
  }
});

test('readLedger 將日期序號轉成 YYYY-MM-DD，保留數字金額並補齊空值', () => {
  const { readLedger } = loadLedger({
    values: [headers, [45351, '測試店家', '餐點', '餐飲', '現金', 12.5]]
  });
  const { entries } = readLedger();
  assert.deepEqual(Array.from(entries, entry => ({ ...entry })), [{
    date: '2024-02-29',
    merchant: '測試店家',
    item: '餐點',
    category: '餐飲',
    payment: '現金',
    amount: 12.5,
    note: ''
  }]);
});

test('readLedger 接受日期序號上下界、零元及負金額', () => {
  const { readLedger } = loadLedger({
    values: [headers, [1, '', '', '', '', 0], [2958465, '', '', '', '', -10]]
  });
  assert.deepEqual(Array.from(readLedger().entries, ({ date, amount }) => [date, amount]), [
    ['9999-12-31', -10],
    ['1899-12-31', 0]
  ]);
});

test('readLedger 拒絕無效日期序號並回報試算表列號', () => {
  for (const date of [undefined, '45351', 0, 45351.5, 2958466, NaN, Infinity]) {
    const { readLedger } = loadLedger({
      values: [headers, [], [date, '', '', '', '', 50]]
    });
    assert.throws(readLedger, {
      message: '支出明細第 6 列的日期或金額格式有誤。'
    });
  }
});

test('readLedger 拒絕缺漏、非數字及非有限金額', () => {
  for (const amount of [undefined, null, '', '50', true, NaN, Infinity, -Infinity]) {
    const { readLedger } = loadLedger({
      values: [headers, [45351, '', '', '', '', amount]]
    });
    assert.throws(readLedger, {
      message: '支出明細第 5 列的日期或金額格式有誤。'
    });
  }
});

test('readLedger 依日期由新到舊排序，同日的較後列優先', () => {
  const { readLedger } = loadLedger({
    values: [
      headers,
      [45351, '同日第一筆', '', '', '', 10],
      [45352, '最新一筆', '', '', '', 20],
      [45350, '最舊一筆', '', '', '', 30],
      [45351, '同日第二筆', '', '', '', 40]
    ]
  });
  assert.deepEqual(Array.from(readLedger().entries, entry => entry.merchant), [
    '最新一筆', '同日第二筆', '同日第一筆', '最舊一筆'
  ]);
});

test('doGet 引用的 HTML 存在且檔名大小寫一致，並設定頁面標題', () => {
  const page = {
    setTitle(title) {
      assert.equal(title, '個人記帳');
      return this;
    }
  };
  const { doGet } = loadScript({
    HtmlService: {
      createHtmlOutputFromFile(name) {
        const filename = name + '.html';
        const files = readdirSync(projectRoot, { withFileTypes: true });
        assert.ok(files.some(file => file.isFile() && file.name === filename),
          '找不到檔名及大小寫完全相符的 HTML 檔案：' + filename);
        return page;
      }
    }
  });
  assert.equal(doGet(), page);
});
