import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Building2, 
  Users, 
  Settings, 
  Banknote,
  Sun,
  Moon,
  LogOut,
  ChevronRight,
  X as XIcon
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../components/ui/Card';

interface SidebarProps {
  isMobileMenuOpen?: boolean;
  onClose?: () => void;
}

const navItems = [
  { path: '/companies', label: 'Quản lý Công ty', icon: Building2, hasSub: true },
  { path: '/accounts', label: 'Tài Khoản', icon: Users, hasSub: true },
  { path: '/ai-costs', label: 'Chi phí AI', icon: Banknote },
];

export function Sidebar({ isMobileMenuOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  return (
    <>
      {/* Sidebar Backdrop Overlay for Mobile */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        "fixed md:relative inset-y-0 left-0 z-50 w-72 md:w-64 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 h-full flex flex-col transition-transform duration-300 md:translate-x-0 shadow-2xl md:shadow-none",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-brand-blue dark:text-blue-400">
              Tikovia
            </h1>
            <p className="text-xs text-gray-500 mt-1">Platform Management</p>
          </div>
          <button 
            className="md:hidden p-2 -mr-2 text-gray-400 hover:text-gray-600 rounded-full"
            onClick={onClose}
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => {
                if (window.innerWidth < 768 && onClose) {
                  onClose();
                }
              }}
              className={cn(
                'flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group',
                isActive 
                  ? 'bg-brand-blue/10 text-brand-blue dark:bg-brand-blue/20 dark:text-blue-400' 
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
              )}
            >
              <div className="flex items-center gap-3">
                <item.icon className={cn('w-5 h-5', isActive ? 'text-brand-blue dark:text-blue-400' : 'text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-300')} />
                {item.label}
              </div>
              {item.hasSub && (
                <ChevronRight className={cn('w-4 h-4', isActive ? 'text-brand-blue dark:text-blue-400' : 'text-gray-400')} />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200 dark:border-gray-800 space-y-4">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-5 h-5 text-yellow-500" />
              <span>Giao diện Sáng</span>
            </>
          ) : (
            <>
              <Moon className="w-5 h-5 text-gray-500" />
              <span>Giao diện Tối</span>
            </>
          )}
        </button>

        {/* User Status */}
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-blue text-white flex items-center justify-center font-semibold text-sm">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate w-32">{user?.name}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">{user?.role}</p>
            </div>
          </div>
          <button onClick={logout} className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors cursor-pointer">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
      </aside>
    </>
  );
}
