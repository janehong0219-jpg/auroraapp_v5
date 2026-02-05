# 🔧 Firebase 設定修復指南

## 問題診斷

**錯誤訊息**: "❌ 上傳失敗，請檢查 Firebase 配置"

**最可能的原因**: Firestore 安全規則阻止了寫入

---

## ✅ 解決方案（三選一）

### 方案 1: 臨時開放所有權限（最快，用於開發測試）

**步驟**:
1. 前往 [Firebase Console](https://console.firebase.google.com/)
2. 選擇專案：`audioanalyzer-e8354`
3. 左側選單：Firestore Database
4. 點擊頂部「規則」標籤
5. 將規則改為：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;  // ⚠️ 開發測試用，不適合正式環境
    }
  }
}
```

6. 點擊「發布」

**⚠️ 警告**: 這會開放所有讀寫權限，僅用於開發測試！

---

### 方案 2: 只開放 practice_sessions 集合（推薦）

將規則改為：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 允許讀寫 practice_sessions 集合
    match /practice_sessions/{document=**} {
      allow read, write: if true;
    }
    
    // 允許讀寫 analysis_logs 集合（已有的功能）
    match /analysis_logs/{document=**} {
      allow read, write: if true;
    }
    
    // 其他集合拒絕訪問
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

### 方案 3: 使用本地存儲（不需要修改 Firebase）

如果你不想修改 Firebase 規則，可以使用本地存儲版本：

**我可以幫你建立一個使用 LocalStorage 的版本**，這樣就不需要 Firebase。

---

## 🔍 檢查 Firebase 連接

打開瀏覽器的開發者工具 (F12)，查看 Console 標籤，看看有沒有具體的錯誤訊息。

常見錯誤：
- `Missing or insufficient permissions` → 需要修改安全規則
- `Failed to get document` → Firebase 未正確初始化
- `Network error` → 檢查網路連線

---

## 💡 快速測試

修改規則後，重新點擊「🎲 生成測試數據」，應該就能正常上傳了！

---

**你想要哪個方案？**
1. 方案 1 - 最快（我教你設定）
2. 方案 2 - 較安全（我教你設定）
3. 方案 3 - 本地版本（我幫你改代碼）
