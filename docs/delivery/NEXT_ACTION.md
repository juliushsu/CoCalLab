# Next action — 2026-11-09

- **專案目標：進行中／維運程式與備份交付前置；發布 HOLD。** Owner已核准方案A及交付位置，由Owner接收；不再等待同一方案。main維運workflow仍另送固定差異核准，未建立計費資源。
- 本輪分支codex/uat-watchdog-runtime-20261109；新watchdog23/23、workflow契約3/3與YAML parse通過，證據見UAT_WATCHDOG_IMPLEMENTATION_20261109.md。先準備只含一個workflow的main PR，並繼續Owner本機ACL／磁碟／加解密讀回前置。以下舊提案保留歷史，現行機讀授權已標Owner核准。
- [PR #37](https://github.com/juliushsu/CoCalLab/pull/37)，分支 `codex/uat-lifecycle-preflight-20261109`。產品固定 **`fd7efcfc6450dbf10f54aa97b65fe48e431b277d`**；dry-run固定 **`37f8168929260ae696096b85ea628c539bd354b6`**，本次僅補唯讀回執、方案及機讀狀態。原Windows probe固定d7a95a5，既有10個tasks仍停用。正式UAT參考基準7dccd5452152f2495d10ad1437d5d03215166065不變，未合併main／未部署。
- 本輪唯讀收尾／方案A與機讀提案固定 **`ca081cc6c81b102393673d22456febe94a5e2de4`**；後續僅此固定版本接續記錄，不改待核准方案或已測程式。
- **一次核准入口**：`UAT_LIFECYCLE_SCHEDULER_OPTIONS_20261109.md`；`deployment/uat/lifecycle/execution-proposal.json` 為PROPOSAL_ONLY、actual-config flags全false。精確候選workspace、帳務／服務／通知證據及核准包僅在Git／OneDrive外的Owner-only報告，不公開。
- **方案A**：新Railway project `CoCalLab-UAT-LIFECYCLE-01`／environment `uat-lifecycle`／service `uat-lifecycle-cron`／private bucket `uat-lifecycle-backups`；主job UTC 7,22,37,52每15分鐘，GitHub UTC41每小時獨立watchdog。watchdog不拿Supabase／DB／解密key，不刪除。main維運workflow另交固定差異核准，不合併產品候選；新service不用已棄用railway.toml/json。
- **費用與時鐘**：Railway提案最多US$2，包含在累計總US$20；公開單價示例約1.12／14天，不是帳戶報價或credit保證。T0提案取第一個新增計費輔助資源，不等部署完；T0+12天驗最終備份、T0+13天Owner／指定人接收archive/manifest/key並核對可解密、T0+14天停測及退出。新UAT僅在完整驗證且精確新ref匹配後刪；新helper service/bucket退出另綁精確ID及已交接證據，不刪既有資源或唯一備份，不靜默續期。
- **權限與風險**：Supabase scoped PAT只選實際新ref，Project Settings Read-write也能修改該UAT，不是delete-only；拒絕Legacy／all-project／workspace全權。Railway project/env token也可能有deployment變更能力，不能稱只讀。Railway公開網路事件仍為Identified/Partial Outage；Dashboard可開不能替代runner路徑、scope、互斥及送達實測。真bucket沒有native SSE／object lock／lifecycle，不假設自動TTL。
- **按序前置**：Owner核准方案→完成固定provider/backup來源及main維運workflow差異批准→建隔離輔助資源、記T0並測排程／故障通知／scope／連線合成probe→通過才建Supabase新UAT並記ref/入口/expiry、配置僅新ref資格→部署／初始化後立即做真baseline備份復原→接21項真驗收與到期程序。不存在的ref不可能已完成真備份，不等T0+12天才發現缺口。
- **實測與未驗**：既有17/17合成決策與TAP沿37f固定來源，本次未重跑；不與原生10次probe或其他套件加總。本次僅JSON／去敏／狀態一致性及固定程式不變核對。21真服務案例、真排程、provider資格、實際收件、完整還原、真刪除與原生並行仍BLOCKED／NOT_RUN。
- **目前副作用**：本次新資源／新排程／新憑證／通知／雲端寫入全0，新ref／T0／expiry為null。實際配置待方案核准；不把既有UAT總範圍核准當作本次helper／credential／main權限擴張。建議Owner／指定人負責備份接收與例外裁定，最終受限位置及helper退出須建立前確認。
- **下一步**：Owner審受限核准包及公開方案，裁定上述新資源、限範圍資格、故障通知測試、備份交接與精確退出；main維運PR另交固定差異批准。不再要求相同登入、不重做已關閉來源審查，不承諾背景無限運行。

下一條可執行命令（repo root，明示合成、無網路／憑證／排程副作用）：

```powershell
node deployment/uat/lifecycle/lifecycle-dry-run.mjs --scenario expired-missing-backup
```
