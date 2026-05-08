import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import StagingBanner from '../feature/StagingBanner';
import IdleWarningModal from '../feature/IdleWarningModal';
import { IS_STAGING } from '../../utils/staging';
import { useIdleTimeout } from '../../hooks/useIdleTimeout';

interface AdminLayoutProps {
  children: ReactNode;
}

interface MenuItem {
  label: string;
  path: string;
  icon: string;
  children?: MenuItem[];
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user, signOut } = useAuth();
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['/admin/documents']);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const menuItems: MenuItem[] = [
    {
      label: t('organizations.title'),
      path: '/admin/organizations',
      icon: 'ri-building-line',
    },
    {
      label: t('projects.title'),
      path: '/admin/projects',
      icon: 'ri-folder-line',
    },
    {
      label: t('documents.title'),
      path: '/admin/documents',
      icon: 'ri-file-text-line',
      children: [
        {
          label: t('documents.upload_title'),
          path: '/admin/documents/upload',
          icon: 'ri-upload-line',
        },
        {
          label: t('documents.list_title'),
          path: '/admin/documents/list',
          icon: 'ri-file-list-line',
        },
        {
          label: t('drafts.title'),
          path: '/admin/documents/drafts',
          icon: 'ri-draft-line',
        },
      ],
    },
    {
      label: t('activities.title'),
      path: '/admin/activities',
      icon: 'ri-bar-chart-box-line',
    },
    {
      label: t('emissionFactors.title'),
      path: '/admin/emission-factors',
      icon: 'ri-database-2-line',
      children: [
        {
          label: t('emissionFactors.listTitle'),
          path: '/admin/emission-factors/list',
          icon: 'ri-list-unordered',
        },
        {
          label: t('factorSources.title'),
          path: '/admin/emission-factors/sources',
          icon: 'ri-global-line',
        },
      ],
    },
    {
      label: t('analytics.title'),
      path: '/admin/analytics',
      icon: 'ri-pie-chart-2-line',
    },
    {
      label: t('carbonAdjustments.title'),
      path: '/admin/carbon-adjustments',
      icon: 'ri-exchange-funds-line',
    },
    {
      label: t('aiGovernance.title'),
      path: '/admin/ai-governance',
      icon: 'ri-robot-line',
    },
    {
      label: t('reports.title'),
      path: '/admin/reports',
      icon: 'ri-file-chart-line',
      children: [
        {
          label: t('reportTypes.carbon_inventory'),
          path: '/admin/reports/history',
          icon: 'ri-leaf-line',
        },
        {
          label: t('reportTypes.esg'),
          path: '/admin/reports/esg',
          icon: 'ri-earth-line',
        },
        {
          label: t('reportTypes.ifrs_s1_s2'),
          path: '/admin/reports/ifrs',
          icon: 'ri-bank-line',
        },
      ],
    },
    {
      label: t('productCarbon.title'),
      path: '/admin/product-carbon',
      icon: 'ri-box-3-line',
    },
    {
      label: t('subscription.title'),
      path: '/admin/subscription',
      icon: 'ri-vip-crown-line',
    },
  ];

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  const toggleMenu = (path: string) => {
    setExpandedMenus((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  const isMenuExpanded = (path: string) => expandedMenus.includes(path);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    
    setIsSigningOut(true);
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Sign out failed:', error);
      setIsSigningOut(false);
    }
  };

  // ── Idle timeout ──────────────────────────────────────────────────────────
  const { showWarning, countdown, resetIdle, forceLogout } = useIdleTimeout({
    onLogout: handleSignOut,
    enabled: !!user,
  });

  const renderMenuItem = (item: MenuItem, level: number = 0) => {
    const isActive = item.children
      ? location.pathname.startsWith(item.path)
      : location.pathname === item.path || location.pathname.startsWith(item.path + '/');
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = isMenuExpanded(item.path);

    return (
      <li key={item.path}>
        {hasChildren ? (
          <>
            <button
              onClick={() => toggleMenu(item.path)}
              className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-teal-50 text-teal-700'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
              style={{ paddingLeft: `${1 + level * 0.75}rem` }}
            >
              <div className="flex items-center gap-3">
                <i className={`${item.icon} text-lg w-5 h-5 flex items-center justify-center`}></i>
                <span>{item.label}</span>
              </div>
              <i
                className={`ri-arrow-down-s-line text-lg transition-transform ${
                  isExpanded ? 'rotate-180' : ''
                }`}
              ></i>
            </button>
            {isExpanded && (
              <ul className="mt-1 space-y-1">
                {item.children.map((child) => renderMenuItem(child, level + 1))}
              </ul>
            )}
          </>
        ) : (
          <Link
            to={item.path}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap ${
              isActive
                ? 'bg-teal-50 text-teal-700'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
            style={{ paddingLeft: `${1 + level * 0.75}rem` }}
          >
            <i className={`${item.icon} text-lg w-5 h-5 flex items-center justify-center`}></i>
            <span>{item.label}</span>
          </Link>
        )}
      </li>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Idle Warning Modal */}
      {showWarning && (
        <IdleWarningModal
          countdown={countdown}
          onStayLoggedIn={resetIdle}
          onLogoutNow={forceLogout}
        />
      )}

      {/* Staging Environment Banner — fixed h-8, z-50 */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <StagingBanner />
      </div>

      {/* Top Bar — fixed top-8 (below staging banner) */}
      <header className="bg-white border-b border-gray-200 fixed top-8 left-0 right-0 z-40 h-16">
        <div className="flex items-center justify-between h-full px-6">
          <div className="flex items-center gap-3">
            {/* Mobile sidebar toggle */}
            <button
              onClick={() => setExpandedMenus(prev => prev.includes('__mobile__') ? prev.filter(p => p !== '__mobile__') : [...prev, '__mobile__'])}
              className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
              aria-label="toggle sidebar"
            >
              <i className="ri-menu-line text-xl w-5 h-5 flex items-center justify-center"></i>
            </button>
            <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">CC</span>
            </div>
            <h1 className="text-xl font-semibold text-gray-900">CaCalLab</h1>
            {/* TEST MODE badge — 僅封測環境顯示 */}
            {IS_STAGING && (
              <span className="hidden sm:inline px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-extrabold tracking-widest rounded uppercase border border-amber-300 whitespace-nowrap">
                TEST MODE
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {/* Language Switcher */}
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={() => changeLanguage('zh')}
                className={`px-3 py-1.5 text-sm rounded-md cursor-pointer whitespace-nowrap ${
                  i18n.language === 'zh' ? 'bg-teal-100 text-teal-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                繁中
              </button>
              <button
                onClick={() => changeLanguage('en')}
                className={`px-3 py-1.5 text-sm rounded-md cursor-pointer whitespace-nowrap ${
                  i18n.language === 'en' ? 'bg-teal-100 text-teal-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => changeLanguage('ja')}
                className={`px-3 py-1.5 text-sm rounded-md cursor-pointer whitespace-nowrap ${
                  i18n.language === 'ja' ? 'bg-teal-100 text-teal-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                日本語
              </button>
            </div>

            {/* User Info & Sign Out */}
            <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
                  <i className="ri-user-line text-teal-600 text-lg w-5 h-5 flex items-center justify-center"></i>
                </div>
                <span className="text-sm text-gray-700 max-w-[180px] truncate">
                  {user?.email || ''}
                </span>
              </div>
              <button
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSigningOut ? (
                  <>
                    <i className="ri-loader-4-line animate-spin text-base w-4 h-4 flex items-center justify-center"></i>
                    <span className="hidden sm:inline">{t('common.auth.signing_out')}</span>
                  </>
                ) : (
                  <>
                    <i className="ri-logout-box-line text-base w-4 h-4 flex items-center justify-center"></i>
                    <span className="hidden sm:inline">{t('common.auth.sign_out')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/**
       * Sidebar
       * Desktop (lg+)  : fixed left-0, always visible, main has ml-64
       * Mobile/Tablet  : fixed left-0, toggled via __mobile__ in expandedMenus,
       *                  overlays content (standard admin pattern)
       */}
      <aside
        className={`fixed left-0 top-24 bottom-0 w-64 bg-white border-r border-gray-200 overflow-y-auto z-30 transition-transform duration-200
          ${expandedMenus.includes('__mobile__') ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <nav className="p-4">
          <ul className="space-y-1">
            {menuItems.map((item) => renderMenuItem(item))}
          </ul>
        </nav>
      </aside>

      {/* Mobile overlay backdrop */}
      {expandedMenus.includes('__mobile__') && (
        <div
          className="fixed inset-0 bg-black/30 z-20 lg:hidden"
          onClick={() => setExpandedMenus(prev => prev.filter(p => p !== '__mobile__'))}
        />
      )}

      {/* Main Content — ml-64 on desktop, no shift on mobile */}
      <main className="lg:ml-64 mt-24 p-6">
        {children}
      </main>
    </div>
  );
}