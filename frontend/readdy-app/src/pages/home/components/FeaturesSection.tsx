export default function FeaturesSection() {
  const features = [
    {
      icon: 'ri-building-line',
      title: '組織與專案管理',
      description: '支援政府標案、結案報告、客戶 ESG 交付需求。可依專案、活動、組織、期間管理資料，整理 Net Zero 活動的 ESG 貢獻，讓一次性專案與持續性碳管理都能被完整記錄與追蹤',
      image: 'https://readdy.ai/api/search-image?query=Clean%20modern%20organization%20management%20dashboard%20interface%20with%20hierarchical%20structure%20view%20and%20project%20cards%2C%20light%20teal%20accent%20colors%20with%20organized%20layout%2C%20professional%20SaaS%20application%20showing%20multiple%20projects%20and%20teams%2C%20minimalist%20design%20with%20clear%20data%20hierarchy&width=800&height=600&seq=cacallab-feature-org&orientation=landscape'
    },
    {
      icon: 'ri-upload-cloud-line',
      title: '文件上傳與草稿審核',
      description: '上傳單據與證明文件，系統自動辨識並產生草稿，審核後快速轉為正式資料',
      image: 'https://readdy.ai/api/search-image?query=Modern%20document%20upload%20interface%20with%20drag%20and%20drop%20area%20and%20file%20preview%20cards%2C%20clean%20white%20background%20with%20teal%20progress%20indicators%2C%20professional%20file%20management%20system%20showing%20document%20review%20workflow%2C%20organized%20grid%20layout%20with%20status%20badges&width=800&height=600&seq=cacallab-feature-doc&orientation=landscape'
    },
    {
      icon: 'ri-line-chart-line',
      title: '排放活動整理',
      description: '集中管理所有排放活動資料，支援篩選、分類、標記，輕鬆追蹤資料來源',
      image: 'https://readdy.ai/api/search-image?query=Professional%20emission%20activities%20data%20table%20with%20filtering%20options%20and%20category%20tags%2C%20clean%20interface%20with%20organized%20rows%20and%20columns%2C%20light%20teal%20accent%20colors%20showing%20carbon%20footprint%20data%2C%20modern%20SaaS%20dashboard%20with%20clear%20data%20visualization&width=800&height=600&seq=cacallab-feature-activity&orientation=landscape'
    },
    {
      icon: 'ri-file-text-line',
      title: '報告版本管理',
      description: '產出多版本報告，追蹤每次變更歷史，支援下載與預覽，確保資料可追溯',
      image: 'https://readdy.ai/api/search-image?query=Clean%20report%20generation%20interface%20with%20version%20history%20timeline%20and%20preview%20panel%2C%20professional%20document%20management%20system%20showing%20ESG%20report%20sections%2C%20light%20background%20with%20teal%20accents%2C%20organized%20layout%20with%20clear%20typography&width=800&height=600&seq=cacallab-feature-report&orientation=landscape'
    },
    {
      icon: 'ri-shield-user-line',
      title: '權限與多人協作',
      description: '支援多角色權限控管，不同成員擁有不同操作權限，確保資料安全',
      image: 'https://readdy.ai/api/search-image?query=Modern%20team%20collaboration%20interface%20with%20user%20role%20management%20and%20permission%20settings%2C%20clean%20dashboard%20showing%20team%20members%20with%20different%20access%20levels%2C%20light%20teal%20accent%20colors%20with%20organized%20user%20cards%2C%20professional%20SaaS%20application%20design&width=800&height=600&seq=cacallab-feature-collab&orientation=landscape'
    },
    {
      icon: 'ri-global-line',
      title: '多語系介面',
      description: '支援繁體中文、英文、日文介面，適合跨國企業與國際團隊使用',
      image: 'https://readdy.ai/api/search-image?query=Multilingual%20interface%20showcase%20with%20language%20selector%20and%20translated%20content%20panels%2C%20clean%20modern%20design%20showing%20Chinese%20English%20Japanese%20text%20examples%2C%20light%20background%20with%20teal%20accents%2C%20professional%20international%20SaaS%20application&width=800&height=600&seq=cacallab-feature-i18n&orientation=landscape'
    }
  ];

  return (
    <section id="features" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-[#1A2332] mb-6">
            核心功能特色
          </h2>
          <p className="text-xl text-[#64748B] max-w-3xl mx-auto leading-relaxed">
            CaCalLab 提供完整的碳盤查與 ESG 報告管理功能
          </p>
        </div>

        {/* Features Grid */}
        <div className="space-y-24">
          {features.map((feature, index) => (
            <div 
              key={index}
              className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${
                index % 2 === 1 ? 'lg:flex-row-reverse' : ''
              }`}
            >
              {/* Image */}
              <div className={`${index % 2 === 1 ? 'lg:order-2' : ''}`}>
                <div className="relative rounded-2xl overflow-hidden shadow-xl">
                  <img 
                    src={feature.image}
                    alt={feature.title}
                    className="w-full h-full object-cover object-top"
                  />
                </div>
              </div>

              {/* Content */}
              <div className={`space-y-6 ${index % 2 === 1 ? 'lg:order-1' : ''}`}>
                <div className="w-16 h-16 bg-gradient-to-br from-[#CCFBF1] to-[#99F6E4] rounded-xl flex items-center justify-center">
                  <i className={`${feature.icon} text-4xl text-[#0F766E]`}></i>
                </div>
                <h3 className="text-3xl font-bold text-[#1A2332]">{feature.title}</h3>
                <p className="text-lg text-[#64748B] leading-relaxed">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}