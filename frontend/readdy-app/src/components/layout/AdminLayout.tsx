import { ReactNode, useEffect, useMemo, useState, useCallback } from 'react';
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

/** Sidebar item — leaf or branch */
interface MenuItem {
  label: string;
  path: string;
  icon: string;
  badge?: string;
  comingSoon?: boolean;
  hidden?: boolean;
}

/** Sidebar section — grouping of items */
interface MenuSection {
  header: string;
  headerIcon: string;
  items: MenuItem[];
  /** Which roles can see this section? Empty = visible to all */
  visibleFor?: UserRole[];
  /** Collapsed by default? */
  defaultCollapsed?: boolean;
  /** Visual accent — 'amber' for Platform, undefined for normal */
  accent?: 'amber';
}

/** Mock role for governance-aware navigation */
type UserRole = 'viewer' | 'editor' | 'owner' | 'platform_admin';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  viewer: 1,
  editor: 2,
  owner: 3,
  platform_admin: 4,
};

function hasRole(current: UserRole, required: UserRole): boolean {
  return ROLE_HIERARCHY[current] >= ROLE_HIERARCHY[required];
}

function useSidebarState() {
  const [expandedSections, setExpandedSections] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('cocal_sidebar_sections');
      return raw ? JSON.parse(raw) : [
        'workspace',
        'carbon_inventory',
        'reporting',
        'methodology',
      ];
    } catch {
      return ['workspace', 'carbon_inventory', 'reporting', 'methodology'];
    }
  });

  const [mobileOpen, setMobileOpen] = useState(false);

  const persist = useCallback((next: string[]) => {
    setExpandedSections(next);
    try {
      localStorage.setItem('cocal_sidebar_sections', JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const toggleSection = useCallback((key: string) => {
    setExpandedSections(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      try {
        localStorage.setItem('cocal_sidebar_sections', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const isSectionExpanded = useCallback((key: string) => expandedSections.includes(key), [expandedSections]);

  return { expandedSections, mobileOpen, setMobileOpen, toggleSection, isSectionExpanded, persist };
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user, signOut, role } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { mobileOpen, setMobileOpen, toggleSection, isSectionExpanded } = useSidebarState();

  // ── Menu definition — governance-aware sections ──────────────────────────
  const menuSections: MenuSection[] = useMemo(() => [
    {
      header: t('navigation.sections.workspace', 'Workspace'),
      headerIcon: 'ri-briefcase-line',
      defaultCollapsed: false,
      visibleFor: ['owner', 'platform_admin'],
      items: [
        { label: t('navigation.workspace.overview', 'Workspace'), path: '/admin/organizations', icon: 'ri-building-line' },
        { label: t('navigation.workspace.members', 'Members'), path: '/admin/organizations', icon: 'ri-team-line', badge: t('navigation.internal', 'Internal') },
        { label: t('navigation.workspace.subscription', 'Subscription'), path: '/admin/subscription', icon: 'ri-vip-crown-line' },
      ],
    },
    {
      header: t('navigation.sections.carbonInventory', 'Carbon Inventory'),
      headerIcon: 'ri-leaf-line',
      defaultCollapsed: false,
      items: [
        { label: t('navigation.carbonInventory.projects', 'Projects'), path: '/admin/projects', icon: 'ri-folder-line' },
        {
          label: t('navigation.carbonInventory.documents', 'Documents'),
          path: '/admin/documents',
          icon: 'ri-file-text-line',
        },
        { label: t('navigation.carbonInventory.drafts', 'Drafts'), path: '/admin/documents/drafts', icon: 'ri-draft-line' },
        { label: t('navigation.carbonInventory.activities', 'Emission Activities'), path: '/admin/activities', icon: 'ri-bar-chart-box-line' },
        { label: t('navigation.carbonInventory.analytics', 'Emission Analytics'), path: '/admin/analytics', icon: 'ri-pie-chart-2-line' },
        { label: t('navigation.carbonInventory.adjustments', 'Carbon Adjustments'), path: '/admin/carbon-adjustments', icon: 'ri-exchange-funds-line' },
      ],
    },
    {
      header: t('navigation.sections.reporting', 'Reporting'),
      headerIcon: 'ri-file-chart-line',
      defaultCollapsed: false,
      items: [
        { label: t('navigation.reporting.center', 'Report Center'), path: '/admin/reports', icon: 'ri-file-chart-line' },
        { label: t('navigation.reporting.history', 'Report History'), path: '/admin/reports/history', icon: 'ri-history-line' },
        { label: t('navigation.reporting.validation', 'Validation'), path: '#', icon: 'ri-shield-check-line', comingSoon: true },
      ],
    },
    {
      header: t('navigation.sections.methodology', 'Methodology'),
      headerIcon: 'ri-flask-line',
      defaultCollapsed: true,
      items: [
        { label: t('navigation.methodology.emissionFactors', 'Emission Factors'), path: '/admin/emission-factors/list', icon: 'ri-database-2-line' },
        { label: t('navigation.methodology.sourceGovernance', 'Source Governance'), path: '/admin/emission-factors/sources', icon: 'ri-global-line' },
        { label: t('navigation.methodology.selfMonitoring', 'Self-Monitoring'), path: '#', icon: 'ri-sensor-line', comingSoon: true },
        { label: t('navigation.methodology.methodology', 'Methodology'), path: '#', icon: 'ri-book-open-line', comingSoon: true },
      ],
    },
    {
      header: t('navigation.sections.productSupplyChain', 'Product & Supply Chain'),
      headerIcon: 'ri-box-3-line',
      defaultCollapsed: true,
      items: [
        { label: t('navigation.productCarbon.cfp', 'Product CFP'), path: '/admin/product-carbon', icon: 'ri-box-3-line' },
        { label: t('navigation.productCarbon.cbam', 'CBAM'), path: '#', icon: 'ri-customer-service-line', comingSoon: true },
      ],
    },
    {
      header: t('navigation.sections.platform', 'Platform'),
      headerIcon: 'ri-settings-3-line',
      defaultCollapsed: true,
      visibleFor: ['platform_admin'],
      accent: 'amber',
      items: [
        { label: t('navigation.platform.aiGovernance', 'AI Governance'), path: '/admin/ai-governance', icon: 'ri-robot-line' },
        { label: t('navigation.platform.aiProviders', 'AI Providers'), path: '#', icon: 'ri-server-line', comingSoon: true },
        { label: t('navigation.platform.featureFlags', 'Feature Flags'), path: '#', icon: 'ri-toggle-line', comingSoon: true },
        { label: t('navigation.platform.environment', 'Environment'), path: '#', icon: 'ri-terminal-line', comingSoon: true },
      ],
    },
  ], [t]);

  // ── Role-based filtering ─────────────────────────────────────────────────
  const visibleSections = useMemo(() => {
    const effectiveRole = (role ?? 'owner') as UserRole;
    return menuSections.filter(sec => {
      if (!sec.visibleFor || sec.visibleFor.length === 0) return true;
      return sec.visibleFor.some(r => hasRole(effectiveRole, r));
    });
  }, [menuSections, role]);

  // ── Initialize default expansions on first mount ────────────────────────
  useEffect(() => {
    visibleSections.forEach(sec => {
      const key = sec.header;
      if (!sec.defaultCollapsed && !isSectionExpanded(key)) {
        toggleSection(key);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────
  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
  };

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

  const { showWarning, countdown, resetIdle, forceLogout } = useIdleTimeout({
    onLogout: handleSignOut,
    enabled: !!user,
  });

  // ── Determine active section ───────────────────────────────────────────
  const activeSectionKey = useMemo(() => {
    const pathname = location.pathname;
    for (const sec of visibleSections) {
      for (const item of sec.items) {
        if (item.path !== '#' && (pathname === item.path || pathname.startsWith(item.path + '/'))) {
          return sec.header;
        }
      }
    }
    return undefined;
  }, [location.pathname, visibleSections]);

  // ── Render menu item ───────────────────────────────────────────────────
  const renderMenuItem = (item: MenuItem, level: number = 0) => {
    const isActive = location.pathname === item.path ||
      (item.path !== '#' && location.pathname.startsWith(item.path + '/'));

    return (
      <li key={item.path + item.label}>
        {item.comingSoon ? (
          <div
            className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap text-gray-400 cursor-not-allowed select-none ${
              level > 0 ? 'ml-4' : ''
            }`}
            style={{ paddingLeft: `${1 + level * 0.75}rem` }}
          >
            <i className={`${item.icon} text-lg w-5 h-5 flex items-center justify-center opacity-50`}></i>
            <span>{item.label}</span>
            <span className="ml-auto px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-semibold rounded">
              {t('common.soon', 'Soon')}
            </span>
          </div>
        ) : (
          <Link
            to={item.path}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-colors ${
              isActive
                ? 'bg-teal-50 text-teal-700'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
            style={{ paddingLeft: `${1 + level * 0.75}rem` }}
          >
            <i className={`${item.icon} text-lg w-5 h-5 flex items-center justify-center`}></i>
            <span className="truncate">{item.label}</span>
            {item.badge && (
              <span className="ml-auto px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-semibold rounded border border-amber-200 whitespace-nowrap">
                {item.badge}
              </span>
            )}
          </Link>
        )}
      </li>
    );
  };

  // ── Render section ─────────────────────────────────────────────────────
  const renderSection = (section: MenuSection) => {
    const isExpanded = isSectionExpanded(section.header);
    const isActiveSection = activeSectionKey === section.header;
    const isPlatform = section.accent === 'amber';

    return (
      <div key={section.header} className="mb-1">
        {/* Section header */}
        <button
          onClick={() => toggleSection(section.header)}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-bold tracking-wider uppercase cursor-pointer whitespace-nowrap select-none transition-colors ${
            isPlatform
              ? isActiveSection
                ? 'bg-amber-100 text-amber-800'
                : 'text-amber-700 hover:bg-amber-50'
              : isActiveSection
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center gap-2">
            <i className={`${section.headerIcon} text-sm w-4 h-4 flex items-center justify-center`}></i>
            <span className="truncate">{section.header}</span>
            {isPlatform && (
              <span className="px-1 py-0 bg-amber-200 text-amber-800 text-[9px] font-extrabold rounded">
                {t('navigation.internal', 'Internal')}
              </span>
            )}
          </div>
          <i
            className={`ri-arrow-down-s-line text-base transition-transform flex-shrink-0 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          ></i>
        </button>

        {/* Section items */}
        {isExpanded && (
          <ul className="mt-1 space-y-0.5">
            {section.items.map(item => renderMenuItem(item))}
          </ul>
        )}
      </div>
    );
  };

  // ── Role badge for current user ────────────────────────────────────────
  const roleBadge = useMemo(() => {
    const effectiveRole = (role ?? 'owner') as UserRole;
    const labels: Record<UserRole, string> = {
      viewer: t('navigation.roles.viewer', 'Viewer'),
      editor: t('navigation.roles.editor', 'Editor'),
      owner: t('navigation.roles.owner', 'Owner'),
      platform_admin: t('navigation.roles.platformAdmin', 'Platform Admin'),
    };
    const colors: Record<UserRole, string> = {
      viewer: 'bg-sky-100 text-sky-700',
      editor: 'bg-teal-100 text-teal-700',
      owner: 'bg-violet-100 text-violet-700',
      platform_admin: 'bg-amber-100 text-amber-700',
    };
    return { label: labels[effectiveRole], color: colors[effectiveRole] };
  }, [role, t]);

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

      {/* Staging Environment Banner */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <StagingBanner />
      </div>

      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 fixed top-8 left-0 right-0 z-40 h-16">
        <div className="flex items-center justify-between h-full px-6">
          <div className="flex items-center gap-3">
            {/* Mobile sidebar toggle */}
            <button
              onClick={() => setMobileOpen(v => !v)}
              className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
              aria-label="toggle sidebar"
            >
              <i className="ri-menu-line text-xl w-5 h-5 flex items-center justify-center"></i>
            </button>
            <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">CC</span>
            </div>
            <h1 className="text-xl font-semibold text-gray-900">CoCalLab</h1>
            {IS_STAGING && (
              <span className="hidden sm:inline px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-extrabold tracking-widest rounded uppercase border border-amber-300 whitespace-nowrap">
                TEST MODE
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Language Switcher */}
            <div className="hidden md:flex items-center gap-2">
              {(['zh', 'en', 'ja'] as const).map(lang => (
                <button
                  key={lang}
                  onClick={() => changeLanguage(lang)}
                  className={`px-3 py-1.5 text-sm rounded-md cursor-pointer whitespace-nowrap ${
                    i18n.language === lang ? 'bg-teal-100 text-teal-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {lang === 'zh' ? '繁中' : lang === 'en' ? 'EN' : '日本語'}
                </button>
              ))}
            </div>

            {/* User Info & Sign Out */}
            <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
                  <i className="ri-user-line text-teal-600 text-lg w-5 h-5 flex items-center justify-center"></i>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-gray-700 max-w-[180px] truncate leading-tight">
                    {user?.email || ''}
                  </span>
                  <span className={`inline-flex items-center self-start px-1.5 py-0.5 rounded text-[10px] font-semibold mt-0.5 ${roleBadge.color}`}>
                    {roleBadge.label}
                  </span>
                </div>
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

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-24 bottom-0 w-64 bg-white border-r border-gray-200 overflow-y-auto z-30 transition-transform duration-200
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <nav className="p-3">
          {/* Environment label */}
          {IS_STAGING && (
            <div className="mb-3 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-md">
              <div className="flex items-center gap-2">
                <i className="ri-test-tube-line text-amber-600 text-xs w-3 h-3 flex items-center justify-center"></i>
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                  {t('staging.env_label', 'Environment')}: {t('staging.env_staging', 'staging')}
                </span>
              </div>
            </div>
          )}

          {/* Read-only indication */}
          {(role === 'viewer') && (
            <div className="mb-3 px-3 py-2 bg-sky-50 border border-sky-200 rounded-md">
              <div className="flex items-center gap-2">
                <i className="ri-eye-line text-sky-600 text-xs w-3 h-3 flex items-center justify-center"></i>
                <span className="text-[11px] font-semibold text-sky-700">
                  {t('navigation.readonlyMode', 'Read-Only Mode')}
                </span>
              </div>
            </div>
          )}

          {/* Sections */}
          {visibleSections.map(renderSection)}
        </nav>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:ml-64 mt-24 p-6">
        {children}
      </main>
    </div>
  );
}
