import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowRight } from 'lucide-react';
import myLogo from '../assets/logo.png';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase
        .from('tikovia_users')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !data) {
        throw new Error('Sai tài khoản hoặc mật khẩu');
      }

      if (data.password !== password) {
        throw new Error('Sai tài khoản hoặc mật khẩu');
      }

      const userData = {
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role,
        company_id: data.company_id,
        permissions: data.permissions || [],
        is_permanent: data.is_permanent,
        trial_ends_at: data.trial_ends_at
      };

      login(userData);

      // Route based on role
      if (data.role === 'admin' || data.role === 'content' || data.role === 'design') {
        navigate('/companies');
      } else if (data.company_id) {
        navigate(`/company/${data.company_id}`);
      } else {
        setError('Tài khoản lỗi: Không có công ty trực thuộc');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi đăng nhập');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = () => {
    const guestUserData = {
      id: 'guest_user',
      name: 'Khách Tham Quan',
      email: 'guest@tikovia.com',
      role: 'guest',
      company_id: 'tikovia-demo',
      permissions: [],
      is_permanent: true,
      trial_ends_at: null
    };
    login(guestUserData);
    navigate(`/company/tikovia-demo/demo-web`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-brand-blue/30 overflow-hidden">
            <img src={myLogo} alt="Logo" className="w-full h-full object-contain p-2" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          Tikovia Platform
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          Hệ thống Quản lý Marketing đa luồng
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow-xl rounded-2xl sm:px-10 border border-gray-100 dark:border-gray-800">
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-medium border border-red-100 dark:border-red-900/50 flex justify-center">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email / Tên đăng nhập
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  required
                  className="appearance-none block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand-blue focus:border-brand-blue sm:text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Mật khẩu
              </label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  className="appearance-none block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand-blue focus:border-brand-blue sm:text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Button type="submit" disabled={loading} className="w-full justify-center flex gap-2 shadow-md">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Đăng nhập nền tảng'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </Button>
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">Hoặc</span>
              </div>
            </div>

            <div>
              <Button 
                type="button" 
                onClick={handleGuestLogin} 
                className="w-full justify-center flex gap-2 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-800/50 dark:hover:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
              >
                Đăng nhập với tư cách Khách
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
