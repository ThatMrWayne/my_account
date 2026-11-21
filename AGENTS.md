# 個人記帳網站

這是以 Google Apps Script 執行的個人記帳網站。 `Code.gs` 從 Google 試算表的「支出明細」讀取資料，`Index.html` 顯示各月支出、筆數及明細，`appsscript.json` 定義 Apps Script 執行環境及唯讀試算表權限。

## 本機驗證

- `npm test` 使用 Node.js 內建工具執行 `test/*.test.cjs` 的後端測試，建議使用 Node.js 22 以上。
- 首次準備瀏覽器測試時，執行 `npm ci` 安裝鎖定的開發依賴，再執行 `npx playwright install chromium` 安裝對應的瀏覽器。
- `npm run test:ui` 使用 Chromium 執行 `ui/*.spec.cjs`。測試用本機伺服器提供正式的 `Index.html`，固定日期並注入非同步的 `google.script.run` 模擬服務。桌面與手機寬度的截圖存於 `test-results/` 各專案的測試子目錄，重跑時會更新。
- `clasp status` 檢查預計上傳的檔案。清單應只有 `Code.gs`、`Index.html`、`appsscript.json`。
- 測試以模擬的 Sheets 和 HtmlService 執行 `Code.gs`，不需要登入 Google，也不讀寫真實記帳資料。

## 真實 Apps Script 網站驗收

Google 登入曾拒絕自動化測試瀏覽器，目前需由有權限的使用者在自己的瀏覽器開啟 Apps Script 的 `/dev` 網址，完成人工驗收。

1. 等待「最近讀取（台灣時間）」出現，核對所選月份的明細列數與金額加總是否等於摘要。
2. 點「重新整理」，確認讀取時間更新、按鈕恢復可用，再核對明細與摘要。
3. 有其他月份時，切換後再核對。只有一個月份時，將跨月切換記為「未驗證」。

只有在真實頁面完成的操作才能記為通過。登入受阻的項目記為「受阻」，本機模擬測試和原始試算表核對另行記錄。登入狀態、真實記帳資料、截圖及驗收紀錄均留在版本控制之外。

## 開發規則

- 開始前用 `git status --short`、`git diff` 和 `git diff --cached` 檢查工作區，保留既有修改。
- 維持試算表唯讀權限。測試資料使用虛構記錄，提交前確認內容沒有登入憑證或真實記帳資料。
- 修改後執行 `npm test` 和 `npm run test:ui`。調整頁面檔名時，讓 `doGet`、實際檔名（含大小寫）及 `.claspignore` 一致。
- 執行 `clasp push`、部署或 `git push` 前，需取得使用者授權。
