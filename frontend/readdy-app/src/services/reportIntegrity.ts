/** Presentation compatibility only; the server rechecks private authority on every export. */
export function reportIntegrityExportBlock(status: unknown): string | null {
  return status === 'server_verified' ? null : '此報告缺少完整服務端保存證據，僅供歷史檢視，暫不可匯出。請另建新版本，不會自動補簽舊報告。';
}

export function reportIntegrityNotice(status: unknown): string {
  return reportIntegrityExportBlock(status) ?? '此報告標記為服務端保存；每次匯出仍由伺服器核對完整內容、來源映射與目前權限。標記本身不是驗證結果，也不代表內容正確或已完成查驗。';
}
