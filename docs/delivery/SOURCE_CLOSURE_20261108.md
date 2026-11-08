# 來源結案表 — 沿用 CTO 已收件裁定

狀態：**來源結案已登錄；真服務未驗；發布 HOLD。** 本輪不重審、不再等待同一份 Claude／CTO 回覆。

裁定依據：本 session 最新 CTO 指示；[同一份 Claude 回覆 e4fd606](https://github.com/juliushsu/CoCalLab/blob/e4fd606eff21e0641352aec1f97b51051542a4b7/docs/delivery/CLAUDE_REPLACEMENT_PROVENANCE_REVIEW_REPLY_20261108.md)。受審產品 `040509777bb1cb60589a01ce7ec176a4ec54cee7`，不是移動 branch HEAD；Claude 明示**未重跑測試**。以下接受既有裁定，不把引用數字改稱本輪重跑。

| 項目 | CTO 結案狀態 | 固定來源／既有證據 | 尚未證明的範圍 |
|---|---|---|---|
| F1 更正來源失真 | SOURCE_CLOSED |040 的002 migration、builder、報告／匯出揭露；e4回覆F1；SQL13、HTTP3及100→120舊報告不變證據 | 真JWT／Storage／Edge與真服務保存／匯出 |
| F2 legacy exclude | SOURCE_CLOSED |040的mode-bound來源檢查；e4回覆F2；原值exclude／correct拒絕／不升格正反例 | 真服務 legacy 合成原件與角色／撤權操作 |
| 原取代請求恢復 | SOURCE_CLOSED |040 service-only recover／server actor與原request；e4恢復交集 | 真服務分頁關閉／重登入／撤權與進行中請求 |
| 排除呈現交集 | SOURCE_CLOSED |040原quantity保留、headline不顯示零；e4排除交集 | 原生使用者操作與跨單位切換 |
| 映射錯誤碼相容小修 | SOURCE_CLOSED |99→040僅002 +6/-1；原負例保留，受影響三檔41PASS；e4相容小修 | 部署混合版本的實際錯誤／回復 |
| N4-R1 INSERT | CLOSED_NAMED_SCHEDULE_ONLY |040獨立PG三PID、真40P01紅例、四具名綠例／3Lock；e4限定範圍 | **UPDATE兩trigger間並行及其他排程仍NOT_RUN** |
| N1／N2／N5、P2-1～3 | 沿先前CTO來源關閉 | 沿前次接續紀錄及既有固定審查；此次無重新評分或新通過數字 | 原有真服務驗收界線保持 |
| P3 高精度 witness／歷史is_latest／effective view規範 | OPEN_QUEUE | e4明列不評；保留歷史計算與證據 | 不藉本輪文件結案、不全面重構 |
| 發布／商用／19+1交付 | HOLD | 本次Owner轉述CTO裁定 | 功能、隔離、復原與代表使用者驗收後另裁定 |

原始依據：[既有執行索引](https://github.com/juliushsu/CoCalLab/blob/5864f4f5cb4f9f47fffae1c33b8f0528156d3371/docs/delivery/evidence/replacement-provenance-20261108/EXECUTION.json)、[程式08162ca CI](https://github.com/juliushsu/CoCalLab/actions/runs/42470929989)。該CI為backend44／整合388PASS+2NOT_RUN／FE241、type/lint/build。SQL13、HTTP3、獨立代理目標與完整套件有重疊，不能加總。原兩個錯誤碼FAIL紀錄仍保留，修正後41PASS與CI0FAIL分開記錄。

## 部署必備，已放入候選包

1. **所有既有專案須明確重新計算，才能建立新版報告。** 進行中的舊重算可能失敗；不得自動重算、重封存、改歷史latest或覆寫舊報告。歷史讀取與原request replay保留原快照。
2. 收據驗證狀態表示**報告產生時**的保存值，不是更正時或目前狀態。活動的即時 lineage 查詢另標「本次查詢時」。原收據仍僅為歷史來源，不佐證更正新值；原件hash驗證也不證明文件業務真實。
3. 新候選 `fd7efcfc6450dbf10f54aa97b65fe48e431b277d` 僅補上述呈現與相關斷言；SQL／RPC／handler／核心服務／權限與040相同，由候選工具逐檔比對。沒有藉標示更動已保存payload或proof。此差異已由本輪本機檢查驗證，不宣稱Claude另審了fd7。

下一關只有 [固定UAT包](UAT_FIXED_CANDIDATE_20261108.md) 的具體環境授權與 [真服務剩餘驗收](UAT_REMAINING_ACCEPTANCE_20261108.md)。預算條件與操作權限分開見 [授權紀錄](UAT_AUTHORIZATION_RECORD_20261108.md)。
