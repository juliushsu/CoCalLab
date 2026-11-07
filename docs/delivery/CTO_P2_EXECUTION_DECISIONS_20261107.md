# CTO 四項 P2 執行裁定與邊界 — 2026-11-07

**裁定已收件，直接本機實作；四項都是商用阻擋，RELEASE HOLD。** 依本chat最新CTO明確指令；來源review固定[507a94ea334c3a65f06d75955a365218112df84d](https://github.com/juliushsu/CoCalLab/blob/507a94ea334c3a65f06d75955a365218112df84d/docs/delivery/CLAUDE_INTEGRATION_REVIEW_REPLY_20261107.md)，應用舊候選ba2c7a56，不能用先前測試關閉新缺陷。本文件記已批准方案，不重新要求同一裁定；原review原文保留。

| 阻擋項 | 已批准的方案與工程落點 | 必要反例與合法路徑 |
|---|---|---|
| P2-1 計算來源污染 | 活動保留人工編修但經JWT actor的受控服務/RPC；編輯使舊計算失效；calc client唯讀、server管理；沿既有004 private ledger核對current inputs/current latest results，不新增大型安全框架。新report須可信且有效計算authority；MANUAL附即時計算仍可讀，但需通用重算再產新可信report | 直接REST/SQL改活動與calc、偽版本、改後未算、舊RPC污染均不得出可信report；合法編輯→通用重算→保存與讀回成功；重送不重複建檔/audit |
| P2-2 舊RPC | 核對004/006 wrapper與舊atomic實際呼叫鏈後撤不必要外部EXECUTE；保留definer內部使用，不憑名稱撤權 | 舊handler明確fail closed、新wrapper/lookup正常，回退混合版本不繞ledger；零重複版本與audit |
| P2-3 classify改MANUAL | SQL交易與provider前雙層守護provider/canonical MANUAL marker，保留正常非MANUAL分類 | 直接RPC／舊handler、pending/confirmed/rejected/非latest、確認前後與重送均不改MANUAL status/review_note |
| P2-4 process撤latest | begin/process/finish與MANUAL建立兩方向互斥；歷史MANUAL文件不得改latest／另建活動 | 直接RPC／舊handler、兩種先後與確認前後／重送；拒絕後activity/calc/latest/audit不被污染，非MANUAL處理仍合法 |

## 七項已裁定邊界

1. 歷史report保留讀取並標未驗，不補簽／重封存，不將新計算冒充歷史。上線前交歷史匯出相容方案，由Owner接受影響；這是後續發布驗收，不攔本機修復。
2. org/project有report或受保留來源，首版禁止硬刪並顯示原因；不能cascade繞保留。封存另沿既有契約，不創假archive成功。
3. 計算污染另開小修復PR，仍同一商用blocker；不延後到上線後。
4. 舊RPC縮權先驗呼叫鏈；不執行雲端grant/revoke。
5. 新MANUAL須服務端驗證且仍有效的receipt；歷史不升格，hash不證文件內容真實。
6. 來源保留涵蓋report引用的非MANUAL draft/activity，防刪改斷鏈。
7. seal改明確版本欄位集合，保留舊verifier；新增無關欄位不令所有report失效，也不重封存遮差異。

順帶修正report export busy；權限仍fresh recheck。鎖順序／獨立連線並行保留NOT_RUN，序列與Promise.all不是證據。

## 分工、版本與環境

一名SQL/RPC代理、一名服務/UI代理；主代理維護工具/合成HTTP plumbing並整合；獨立代理最後唯讀交叉審查固定差異。先記舊基準反例再修；每項正反例與合法完整流程留證。相容性另有固定fc3be262bfe931ea37ea8ded194862c0145ce07e的14/14 native PASS；安全工作在其後新候選，不混稱ba2已修。

Owner已選獨立Micro UAT並提供累計預算及14天限制（精確財務額度留受限授權回執）；**最新CTO明定雲端資源仍未授權**，本輪不建立／計費／部署／套migration／建bucket／移資料。不是因環境選擇再卡全案。前置通過後才準備具體UAT執行申請；不自行放寬既有main的唯讀邊界。

## 目前需要的後續裁定

同一批四P2與七項方案目前均已決定，不再標WAITING_CTO停工。完成後交固定候選與精確差異給Claude，只複審四P2及修復交集；需請Owner/CTO轉交時明確提示。歷史匯出相容影響與真正雲端操作包在可審閱時另收Owner驗收，不把此文件當新授權。
