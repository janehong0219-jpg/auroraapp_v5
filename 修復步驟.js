// 修復建議：更新 AnalyticsDashboard.tsx 中的 handleGenerateAndUpload 函數

// 找到第 41-82 行的 handleGenerateAndUpload 函數，替換為以下代碼：

// 生成並上傳真實5年數據
const handleGenerateAndUpload = async () => {
    const message = '即將生成真實5年長笛學習數據：\n\n' +
        '• 約5000筆練習紀錄\n' +
        '• 每天3次，每次30分鐘\n' +
        '• 27歲女生學習長笛5年\n\n' +
        '生成和上傳約需要2-3分鐘，確定要繼續嗎？';

    if (!confirm(message)) {
        return;
    }

    try {
        setUploading(true);
        setUploadProgress(0);

        // 動態導入真實數據生成器
        const { generateRealisticFiveYearData } = await import('../utils/generateRealisticData');

        // 生成數據（使用 async 版本避免阻塞 UI）
        console.log('🎵 生成真實5年練習數據...');

        // ⚠️ 重點：添加 await 並傳入進度回調
        const testSessions = await generateRealisticFiveYearData((generated, total) => {
            // 生成階段顯示 0-50%
            setUploadProgress((generated / total) * 50);
        });

        console.log(`📊 總計 ${testSessions.length} 筆練習紀錄`);

        // 上傳到 Firebase（分批上傳，每批50筆，顯示 50-100%）
        await uploadPracticeSessions(testSessions, 50, (uploaded, total) => {
            setUploadProgress(50 + (uploaded / total) * 50);
        });

        // 重新載入
        await loadData();

        alert(`✅ 成功生成並上傳 ${testSessions.length} 筆練習數據！\n\n這是一個27歲女生學習長笛5年的真實練習歷程`);
    } catch (error) {
        console.error('上傳失敗:', error);
        alert('❌ 上傳失敗：' + (error as Error).message);
    } finally {
        setUploading(false);
        setUploadProgress(0);
    }
};

// 關鍵修改：
// 1. 第62行：添加 `await` 關鍵字
// 2. 添加進度回調函數顯示生成進度（0-50%）
// 3. 上傳進度改為 50-100%
