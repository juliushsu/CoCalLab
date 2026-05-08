export default function HeroSection() {
  return (
    <section id="hero" className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img 
          src="https://readdy.ai/api/search-image?query=Abstract%20minimalist%20business%20workspace%20with%20clean%20organized%20documents%20and%20digital%20interface%20elements%2C%20soft%20teal%20and%20white%20gradient%20background%20with%20subtle%20geometric%20patterns%2C%20professional%20corporate%20environment%20with%20natural%20lighting%2C%20modern%20ESG%20sustainability%20concept%20visualization%20with%20flowing%20data%20streams&width=1920&height=1080&seq=cacallab-hero-bg-v2&orientation=landscape"
          alt="Background"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/40"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-8 py-32 w-full">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Main Title */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight">
            中小企業也能快速完成
            <br />
            <span className="text-[#14B8A6]">碳盤查與 ESG 報告</span>
          </h1>

          {/* Subtitle */}
          <p className="text-xl md:text-2xl text-white/90 leading-relaxed max-w-3xl mx-auto">
            集中管理組織、專案、文件、排放活動與報告流程
            <br />
            適合需要快速導入、多人協作、可追蹤版本的企業團隊
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
            <a
              href="/login"
              className="inline-flex items-center gap-2 bg-[#14B8A6] hover:bg-[#0F766E] text-white px-8 py-4 rounded-full text-lg font-semibold transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105 cursor-pointer whitespace-nowrap"
            >
              立即開始
              <i className="ri-arrow-right-line text-xl"></i>
            </a>
            <a
              href="#features"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white px-8 py-4 rounded-full text-lg font-semibold transition-all duration-300 border-2 border-white/30 hover:border-white/50 cursor-pointer whitespace-nowrap"
            >
              查看功能
              <i className="ri-arrow-down-line text-xl"></i>
            </a>
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-wrap items-center justify-center gap-8 pt-12 text-white/80">
            <div className="flex items-center gap-2">
              <i className="ri-shield-check-line text-2xl text-[#14B8A6]"></i>
              <span className="text-base">資料安全保障</span>
            </div>
            <div className="flex items-center gap-2">
              <i className="ri-time-line text-2xl text-[#14B8A6]"></i>
              <span className="text-base">免費試用 14 天</span>
            </div>
            <div className="flex items-center gap-2">
              <i className="ri-customer-service-2-line text-2xl text-[#14B8A6]"></i>
              <span className="text-base">專業客服支援</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <i className="ri-arrow-down-line text-3xl text-white/60"></i>
      </div>
    </section>
  );
}