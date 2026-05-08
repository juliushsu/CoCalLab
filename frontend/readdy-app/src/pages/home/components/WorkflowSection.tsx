export default function WorkflowSection() {
  const steps = [
    {
      number: '01',
      title: '建立組織與專案',
      description: '設定公司組織架構，建立報告期間與專案，開始碳盤查流程',
      icon: 'ri-building-line'
    },
    {
      number: '02',
      title: '上傳單據與文件',
      description: '上傳發票、單據、證明文件，系統自動辨識並產生草稿資料',
      icon: 'ri-upload-cloud-line'
    },
    {
      number: '03',
      title: '確認排放活動資料',
      description: '審核草稿資料，確認排放活動分類與數值，建立正式資料記錄',
      icon: 'ri-checkbox-circle-line'
    },
    {
      number: '04',
      title: '產出與管理報告版本',
      description: '產出 ESG 報告，追蹤版本變更，下載與分享給利害關係人',
      icon: 'ri-file-text-line'
    }
  ];

  return (
    <section id="workflow" className="py-24 bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-[#1A2332] mb-6">
            簡單 4 步開始使用
          </h2>
          <p className="text-xl text-[#64748B] max-w-3xl mx-auto leading-relaxed">
            從建立專案到產出報告，CaCalLab 讓碳盤查流程更簡單
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div 
              key={index}
              className="relative bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
            >
              {/* Step Number */}
              <div className="absolute -top-6 left-8">
                <div className="w-16 h-16 bg-gradient-to-br from-[#14B8A6] to-[#0F766E] rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-2xl font-bold text-white">{step.number}</span>
                </div>
              </div>

              {/* Icon */}
              <div className="mt-12 mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-[#CCFBF1] to-[#99F6E4] rounded-xl flex items-center justify-center">
                  <i className={`${step.icon} text-3xl text-[#0F766E]`}></i>
                </div>
              </div>

              {/* Content */}
              <h3 className="text-xl font-semibold text-[#1A2332] mb-3">{step.title}</h3>
              <p className="text-base text-[#64748B] leading-relaxed">{step.description}</p>

              {/* Arrow (except last item) */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                  <i className="ri-arrow-right-line text-3xl text-[#14B8A6]"></i>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}