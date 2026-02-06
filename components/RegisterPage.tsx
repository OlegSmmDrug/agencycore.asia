import React, { useState } from 'react';
import { authService, type AuthUser } from '../services/authService';

interface RegisterPageProps {
  onRegister: (user: AuthUser) => void;
  onSwitchToLogin?: () => void;
}

const RegisterPage: React.FC<RegisterPageProps> = ({ onRegister, onSwitchToLogin }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password || !organizationName) return;

    if (password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return;
    }

    setIsLoading(true);
    setError('');

    const { user, error: authError } = await authService.registerOrganization({
      companyName: organizationName,
      ownerName: fullName,
      email,
      password,
    });

    if (authError) {
      const msg = authError.message || '';
      if (msg.includes('уже существует') || msg.includes('duplicate') || msg.includes('unique')) {
        setError('Email уже зарегистрирован');
      } else if (msg.includes('password') || msg.includes('пароль')) {
        setError('Пароль слишком слабый. Используйте минимум 6 символов.');
      } else {
        setError('Ошибка регистрации: ' + (msg || 'Попробуйте позже.'));
      }
      setIsLoading(false);
    } else if (user) {
      onRegister(user);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans">
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative overflow-hidden flex-col justify-between p-12 text-white">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[600px] h-[600px] bg-blue-600 rounded-full blur-[100px] opacity-20 animate-pulse"></div>
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[500px] h-[500px] bg-indigo-600 rounded-full blur-[100px] opacity-20"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-slate-800 rounded-full blur-[120px] opacity-10"></div>
        </div>

        <div className="relative z-10 flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
            <span className="text-white text-xl font-bold">A</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AgencyCore</h1>
            <p className="text-slate-400 text-xs tracking-wider uppercase">Enterprise Resource Planning</p>
          </div>
        </div>

        <div className="relative z-10 space-y-8 max-w-lg">
          <h2 className="text-4xl font-light leading-tight">
            Начните управлять своим <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-400">агентством</span> за 2 минуты.
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-5 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
              <p className="text-2xl font-bold text-blue-400 mb-1">14 дней</p>
              <p className="text-sm text-slate-300">Бесплатный пробный период</p>
            </div>
            <div className="p-5 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
              <p className="text-2xl font-bold text-indigo-400 mb-1">Без карты</p>
              <p className="text-sm text-slate-300">Регистрация без оплаты</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-slate-500 flex justify-between items-center">
          <span>© 2024 AgencyCore Inc.</span>
          <span>v1.0.6 Release</span>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md space-y-10">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Создать аккаунт</h2>
            <p className="mt-2 text-slate-500">Начните использовать AgencyCore бесплатно</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                Название организации
              </label>
              <input
                type="text"
                required
                value={organizationName}
                onChange={(e) => {
                  setOrganizationName(e.target.value);
                  setError('');
                }}
                placeholder="Моё агентство"
                className="w-full px-4 py-3.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 transition-all font-medium text-slate-700"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                Ваше имя
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  setError('');
                }}
                placeholder="Иван Иванов"
                className="w-full px-4 py-3.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 transition-all font-medium text-slate-700"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                placeholder="your@email.com"
                className="w-full px-4 py-3.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 transition-all font-medium text-slate-700"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Пароль</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="••••••••"
                className={`w-full px-4 py-3.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 transition-all font-medium text-slate-700 ${error ? 'border-red-400' : 'border-slate-200'}`}
              />
              <p className="text-xs text-slate-500 mt-1">Минимум 6 символов</p>
              {error && <p className="text-xs text-red-500 mt-2 font-medium">{error}</p>}
            </div>

            <button
              type="submit"
              disabled={!fullName || !email || !password || !organizationName || isLoading}
              className={`w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white transition-all transform duration-200 ${
                !fullName || !email || !password || !organizationName || isLoading
                  ? 'bg-slate-300 shadow-none cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-xl hover:scale-[1.01] hover:to-indigo-500'
              }`}
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>Создание аккаунта...</span>
                </div>
              ) : (
                'Создать аккаунт'
              )}
            </button>

            {onSwitchToLogin && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={onSwitchToLogin}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Уже есть аккаунт? Войти
                </button>
              </div>
            )}

            <p className="text-xs text-slate-500 text-center">
              Регистрируясь, вы соглашаетесь с условиями использования и политикой конфиденциальности
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
