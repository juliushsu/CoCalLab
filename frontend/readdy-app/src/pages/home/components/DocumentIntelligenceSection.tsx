export default function DocumentIntelligenceSection() {
  return (
    <section className="py-24 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-7xl mx-auto px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-[#14B8A6]/10 text-[#14B8A6] px-4 py-2 rounded-full text-sm font-medium mb-4">
            <i className="ri-file-text-line"></i>
            文件智能化
          </div>
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            自動辨識與分類，大幅降低人工整理成本
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            支援多種文件格式，自動辨識單據內容並建議分類至排放活動，保留人工審核流程確保準確性
          </p>
        </div>

        {/* Main Content - Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Product Mockup */}
          <div className="relative">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-gray-200">
              <img
                src="https://readdy.ai/api/search-image?query=Modern%20document%20management%20dashboard%20interface%20showing%20file%20upload%20area%20with%20drag%20and%20drop%20zone%2C%20OCR%20text%20recognition%20visualization%20with%20highlighted%20fields%2C%20automatic%20classification%20tags%20and%20confidence%20scores%2C%20clean%20white%20interface%20with%20teal%20accent%20colors%2C%20professional%20SaaS%20application%20design%2C%20data%20extraction%20preview%20cards%2C%20pending%20review%20status%20indicators&width=800&height=600&seq=cacallab-document-intelligence-mockup-v1&orientation=landscape"
                alt="文件智能辨識介面"
                className="w-full h-auto"
              />
            </div>
            {/* Floating Badge */}
            <div className="absolute -bottom-6 -right-6 bg-white rounded-xl shadow-xl p-4 border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 flex items-center justify-center bg-gradient-to-br from-[#14B8A6] to-[#0F766E] rounded-lg">
                  <i className="ri-ai-generate text-2xl text-white"></i>
                </div>
                <div>
                  <div className="text-sm text-gray-500">辨識準確率</div>
                  <div className="text-2xl font-bold text-gray-900">95%+</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Features List */}
          <div className="space-y-8">
            {/* Feature 1 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-[#14B8A6]/10 rounded-lg">
                <i className="ri-file-upload-line text-2xl text-[#14B8A6]"></i>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  支援多種文件格式
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  支援 PDF、Excel、Word、圖片檔（JPG/PNG）、掃描檔，甚至手機拍照的收據與單據，一鍵上傳即可開始處理
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-[#14B8A6]/10 rounded-lg">
                <i className="ri-scan-line text-2xl text-[#14B8A6]"></i>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  自動辨識單據內容
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  運用 OCR 與 AI 技術，自動擷取日期、金額、品項、供應商等關鍵資訊，無需手動輸入，大幅節省時間
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-[#14B8A6]/10 rounded-lg">
                <i className="ri-price-tag-3-line text-2xl text-[#14B8A6]"></i>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  智能分類建議
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  系統自動建議將文件分類至對應的排放活動類別（如：交通運輸、能源使用、廢棄物處理），並標示信心度供參考
                </p>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-[#14B8A6]/10 rounded-lg">
                <i className="ri-checkbox-circle-line text-2xl text-[#14B8A6]"></i>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  保留人工審核流程
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  所有自動辨識結果會進入草稿審核區，由專業人員確認後才正式納入排放活動資料，確保資料準確性與可追溯性
                </p>
              </div>
            </div>

            {/* Feature 5 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-[#14B8A6]/10 rounded-lg">
                <i className="ri-time-line text-2xl text-[#14B8A6]"></i>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  降低 70% 人工整理時間
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  相較於傳統 Excel 手動輸入與整理，文件智能化功能可節省大量時間，讓團隊專注於資料分析與改善策略
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Stats */}
        <div className="mt-20 grid md:grid-cols-3 gap-8">
          <div className="text-center p-6 bg-white rounded-xl border border-gray-200">
            <div className="text-4xl font-bold text-[#14B8A6] mb-2">10+</div>
            <div className="text-gray-600">支援文件格式</div>
          </div>
          <div className="text-center p-6 bg-white rounded-xl border border-gray-200">
            <div className="text-4xl font-bold text-[#14B8A6] mb-2">95%+</div>
            <div className="text-gray-600">辨識準確率</div>
          </div>
          <div className="text-center p-6 bg-white rounded-xl border border-gray-200">
            <div className="text-4xl font-bold text-[#14B8A6] mb-2">70%</div>
            <div className="text-gray-600">節省人工時間</div>
          </div>
        </div>
      </div>
    </section>
  );
}