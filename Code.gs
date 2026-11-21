const SPREADSHEET_ID = '1W8NEhGlWo5Co3ClfdFhCwDOotLlGzHrctfX7B7XJBGw';
const HEADERS = ['日期', '店家／用途', '品項', '分類', '支付方式', '金額（NT$）', '備註'];

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index').setTitle('個人記帳');
}

function readLedger() {
  const result = Sheets.Spreadsheets.Values.get(SPREADSHEET_ID, "'支出明細'!A4:G", {
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'SERIAL_NUMBER'
  });
  const [headers = [], ...rows] = result.values || [];
  if (!HEADERS.every((header, index) => header === headers[index])) {
    throw new Error('支出明細的欄位與網站設定不一致。');
  }
  const entries = [];
  rows.forEach((row, index) => {
    if (row.every(value => value === '' || value == null)) return;
    const [date, merchant, item, category, payment, amount, note] = row;
    if (!Number.isInteger(date) || date < 1 || date > 2958465 || !Number.isFinite(amount)) {
      throw new Error('支出明細第 ' + (index + 5) + ' 列的日期或金額格式有誤。');
    }
    entries.push({
      date: new Date(Date.UTC(1899, 11, 30) + date * 86400000).toISOString().slice(0, 10),
      merchant: merchant ?? '', item: item ?? '', category: category ?? '',
      payment: payment ?? '', amount, note: note ?? ''
    });
  });
  return {
    entries: entries.reverse().sort((a, b) => b.date.localeCompare(a.date)),
    fetchedAt: new Date().toISOString()
  };
}
