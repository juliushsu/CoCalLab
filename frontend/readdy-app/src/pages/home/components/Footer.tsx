export default function Footer() {
  return (
    <footer className="bg-[#1A2332] text-white py-20">
      <div className="max-w-7xl mx-auto px-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12 mb-16">
          {/* Left - Brand */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-[#14B8A6] to-[#0F766E] rounded-xl flex items-center justify-center">
                <i className="ri-leaf-line text-2xl text-white"></i>
              </div>
              <h3 className="text-4xl font-bold">CaCalLab</h3>
            </div>
            <p className="text-base text-gray-300 leading-relaxed max-w-md">
              碳計算實驗室 / カコラボ
              <br />
              為台灣 ESG 市場打造的專業碳資料整理平台，協助中小企業快速建立第一版可用報告。
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="w-10 h-10 rounded-full border border-white/30 flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer">
                <i className="ri-mail-line text-lg"></i>
              </a>
              <a href="#" className="w-10 h-10 rounded-full border border-white/30 flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer">
                <i className="ri-linkedin-fill text-lg"></i>
              </a>
              <a href="#" className="w-10 h-10 rounded-full border border-white/30 flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer">
                <i className="ri-facebook-fill text-lg"></i>
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">產品</h4>
            <ul className="space-y-3">
              <li><a href="#" className="text-sm text-gray-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap">功能特色</a></li>
              <li><a href="#" className="text-sm text-gray-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap">使用案例</a></li>
              <li><a href="#" className="text-sm text-gray-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap">價格方案</a></li>
              <li><a href="#" className="text-sm text-gray-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap">更新日誌</a></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">公司</h4>
            <ul className="space-y-3">
              <li><a href="#" className="text-sm text-gray-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap">關於我們</a></li>
              <li><a href="#" className="text-sm text-gray-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap">聯絡我們</a></li>
              <li><a href="#" className="text-sm text-gray-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap">部落格</a></li>
              <li><a href="#" className="text-sm text-gray-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap">職涯機會</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom - Copyright */}
        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-400">
            © 2025 CaCalLab. All rights reserved.
          </p>
          <div className="flex items-center gap-8">
            <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors cursor-pointer whitespace-nowrap">隱私政策</a>
            <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors cursor-pointer whitespace-nowrap">服務條款</a>
            <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors cursor-pointer whitespace-nowrap">Cookie 政策</a>
          </div>
        </div>
      </div>
    </footer>
  );
}