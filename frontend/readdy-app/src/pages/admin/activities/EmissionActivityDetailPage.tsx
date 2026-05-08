import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import AdminLayout from '../../../components/layout/AdminLayout';
import LoadingState from '../../../components/base/LoadingState';
import ErrorState from '../../../components/base/ErrorState';
import StatusBadge from '../../../components/base/StatusBadge';
import ConfirmDialog from '../../../components/base/ConfirmDialog';
import type { EmissionActivity, EmissionScope, InclusionStatus, ActivityStatus } from '../../../types/activity';

const EmissionActivityDetailPage = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // 狀態管理
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<EmissionActivity | null>(null);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [verifying, setVerifying] = useState(false);
  
  // TODO: 實際 API 呼叫
  // useEffect(() => {
  //   if (id) {
  //     fetchActivityDetail(id);
  //   }
  // }, [id]);
  
  // const fetchActivityDetail = async (activityId: string) => {
  //   setLoading(true);
  //   setError(null);
  //   try {
  //     const { data, error } = await supabase
  //       .from('emission_activities')
  //       .select('*, projects(name), uploaded_documents(file_name), extracted_document_drafts(id)')
  //       .eq('id', activityId)
  //       .single();
  //     
  //     if (error) throw error;
  //     setActivity(data);
  //   } catch (err: any) {
  //     setError(err.message);
  //   } finally {
  //     setLoading(false);
  //   }
  // };
  
  // Mock 資料（待 Supabase 連接後移除）
  useEffect(() => {
    const mockActivity: EmissionActivity = {
      id: id || '1',
      project_id: '1',
      project_name: '2024 年度企業碳盤查',
      source_type: 'document',
      source_draft_id: 'draft-001',
      source_document_id: 'doc-001',
      source_document_name: 'receipt_2024_01_15.pdf',
      activity_date: '2024-01-15',
      activity_name: '辦公室電費',
      activity_description: '2024年1月辦公室電費支出，包含照明、空調、電腦設備等用電',
      amount: 15000,
      currency: 'TWD',
      vendor: '台灣電力公司',
      category: '電力',
      emission_scope: 'scope2',
      emission_category: '外購電力',
      inclusion_status: 'include',
      activity_data: {
        electricity_kwh: 5000,
        billing_period: '2024-01',
        meter_reading_start: 12345,
        meter_reading_end: 17345,
      },
      emission_factor_id: 'ef-001',
      emission_factor_name: '台灣電力排放係數 2024',
      emission_factor_value: 0.509,
      emission_factor_unit: 'kgCO₂e/kWh',
      co2e_amount: 2.545,
      co2e_unit: 'tCO₂e',
      calculation_method: '用電度數 × 排放係數 = 5000 kWh × 0.509 kgCO₂e/kWh = 2545 kgCO₂e = 2.545 tCO₂e',
      calculated_at: '2024-01-16T10:30:00Z',
      activity_status: 'calculated',
      tags: ['電力', '辦公室', '固定排放'],
      metadata: {
        building: '總部大樓',
        floor: '3F',
        department: '行政部',
      },
      created_by: 'user-001',
      created_at: '2024-01-16T09:00:00Z',
      updated_at: '2024-01-16T10:30:00Z',
    };
    setActivity(mockActivity);
  }, [id]);
  
  // 驗證活動
  const handleVerify = async () => {
    if (!activity) return;
    
    setVerifying(true);
    try {
      // TODO: 實際 API 呼叫
      // const { error } = await supabase
      //   .from('emission_activities')
      //   .update({
      //     activity_status: 'verified',
      //     verified_by: currentUser.id,
      //     verified_at: new Date().toISOString(),
      //     verification_notes: verificationNotes,
      //   })
      //   .eq('id', activity.id);
      // 
      // if (error) throw error;
      
      // Mock 更新
      setActivity({
        ...activity,
        activity_status: 'verified',
        verified_by: 'user-002',
        verified_at: new Date().toISOString(),
        verification_notes: verificationNotes,
      });
      
      setShowVerifyDialog(false);
      setVerificationNotes('');
      alert(t('activities.verifySuccess'));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setVerifying(false);
    }
  };
  
  // 重新計算
  const handleRecalculate = async () => {
    if (!activity) return;
    
    // TODO: 實際 API 呼叫
    // await supabase.functions.invoke('recalculate-emissions', {
    //   body: { activity_id: activity.id }
    // });
    
    alert('重新計算功能將在連接 Supabase 後實作');
  };
  
  // 編輯活動
  const handleEdit = () => {
    navigate(`/admin/activities/${activity?.id}/edit`);
  };
  
  // 查看來源草稿
  const handleViewSourceDraft = () => {
    if (activity?.source_draft_id) {
      navigate(`/admin/documents/drafts?draft_id=${activity.source_draft_id}`);
    }
  };
  
  // 查看來源文件
  const handleViewSourceDocument = () => {
    if (activity?.source_document_id) {
      navigate(`/admin/documents/list?document_id=${activity.source_document_id}`);
    }
  };
  
  // 取得狀態顏色
  const getStatusColor = (status: ActivityStatus): 'gray' | 'blue' | 'green' | 'yellow' | 'red' => {
    switch (status) {
      case 'draft': return 'gray';
      case 'confirmed': return 'blue';
      case 'calculated': return 'yellow';
      case 'verified': return 'green';
      default: return 'gray';
    }
  };
  
  const getScopeColor = (scope: EmissionScope): 'gray' | 'blue' | 'green' | 'yellow' | 'red' => {
    switch (scope) {
      case 'scope1': return 'red';
      case 'scope2': return 'yellow';
      case 'scope3': return 'blue';
      default: return 'gray';
    }
  };
  
  const getInclusionColor = (status: InclusionStatus): 'gray' | 'blue' | 'green' | 'yellow' | 'red' => {
    switch (status) {
      case 'include': return 'green';
      case 'exclude': return 'gray';
      case 'pending': return 'yellow';
      default: return 'gray';
    }
  };
  
  // 格式化日期時間
  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('zh-TW');
  };
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-TW');
  };
  
  // 格式化金額
  const formatAmount = (amount?: number, currency?: string) => {
    if (!amount) return '-';
    return `${currency || 'TWD'} ${amount.toLocaleString()}`;
  };
  
  // 格式化排放量
  const formatEmissions = (amount?: number, unit?: string) => {
    if (!amount) return '-';
    return `${amount.toFixed(3)} ${unit || 'tCO₂e'}`;
  };
  
  if (loading) {
    return (
      <AdminLayout>
        <LoadingState />
      </AdminLayout>
    );
  }
  
  if (error) {
    return (
      <AdminLayout>
        <ErrorState message={error} />
      </AdminLayout>
    );
  }
  
  if (!activity) {
    return (
      <AdminLayout>
        <ErrorState message="找不到活動資料" />
      </AdminLayout>
    );
  }
  
  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* 頁面標題與操作 */}
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => navigate('/admin/activities')}
              className="text-sm text-gray-600 hover:text-gray-900 mb-2 flex items-center"
            >
              <i className="ri-arrow-left-line mr-1"></i>
              {t('common.back')}
            </button>
            <h1 className="text-3xl font-bold text-gray-900">{activity.activity_name}</h1>
            <p className="mt-2 text-sm text-gray-600">{activity.project_name}</p>
          </div>
          <div className="flex items-center gap-3">
            {activity.activity_status === 'calculated' && (
              <button
                onClick={() => setShowVerifyDialog(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap"
              >
                <i className="ri-checkbox-circle-line mr-2"></i>
                {t('activities.detailPage.verifyButton')}
              </button>
            )}
            <button
              onClick={handleRecalculate}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              <i className="ri-refresh-line mr-2"></i>
              {t('activities.detailPage.recalculateButton')}
            </button>
            <button
              onClick={handleEdit}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap"
            >
              <i className="ri-edit-line mr-2"></i>
              {t('activities.detailPage.editButton')}
            </button>
          </div>
        </div>
        
        {/* 警告訊息 */}
        {activity.inclusion_status === 'pending' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start">
            <i className="ri-alert-line text-yellow-600 text-xl mr-3 mt-0.5"></i>
            <div>
              <h3 className="text-sm font-medium text-yellow-800">
                {t('activities.warnings.pendingInclusion')}
              </h3>
            </div>
          </div>
        )}
        
        {!activity.co2e_amount && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start">
            <i className="ri-information-line text-blue-600 text-xl mr-3 mt-0.5"></i>
            <div>
              <h3 className="text-sm font-medium text-blue-800">
                {t('activities.warnings.notCalculated')}
              </h3>
            </div>
          </div>
        )}
        
        {activity.activity_status !== 'verified' && activity.co2e_amount && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start">
            <i className="ri-information-line text-blue-600 text-xl mr-3 mt-0.5"></i>
            <div>
              <h3 className="text-sm font-medium text-blue-800">
                {t('activities.warnings.notVerified')}
              </h3>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左側：基本資訊與排放資訊 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 基本資訊 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {t('activities.detailPage.basicInfo')}
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    {t('activities.fields.activityDate')}
                  </label>
                  <p className="text-sm text-gray-900">{formatDate(activity.activity_date)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    {t('activities.fields.activityStatus')}
                  </label>
                  <StatusBadge
                    status={t(`activities.activityStatus.${activity.activity_status}`)}
                    color={getStatusColor(activity.activity_status)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    {t('activities.fields.vendor')}
                  </label>
                  <p className="text-sm text-gray-900">{activity.vendor || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    {t('activities.fields.category')}
                  </label>
                  <p className="text-sm text-gray-900">{activity.category || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    {t('activities.fields.amount')}
                  </label>
                  <p className="text-sm text-gray-900 font-medium">
                    {formatAmount(activity.amount, activity.currency)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    {t('activities.fields.sourceType')}
                  </label>
                  <p className="text-sm text-gray-900">
                    {t(`activities.sourceType.${activity.source_type}`)}
                  </p>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    {t('activities.fields.activityDescription')}
                  </label>
                  <p className="text-sm text-gray-900">{activity.activity_description || '-'}</p>
                </div>
                {activity.tags && activity.tags.length > 0 && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      {t('activities.fields.tags')}
                    </label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {activity.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* 排放資訊 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {t('activities.detailPage.emissionInfo')}
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    {t('activities.fields.emissionScope')}
                  </label>
                  <StatusBadge
                    status={t(`activities.scope.${activity.emission_scope}`)}
                    color={getScopeColor(activity.emission_scope)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    {t('activities.fields.inclusionStatus')}
                  </label>
                  <StatusBadge
                    status={t(`activities.inclusion.${activity.inclusion_status}`)}
                    color={getInclusionColor(activity.inclusion_status)}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    {t('activities.fields.emissionCategory')}
                  </label>
                  <p className="text-sm text-gray-900">{activity.emission_category || '-'}</p>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    {t('activities.fields.co2eAmount')}
                  </label>
                  <p className="text-2xl font-bold text-teal-600">
                    {formatEmissions(activity.co2e_amount, activity.co2e_unit)}
                  </p>
                </div>
              </div>
            </div>
            
            {/* 計算資訊 */}
            {activity.co2e_amount && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  {t('activities.detailPage.calculationInfo')}
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      {t('activities.fields.emissionFactor')}
                    </label>
                    <p className="text-sm text-gray-900">{activity.emission_factor_name || '-'}</p>
                    {activity.emission_factor_value && (
                      <p className="text-xs text-gray-500 mt-1">
                        {activity.emission_factor_value} {activity.emission_factor_unit}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      {t('activities.fields.calculationMethod')}
                    </label>
                    <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg font-mono">
                      {activity.calculation_method || '-'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      {t('activities.fields.calculatedAt')}
                    </label>
                    <p className="text-sm text-gray-900">{formatDateTime(activity.calculated_at)}</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* 驗證資訊 */}
            {activity.verified_at && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  {t('activities.detailPage.verificationInfo')}
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      {t('activities.fields.verifiedAt')}
                    </label>
                    <p className="text-sm text-gray-900">{formatDateTime(activity.verified_at)}</p>
                  </div>
                  {activity.verification_notes && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        {t('activities.fields.verificationNotes')}
                      </label>
                      <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">
                        {activity.verification_notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* 右側：資料來源追溯與附加資訊 */}
          <div className="space-y-6">
            {/* 資料來源追溯 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {t('activities.detailPage.sourceTracing')}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    {t('activities.fields.sourceType')}
                  </label>
                  <p className="text-sm text-gray-900">
                    {t(`activities.sourceType.${activity.source_type}`)}
                  </p>
                </div>
                
                {activity.source_draft_id ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-2">
                      {t('activities.fields.sourceDraft')}
                    </label>
                    <button
                      onClick={handleViewSourceDraft}
                      className="w-full px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm flex items-center justify-center"
                    >
                      <i className="ri-file-list-3-line mr-2"></i>
                      {t('activities.detailPage.viewSourceDraft')}
                    </button>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      {t('activities.fields.sourceDraft')}
                    </label>
                    <p className="text-sm text-gray-400">{t('activities.detailPage.noSourceDraft')}</p>
                  </div>
                )}
                
                {activity.source_document_id ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-2">
                      {t('activities.fields.sourceDocument')}
                    </label>
                    <button
                      onClick={handleViewSourceDocument}
                      className="w-full px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm flex items-center justify-center"
                    >
                      <i className="ri-file-text-line mr-2"></i>
                      {activity.source_document_name || t('activities.detailPage.viewSourceDocument')}
                    </button>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      {t('activities.fields.sourceDocument')}
                    </label>
                    <p className="text-sm text-gray-400">{t('activities.detailPage.noSourceDocument')}</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* 附加資訊 */}
            {activity.metadata && Object.keys(activity.metadata).length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  {t('activities.detailPage.additionalInfo')}
                </h2>
                <div className="space-y-3">
                  {Object.entries(activity.metadata).map(([key, value]) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-gray-500 mb-1 capitalize">
                        {key.replace(/_/g, ' ')}
                      </label>
                      <p className="text-sm text-gray-900">{String(value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* 建立資訊 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {t('common.createdAt')}
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    {t('common.createdAt')}
                  </label>
                  <p className="text-sm text-gray-900">{formatDateTime(activity.created_at)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    {t('common.updatedAt')}
                  </label>
                  <p className="text-sm text-gray-900">{formatDateTime(activity.updated_at)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* 驗證對話框 */}
      <ConfirmDialog
        isOpen={showVerifyDialog}
        onClose={() => setShowVerifyDialog(false)}
        onConfirm={handleVerify}
        title={t('activities.verifyDialog.title')}
        message={t('activities.verifyDialog.message')}
        confirmText={t('common.confirm')}
        cancelText={t('common.cancel')}
        confirmButtonClass="bg-green-600 hover:bg-green-700"
        loading={verifying}
      >
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('activities.verifyDialog.notesLabel')}
          </label>
          <textarea
            value={verificationNotes}
            onChange={(e) => setVerificationNotes(e.target.value)}
            placeholder={t('activities.verifyDialog.notesPlaceholder')}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
      </ConfirmDialog>
    </AdminLayout>
  );
};

export default EmissionActivityDetailPage;