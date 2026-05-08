export default function CTASection() {
  return (
    <section className="py-32 bg-gradient-to-br from-[#0F766E] to-[#14B8A6]">
      <div className="max-w-5xl mx-auto px-8">
        {/* Text Content */}
        <div className="text-center mb-12">
          <h2 className="text-5xl font-bold text-white leading-tight mb-6">
            立即開始建立第一個專案
          </h2>
          <p className="text-xl text-white/90 leading-relaxed max-w-3xl mx-auto">
            加入 300+ 企業的行列，用更簡單的方式完成碳盤查與 ESG 報告
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex items-center justify-center gap-4 mb-16">
          <button className="group inline-flex items-center gap-3 bg-white hover:bg-gray-50 text-[#0F766E] px-12 py-5 rounded-full text-lg font-medium transition-all duration-300 shadow-xl hover:shadow-2xl whitespace-nowrap cursor-pointer">
            立即開始
            <i className="ri-arrow-right-line text-xl group-hover:translate-x-1 transition-transform"></i>
          </button>
          <button className="group inline-flex items-center gap-3 bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white border-2 border-white/50 px-12 py-5 rounded-full text-lg font-medium transition-all duration-300 whitespace-nowrap cursor-pointer">
            預約示範
            <i className="ri-calendar-line text-xl"></i>
          </button>
        </div>

        {/* Features List */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div className="space-y-2">
            <i className="ri-check-line text-4xl text-white"></i>
            <p className="text-base text-white/90">免費試用 14 天</p>
          </div>
          <div className="space-y-2">
            <i className="ri-customer-service-2-line text-4xl text-white"></i>
            <p className="text-base text-white/90">專業客服支援</p>
          </div>
          <div className="space-y-2">
            <i className="ri-shield-check-line text-4xl text-white"></i>
            <p className="text-base text-white/90">資料安全保障</p>
          </div>
        </div>
      </div>
    </section>
  );
}