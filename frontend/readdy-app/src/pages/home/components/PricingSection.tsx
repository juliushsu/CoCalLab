export default function PricingSection() {
  const plans = [
    {
      name: 'Starter',
      subtitle: '中小企業起步導入',
      description: '適合剛開始進行碳盤查與 ESG 報告的中小企業',
      features: [
        '1 個組織帳號',
        '最多 3 個專案',
        '基礎文件上傳與辨識',
        '排放活動管理',
        '報告版本管理',
        '多語系介面',
        '電子郵件支援',
      ],
      cta: '方案洽詢',
      highlight: false,
      icon: 'ri-seedling-line',
    },
    {
      name: 'Team',
      subtitle: '顧問團隊 / 多專案管理',
      description: '適合顧問公司或需要管理多個客戶專案的團隊',
      features: [
        '最多 5 個組織帳號',
        '無限專案數量',
        '進階文件智能辨識',
        '多人協作與權限管理',
        '自訂報告範本',
        'API 整合支援',
        '優先客服支援',
      ],
      cta: '預約示範',
      highlight: true,
      icon: 'ri-team-line',
    },
    {
      name: 'Enterprise',
      subtitle: '多據點 / 跨組織管理',
      description: '適合大型企業、多據點或需要跨組織整合的企業集團',
      features: [
        '無限組織與專案',
        '企業級文件處理',
        '進階 AI 分析與建議',
        '客製化報告與儀表板',
        '專屬客戶成功經理',
        'SSO 單一登入',
        'SLA 服務保證',
      ],
      cta: '聯絡我們',
      highlight: false,
      icon: 'ri-building-line',
    },
  ];

  return (
    <section id="pricing" className="py-24 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-7xl mx-auto px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-[#14B8A6]/10 text-[#14B8A6] px-4 py-2 rounded-full text-sm font-medium mb-4">
            <i className="ri-price-tag-3-line"></i>
            <span>方案說明</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            選擇適合您的方案
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            無論您是剛起步的中小企業，還是需要管理多個專案的顧問團隊，我們都有適合的方案
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative bg-white rounded-2xl p-8 transition-all duration-300 ${
                plan.highlight
                  ? 'shadow-2xl scale-105 border-2 border-[#14B8A6]'
                  : 'shadow-lg hover:shadow-xl'
              }`}
            >
              {/* Highlight Badge */}
              {plan.highlight && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#14B8A6] to-[#0F766E] text-white px-6 py-2 rounded-full text-sm font-semibold shadow-lg">
                  最受歡迎
                </div>
              )}

              {/* Icon */}
              <div className={`w-16 h-16 flex items-center justify-center rounded-2xl mb-6 ${
                plan.highlight
                  ? 'bg-gradient-to-br from-[#14B8A6] to-[#0F766E]'
                  : 'bg-gray-100'
              }`}>
                <i className={`${plan.icon} text-3xl ${plan.highlight ? 'text-white' : 'text-gray-700'}`}></i>
              </div>

              {/* Plan Name */}
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {plan.name}
              </h3>
              <p className="text-base font-medium text-[#14B8A6] mb-3">
                {plan.subtitle}
              </p>
              <p className="text-sm text-gray-600 mb-6 min-h-[48px]">
                {plan.description}
              </p>

              {/* Price */}
              <div className="mb-6 pb-6 border-b border-gray-200">
                <div className="text-center">
                  <span className="text-sm text-gray-500">內測中</span>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <i className="ri-check-line text-xl text-[#14B8A6] flex-shrink-0 mt-0.5"></i>
                    <span className="text-sm text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <button
                className={`w-full py-3 rounded-full text-base font-semibold transition-all duration-300 cursor-pointer whitespace-nowrap ${
                  plan.highlight
                    ? 'bg-gradient-to-r from-[#14B8A6] to-[#0F766E] text-white hover:shadow-xl hover:scale-105'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                }`}
                onClick={() => {
                  // 可以連結至聯絡表單或預約示範頁面
                  if (plan.cta === '預約示範') {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Additional Info */}
        <div className="text-center">
          <p className="text-base text-gray-600 mb-6">
            所有方案均提供 <span className="font-semibold text-[#14B8A6]">14 天免費試用</span>，無需信用卡
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <i className="ri-shield-check-line text-xl text-[#14B8A6]"></i>
              <span>資料安全保障</span>
            </div>
            <div className="flex items-center gap-2">
              <i className="ri-customer-service-2-line text-xl text-[#14B8A6]"></i>
              <span>專業客服支援</span>
            </div>
            <div className="flex items-center gap-2">
              <i className="ri-refresh-line text-xl text-[#14B8A6]"></i>
              <span>隨時可升級或降級</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}