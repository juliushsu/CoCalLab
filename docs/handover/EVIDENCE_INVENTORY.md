# Evidence inventory — public source index
日期：2026-10-31。完整本機逐檔 manifest、即時 database/API/resource parity 與安全結果在 owner 受限 packet，未公開於此 PR。

## Public references
- [Repository](https://github.com/juliushsu/CoCalLab)
- [Baseline commit](https://github.com/juliushsu/CoCalLab/commit/0a90b7b9b499ae382c17293b7dd674b09b0ef020)
- [Backend source](https://github.com/juliushsu/CoCalLab/tree/0a90b7b9b499ae382c17293b7dd674b09b0ef020/backend)
- [Frontend source](https://github.com/juliushsu/CoCalLab/tree/0a90b7b9b499ae382c17293b7dd674b09b0ef020/frontend/readdy-app)
- [Governance documents](https://github.com/juliushsu/CoCalLab/tree/0a90b7b9b499ae382c17293b7dd674b09b0ef020/docs)
- [Owner-provided temporary Readdy entry](https://afyfvg.readdy.co)

## Reproduce baseline inventory
```sh
git rev-parse HEAD
git ls-tree -r 0a90b7b9b499ae382c17293b7dd674b09b0ef020
git rev-list --count 0a90b7b9b499ae382c17293b7dd674b09b0ef020
git status --short --branch
```
Public baseline：267 tracked files、26 commits。原本 tracked tree 與 remote 比對相符；本機未合併來源不可直接覆寫，詳 owner packet。Handover PR 只增加 docs/handover。

## Evidence scope
公開程式已閱讀 routes/services/providers/contracts/handlers/migrations/tests 與治理文件；pure JS tests、type-check、build、lint 結果見測試矩陣。public map 僅表示 source，不宣稱對應雲端部署。

本機探索 Desktop/Documents/Downloads 至深度5，略過 Git/dependencies/venv/build cache；範圍外未知。唯讀 cloud／Drive 取證與本機非公開資料未複製進本 PR。

Temporary homepage 可在瀏覽器讀取；未登入、未驗 hosted SHA。沒有 real AI request、雲端 mutation、migration/seed replay、tenant E2E、PC runtime 或 production deploy。不得將 NOT_RUN 當 PASS。完整環境資訊與安全結果請依 owner 的受限交接流程取得。
