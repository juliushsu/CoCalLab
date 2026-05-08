export default function AudienceSection() {
  const audiences = [
    {
      icon: 'ri-building-4-line',
      title: '中小企業',
      description: '需要快速建立第一版 ESG 報告，但缺乏專業團隊與複雜系統的企業',
      image: 'https://readdy.ai/api/search-image?query=Modern%20small%20business%20office%20with%20professional%20team%20working%20on%20laptops%20and%20documents%2C%20clean%20organized%20workspace%20with%20natural%20lighting%2C%20teal%20accent%20colors%20in%20decor%2C%20collaborative%20environment%20showing%20business%20professionals&width=600&height=400&seq=cacallab-audience-sme&orientation=landscape'
    },
    {
      icon: 'ri-user-star-line',
      title: '顧問與顧問團隊',
      description: '協助多家客戶進行碳盤查，需要集中管理不同客戶專案的顧問公司',
      image: 'https://readdy.ai/api/search-image?query=Professional%20business%20consultant%20presenting%20ESG%20data%20on%20screen%20to%20clients%20in%20modern%20meeting%20room%2C%20clean%20office%20environment%20with%20organized%20presentation%20materials%2C%20teal%20accent%20colors%2C%20collaborative%20consulting%20session&width=600&height=400&seq=cacallab-audience-consultant&orientation=landscape'
    },
    {
      icon: 'ri-file-chart-line',
      title: '需要 ESG 資料管理的公司',
      description: '政府標案、客戶要求或供應鏈要求需提交碳盤查資料的企業',
      image: 'https://readdy.ai/api/search-image?query=Corporate%20office%20with%20professionals%20reviewing%20ESG%20reports%20and%20sustainability%20documents%2C%20modern%20business%20environment%20with%20organized%20data%20charts%20and%20graphs%2C%20light%20teal%20accent%20colors%2C%20professional%20workplace%20setting&width=600&height=400&seq=cacallab-audience-esg&orientation=landscape'
    },
    {
      icon: 'ri-team-line',
      title: '多據點 / 多部門協作團隊',
      description: '需要跨部門、跨據點協作，統一管理碳盤查資料的大型組織',
      image: 'https://readdy.ai/api/search-image?query=Modern%20corporate%20office%20showing%20multiple%20teams%20collaborating%20across%20different%20departments%2C%20organized%20workspace%20with%20digital%20screens%20and%20collaborative%20tools%2C%20teal%20accent%20colors%2C%20professional%20multi-location%20business%20environment&width=600&height=400&seq=cacallab-audience-team&orientation=landscape'
    }
  ];

  return (
    <section id="audience" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-[#1A2332] mb-6">
            適用對象
          </h2>
          <p className="text-xl text-[#64748B] max-w-3xl mx-auto leading-relaxed">
            CaCalLab 適合各種規模與類型的企業與團隊
          </p>
        </div>

        {/* Audiences Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {audiences.map((audience, index) => (
            <div 
              key={index}
              className="group bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
            >
              {/* Image */}
              <div className="relative h-64 overflow-hidden">
                <img 
                  src={audience.image}
                  alt={audience.title}
                  className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                
                {/* Icon */}
                <div className="absolute bottom-6 left-6">
                  <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-lg">
                    <i className={`${audience.icon} text-3xl text-[#0F766E]`}></i>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-8">
                <h3 className="text-2xl font-semibold text-[#1A2332] mb-3">{audience.title}</h3>
                <p className="text-base text-[#64748B] leading-relaxed">{audience.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}