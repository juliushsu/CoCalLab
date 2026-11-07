# 整合候選基線 — 2026-11-07

RELEASE HOLD；正式 UAT 基準仍為 `7dccd5452152f2495d10ad1437d5d03215166065`。本文件記錄本機來源整合，不代表合併、部署或服務驗收。

## 固定來源與相依鏈

初始完整 checkout：`e565b4fe19ebf088d71c4ab5c553e4c5306215c4`；其中程式候選為 `1b1e82913ee593f4255eb33a92744d597c530b2c`，之後至 e565 僅交付文件／證據。接續分支 `codex/integration-acceptance-20261107` 從 e565 建立，保留所有既有提交。

GitHub PR metadata 與本機 `git merge-base --is-ancestor` 逐邊核對：下表全為 open Draft、未合併；每個前項 HEAD 都是後項 base 且為初始整合候選 ancestor。未 cherry-pick、未 squash、未合併 main。

| PR | 固定 HEAD（含文件） | 程式候選 |
|---|---|---|
| [#21](https://github.com/juliushsu/CoCalLab/pull/21) | `4a50c8b282f11d73a436a3e419f87a24c3a03783` | `815315b121924f86066220b573284016a30d64eb` |
| [#22](https://github.com/juliushsu/CoCalLab/pull/22) | `231c087522203345642b1df50fe65df47aa09be2` | `70b9d738a9bcb011a17124ca35542a5c300b419e` |
| [#23](https://github.com/juliushsu/CoCalLab/pull/23) | `dd808edaef41f0e333e1f8281f3d387b2bcee8be` | `a868b2e283f9ba4ff0f7d4e6e9bc5802170014d7` |
| [#24](https://github.com/juliushsu/CoCalLab/pull/24) | `bfb51c4e2e1929ba98c0b1d595792ff53d2527b2` | `06bad0818625bd9d4f3b685dff50994157b52757` |
| [#25](https://github.com/juliushsu/CoCalLab/pull/25) | `86ceb011f3599bb438f8657a5ef5592f64c9da64` | `411a99d597046f65dd54fc134df5dc0d8346c346` |
| [#26](https://github.com/juliushsu/CoCalLab/pull/26) | `a2ae19c7c7a1a5102f1a1cbbeaba52218db9455e` | `67e546fa6894303ccbff66d829d077b93c5fb8e2` |
| [#27](https://github.com/juliushsu/CoCalLab/pull/27) | `e565b4fe19ebf088d71c4ab5c553e4c5306215c4` | `1b1e82913ee593f4255eb33a92744d597c530b2c` |

完整 machine-readable inventory 見 [source-baseline.json](evidence/integration-baseline-20261107/source-baseline.json)，包含實際相依分支／base SHA 與 migration SHA256。

## 功能保留

比較 PR21 的 base `7666c2f89774dda7626ff655731992874b949f50` 至 e565：router 原有 29 路由保留，另加 `/admin/documents/:documentId/transcribe`，共 30；AdminLayout 原選單保留，新增五階段導覽／本機回饋與 scope 連結。十章報告提示、已核准方案 A 匯出、MANUAL、可信附件 hash、冪等重算、可恢復刪除都在同一祖先鏈。路由存在不能證明功能已可用；Mock OCR／AI 仍 OPEN。

## Migration 順序

初始來源共 40 份；本機 initializer 僅排除三份歷史 fixture seed，fresh PGlite 套用 37 份（非雲端 applied 清單）。按完整檔名升冪套用，不只套下列增量：

1. `202611060001_report_snapshot_atomic_v2.sql`：report request ledger。
2. `202611060002_manual_transcription_v1.sql`：MANUAL。
3. `202611060003_server_attachment_verification.sql`：可信 hash。
4. `202611060004_recalculation_requests.sql`：通用重算。
5. `202611060005_controlled_document_deletion.sql`：刪除／引用 fence／processing lease；替換部分 003 helper，須在其後。

排除僅限合成本機初始化：`202603160008_v1_frontend_fixture_seed.sql`、`202603180007_v1_staging_fixture_alignment.sql`、`202604070005_v1_adjustment_fixture_seed.sql`。正式環境不得據此跳過來源 migration 歷史，須另對照實際 applied 與資料分類。NOT VALID 約束需另驗證，成功套用不代表歷史資料已合法。

## 接續與未驗

下一項正在修復 report 直接寫入／完整保存權威；修前直接 SQL、REST 與 legacy 匯出已可重現缺陷。新 migration 與固定 SHA 另記交付，不把 e565 冒稱為已修復版本。

兩項獨立 SQL 連線並行仍 NOT_RUN；真 Supabase JWT／Storage／Deno、雲端 migration、備份復原及原生選檔／存檔未驗。PGlite、合成 Auth／Storage 及既有 CI 不替代真服務驗收。
