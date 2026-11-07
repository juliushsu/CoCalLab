# Claude 回覆收件與待裁定事項 — 2026-11-07

**RECEIVED／WAITING_CTO；發布HOLD。** 遠端新增固定文件提交[507a94ea334c3a65f06d75955a365218112df84d](https://github.com/juliushsu/CoCalLab/blob/507a94ea334c3a65f06d75955a365218112df84d/docs/delivery/CLAUDE_INTEGRATION_REVIEW_REPLY_20261107.md)，已保留原文及歷史合入PR28工作分支，沒有強推或改應用ba2c7a56。

回覆對應固定入口9839e1f的H/R/D/L/M及I1–I6，明確區分歷史SHA與最終ba2；**Claude沒有重跑任何測試**。主代理已讀總覽及相關來源段落，本文件不是全文逐行複核、獨立實測或CTO裁定。

## 四類P2（審查者評級，未自動裁定）

| ID | 審查意見／固定來源 | 接續範圍 |
|---|---|---|
| X1／R-P2b／M-3 | 一般可寫活動／計算仍能改結果，generate-report會讀到再由006封存；core schema618–632、generate-report130 | 與先前明列「計算來源／整表防改寫仍OPEN」有重疊，不能解讀006保存一致性已證業務真實。需CTO選界線，不能直接禁止所有activity writes而破壞既有人工建檔 |
| R-P2a | 004 catalog存在不證新handler已部署；舊recalculate_project_atomic仍有service_role EXECUTE，回退handler可能忽略lookup | 已備固定source/bundle manifest只能補部署證據，不能假稱修掉舊權限。固定ba2 handler的lookup已有直接返回分支，不能把回退情境說成正常路徑已重現。是否revoke及回復相容性須定向核對，不執行雲端grant/revoke |
| M-1 | SECURITY DEFINER classify_document_atomic對MANUAL status/review_note無provider/status fence；002 trigger依current_user | 來源有不帶MANUAL條件的UPDATE（202603160010:36–44）；需要create/confirm→classify的本機反例與最小fence，尚未在本輪執行或修改 |
| M-2 | process_document_atomic把同文件既有latest設false並插新draft；005 finish仍調舊RPC | 來源202603160009:33–60及005 finish；需要MANUAL前後process/舊confirm交集反例。只停用Mock前端／樣板enabled=false不是修復SQL/API繞路 |

保留原review對H、I及歷史L/D在006後的來源支持結論，但不能因此關閉上述跨組意見。新review不能變成雲端套用、正式部署或擴大授權依據。

## 歷史、推論與待核對

- L-F1／D-F1／D-F2在歷史版本存在，原回覆判006一般client路徑已封；不重複把它們當ba2仍同缺陷。
- I-P3-4的「切scope／重登後同元件busy不清」需補實際React觸發證據：固定ba2的ProtectedRoute以authEpoch/user/path/search組成Fragment key，會重掛子頁。不能忽略此key直接把同元件假設當已重現；目前仍待釐清，非本文件關閉或接受。
- I-P3-1並行snapshot誤判、X4鎖序／deadlock為來源推論；兩獨立SQL連線仍NOT_RUN。
- legacy報告不可匯出、帶報告project/org刪除、schema變更與full-row seal相容性、非MANUAL間接引用與service maintenance保留政策等，依原回覆「需CTO裁定」節逐項處理，不自行重封存／刪除／放寬權限。
- 本輪工具／文件獨立review「無未解P1/P2」僅針對**部署準備工具與文件範圍**，不是否決Claude對應用提出的四類P2。

另由本輪獨立reviewer有限source-only對照：X1與既有OPEN重疊；R-P2a為部署漂移情境而非ba2正常路徑重現；M-1/M-2有來源支持、未實測；I-P3-4因keyed remount前提未涵蓋而證據不足。這不是CTO評級或關閉裁定。

## 工作狀態

本機部署準備及人工手冊已交付；原生Deno另有14入口型別FAIL，與本review不同問題，均保留證據。Owner已完成登入與限定Supabase唯讀盤點，並選獨立Micro UAT、提供累計預算與14天保留期；不再WAITING_LOGIN或等待同一費用授權。尚未建資源，先解決CTO／相容性前置，其他雲端操作界線沿用。應用修復範圍／權限及新候選採用待CTO裁定，不重開H0或整案稽核。
