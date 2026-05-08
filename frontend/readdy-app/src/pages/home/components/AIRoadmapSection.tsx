export default function AIRoadmapSection() {
  const roadmapItems = [
    {
      icon: 'ri-search-eye-line',
      title: 'AI 異常值與缺漏檢查',
      description: '自動偵測資料異常、重複計算與缺漏項目，提升資料品質與報告準確性',
      status: 'Q2 2025'
    },
    {
      icon: 'ri-pie-chart-line',
      title: 'Scope 1/2/3 智能分析',
      description: '自動分類與追蹤直接排放、能源間接排放與其他間接排放，提供完整碳足跡視圖',
      status: 'Q3 2025'
    },
    {
      icon: 'ri-links-line',
      title: '供應鏈足跡追蹤',
      description: '整合上下游供應鏈資料，追蹤產品生命週期碳足跡，支援 Scope 3 完整揭露',
      status: 'Q3 2025'
    },
    {
      icon: 'ri-lightbulb-line',
      title: '減碳改善建議',
      description: 'AI 分析排放熱點，提供具體減碳方案與成本效益評估，協助制定減碳路徑',
      status: 'Q4 2025'
    }
  ];

  return (
    <section className="py-24 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-7xl mx-auto px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-[#14B8A6]/10 text-[#14B8A6] px-4 py-2 rounded-full text-sm font-medium mb-6">
            <i className="ri-rocket-line text-lg"></i>
            即將推出
          </div>
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            AI 驅動的碳管理智能
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            我們正在開發 AI 分析與改善建議功能，讓碳管理不只是資料記錄，更能提供實質減碳洞察與行動方案
          </p>
        </div>

        {/* Roadmap Timeline */}
        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#14B8A6]/20 via-[#14B8A6]/40 to-[#14B8A6]/20 hidden lg:block"></div>

          {/* Roadmap Items */}
          <div className="space-y-12">
            {roadmapItems.map((item, index) => (
              <div
                key={index}
                className={`flex flex-col lg:flex-row items-center gap-8 ${
                  index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'
                }`}
              >
                {/* Content Card */}
                <div className="flex-1 w-full">
                  <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 flex items-center justify-center bg-gradient-to-br from-[#14B8A6] to-[#0F766E] rounded-xl flex-shrink-0">
                        <i className={`${item.icon} text-2xl text-white`}></i>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-xl font-bold text-gray-900">
                            {item.title}
                          </h3>
                          <span className="inline-flex items-center gap-1 bg-[#14B8A6]/10 text-[#14B8A6] px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap">
                            <i className="ri-calendar-line text-sm"></i>
                            {item.status}
                          </span>
                        </div>
                        <p className="text-gray-600 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timeline Dot */}
                <div className="hidden lg:flex items-center justify-center flex-shrink-0">
                  <div className="w-4 h-4 bg-[#14B8A6] rounded-full border-4 border-white shadow-lg"></div>
                </div>

                {/* Spacer for alternating layout */}
                <div className="flex-1 hidden lg:block"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <div className="inline-flex flex-col items-center gap-4 bg-gradient-to-br from-[#14B8A6]/5 to-[#0F766E]/5 rounded-2xl p-8 border border-[#14B8A6]/20">
            <div className="flex items-center gap-2 text-gray-700">
              <i className="ri-information-line text-xl text-[#14B8A6]"></i>
              <span className="text-base font-medium">
                想了解更多 AI 功能規劃？
              </span>
            </div>
            <button className="inline-flex items-center gap-2 bg-[#14B8A6] hover:bg-[#0F766E] text-white px-6 py-3 rounded-full text-base font-medium transition-all duration-300 shadow-lg hover:shadow-xl cursor-pointer whitespace-nowrap">
              預約產品示範
              <i className="ri-arrow-right-line text-lg"></i>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}