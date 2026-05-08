export default function ProblemsSection() {
  const problems = [
    {
      icon: 'ri-file-excel-2-line',
      title: 'Excel 分散、版本混亂',
      description: '多個檔案散落各處，不知道哪個是最新版本，團隊協作困難'
    },
    {
      icon: 'ri-folder-unknow-line',
      title: '文件難追蹤',
      description: '單據、發票、證明文件分散在不同資料夾，找不到原始資料來源'
    },
    {
      icon: 'ri-database-2-line',
      title: '活動資料難整合',
      description: '排放活動資料來自不同部門，整合耗時且容易出錯'
    },
    {
      icon: 'ri-time-line',
      title: '報告整理耗時',
      description: '每次產出報告都要重新整理資料，重複勞動浪費時間'
    },
    {
      icon: 'ri-team-line',
      title: '多人協作容易出錯',
      description: '缺乏權限控管，不同角色的人都能修改核心數據，風險高'
    },
    {
      icon: 'ri-history-line',
      title: '無法追蹤變更歷史',
      description: '資料被修改後無法回溯，不知道誰改了什麼、為什麼改'
    }
  ];

  return (
    <section className="py-24 bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-[#1A2332] mb-6">
            傳統碳盤查流程的痛點
          </h2>
          <p className="text-xl text-[#64748B] max-w-3xl mx-auto leading-relaxed">
            使用 Excel 和人工作業進行碳盤查，企業常面臨以下挑戰
          </p>
        </div>

        {/* Problems Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {problems.map((problem, index) => (
            <div 
              key={index}
              className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-red-50 to-orange-50 rounded-xl flex items-center justify-center mb-6">
                <i className={`${problem.icon} text-4xl text-red-500`}></i>
              </div>
              <h3 className="text-xl font-semibold text-[#1A2332] mb-3">{problem.title}</h3>
              <p className="text-base text-[#64748B] leading-relaxed">{problem.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}