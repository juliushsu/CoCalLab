import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';

/**
 * 封測測試帳號快速入口
 * 角色對應 CaCalLab organization_members.role (member_role enum)：
 *   owner | admin | editor | viewer
 * 來源：DB pg_enum 查詢確認，2026-03-18
 * 密碼由 infra 統一管理，前端僅作快速填入用途。
 */
const TEST_ACCOUNTS = [
  {
    role: 'owner',
    label: 'Owner',
    email: 'stg-owner@cacalab-test.com',
    password: 'StgTest2024!',
    color: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  {
    role: 'admin',
    label: 'Admin',
    email: 'stg-admin@cacalab-test.com',
    password: 'StgTest2024!',
    color: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  {
    role: 'editor',
    label: 'Editor',
    email: 'stg-editor@cacalab-test.com',
    password: 'StgTest2024!',
    color: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  {
    role: 'viewer',
    label: 'Viewer',
    email: 'stg-viewer@cacalab-test.com',
    password: 'StgTest2024!',
    color: 'bg-slate-50 text-slate-700 border-slate-200',
  },
];

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showTestAccounts, setShowTestAccounts] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/admin/projects');
    } catch (err) {
      console.error('Login error:', err);
      setError(t('auth.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (account: typeof TEST_ACCOUNTS[0]) => {
    setEmail(account.email);
    setPassword(account.password);
    setShowTestAccounts(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-slate-100">
      {/* Staging Top Banner */}
      <div className="fixed top-0 left-0 right-0 z-50 h-8 overflow-hidden bg-amber-500 text-amber-950 text-xs font-bold tracking-widest flex items-center justify-center gap-2 px-4">
        <i className="ri-test-tube-line text-sm w-4 h-4 flex items-center justify-center flex-shrink-0"></i>
        <span className="uppercase hidden sm:inline truncate">
          ⚠ STAGING ENVIRONMENT — 測試環境，資料不進入正式系統
        </span>
        <span className="uppercase sm:hidden truncate">⚠ STAGING ENV</span>
        <span className="px-1.5 py-0.5 bg-amber-950/20 rounded text-amber-900 font-extrabold text-[10px] tracking-widest flex-shrink-0">
          TEST MODE
        </span>
      </div>

      <div className="w-full max-w-md px-6 pt-8">
        <div className="bg-white rounded-2xl border border-amber-200 p-8">
          {/* Staging badge */}
          <div className="flex justify-center mb-4">
            <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-extrabold tracking-widest rounded-full uppercase border border-amber-300">
              STAGING ENVIRONMENT
            </span>
          </div>

          {/* Logo / Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">CaCalLab</h1>
            <p className="text-sm text-slate-600">{t('auth.login', '登入系統')}</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                {t('auth.email', 'Email')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all disabled:bg-slate-100 disabled:cursor-not-allowed text-sm"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                {t('auth.password', '密碼')}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all disabled:bg-slate-100 disabled:cursor-not-allowed text-sm"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium py-3 rounded-lg transition-all disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
            >
              {loading ? (
                <>
                  <i className="ri-loader-4-line animate-spin"></i>
                  <span>{t('auth.loggingIn', '登入中...')}</span>
                </>
              ) : (
                <span>{t('auth.loginButton', '登入')}</span>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-xs text-slate-400">
              <span className="bg-white px-3">或</span>
            </div>
          </div>

          {/* Test Account Quick Login */}
          <div>
            <button
              type="button"
              onClick={() => setShowTestAccounts(!showTestAccounts)}
              className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-sm font-medium text-amber-800 cursor-pointer transition-colors whitespace-nowrap"
            >
              <div className="flex items-center gap-2">
                <i className="ri-test-tube-line text-base w-5 h-5 flex items-center justify-center"></i>
                <span>{t('staging.test_account_login', '測試帳號登入')}</span>
              </div>
              <i
                className={`ri-arrow-${showTestAccounts ? 'up' : 'down'}-s-line text-lg`}
              ></i>
            </button>

            {showTestAccounts && (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-slate-500 px-1">
                  {t('staging.test_account_hint', '點選快速填入測試帳號資訊')}
                </p>
                {TEST_ACCOUNTS.map((account) => (
                  <button
                    key={account.role}
                    type="button"
                    onClick={() => handleQuickLogin(account)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm cursor-pointer hover:opacity-80 transition-opacity ${account.color} whitespace-nowrap`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs uppercase tracking-wide">
                        {account.label}
                      </span>
                      <span className="text-[10px] opacity-50 font-mono">{account.role}</span>
                    </div>
                    <span className="text-xs opacity-70 truncate max-w-[180px]">
                      {account.email}
                    </span>
                  </button>
                ))}
                <p className="text-xs text-slate-400 px-1 pt-1">
                  {t('staging.test_account_note', '* 封測專用帳號，密碼由 infra 統一管理')}
                </p>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          CaCalLab Carbon Accounting Platform &mdash; Staging Build
        </p>
      </div>
    </div>
  );
}
