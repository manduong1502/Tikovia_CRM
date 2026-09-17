import React from 'react';
import { NavLink, Outlet, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  LayoutDashboard, 
  CalendarDays, 
  Rocket, 
  MessageCircle, 
  Mail, 
  Bot, 
  Users, 
  Settings,
  ChevronLeft,
  LogOut,
  Database,
  MessageSquare,
  Globe,
  Smartphone,
  Sun,
  Moon,
  Menu,
  X as XIcon
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../components/ui/Card';

const rolePermissions = {
  admin: ['view_dashboard', 'view_content_plan', 'manage_content_plan', 'approve_content_plan', 'view_published', 'manage_published', 'manage_channels', 'manage_messages', 'manage_ai_tasks', 'manage_users'],
  content: ['view_dashboard', 'view_content_plan', 'manage_content_plan', 'view_published', 'manage_published'],
  design: ['view_dashboard', 'view_content_plan', 'manage_content_plan', 'view_published', 'manage_published'],
  owner: ['view_dashboard', 'view_content_plan', 'approve_content_plan', 'view_published', 'manage_channels', 'manage_messages', 'manage_ai_tasks', 'manage_users'],
  sale: ['view_dashboard', 'manage_messages']
};

const companyNavItems = [
  { path: '', label: 'Tổng quan', icon: LayoutDashboard, exact: true, perm: 'view_dashboard' },
  { path: 'content-plan', label: 'Kế hoạch nội dung', icon: CalendarDays, perm: 'view_content_plan' },
  { path: 'deploy', label: 'Triển khai', icon: Rocket, perm: 'view_published' },
  { path: 'channels', label: 'Kênh chat', icon: MessageCircle, perm: 'manage_channels' },
  { path: 'messages', label: 'Tin nhắn', icon: Mail, perm: 'manage_messages' },
  { path: 'chatbot-data', label: 'Nội dung Chatbot', icon: Database, perm: 'approve_content_plan' },
  { path: 'ai-tasks', label: 'Tác vụ AI', icon: Bot, perm: 'manage_ai_tasks' },
  { path: 'users', label: 'Người dùng', icon: Users, perm: 'manage_users' },
  { path: 'demo-web', label: 'Demo Web', icon: Globe, perm: 'view_dashboard' },
  { path: 'demo-zalo', label: 'Demo Zalo miniapp', icon: Smartphone, perm: 'view_dashboard' },
  { path: 'settings', label: 'Cài đặt', icon: Settings, perm: 'manage_users' },
];

export function CompanyLayout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  
  const currentRole = user?.role || 'sale';
  const myPermissions = user?.permissions || [];
  
  const filteredNavItems = companyNavItems.filter(item => {
    // Nếu là Khách (Guest), chỉ được thấy 2 tab Demos
    if (currentRole === 'guest') {
      return item.path === 'demo-web' || item.path === 'demo-zalo';
    }
    // Các Role khác tuân theo Permissions lấy từ Database
    return myPermissions.includes(item.perm);
  });
  
  if (currentRole === 'sale') {
    const messagesIndex = filteredNavItems.findIndex(item => item.path === 'messages');
    if (messagesIndex !== -1) {
      filteredNavItems.splice(messagesIndex + 1, 0, {
        path: 'my-messages',
        label: 'Của tôi',
        icon: MessageSquare,
        exact: false,
        perm: 'manage_messages'
      });
    }
  }
  
  const [companyDetails, setCompanyDetails] = React.useState({ name: 'Đang tải...', sub: 'Marketing & Sales Hub' });

  React.useEffect(() => {
    if (id) {
      supabase.from('companies').select('name').eq('id', id).single()
        .then(({ data, error }) => {
          if (!error && data) {
            setCompanyDetails({ name: data.name, sub: 'Marketing & Sales Hub' });
          } else {
            // Hiển thị tên cụ thể nếu đang dùng Acc Khách vào xem Demo
            if (id === 'tikovia-demo') {
               setCompanyDetails({ name: 'Tikovia (Demo Guest)', sub: 'Khách tham quan kho giao diện' });
            } else {
               setCompanyDetails({ name: 'Tikovia Project', sub: 'Marketing & Sales Hub' });
            }
          }
        });
    }
  }, [id]);

  const isOwner = user?.role === 'owner';
  const isPermanent = user?.is_permanent !== false;
  const trialEndsAt = user?.trial_ends_at ? new Date(user.trial_ends_at) : null;
  // Expired if owner, explicitly not permanent, has trial date, and date is past
  const isExpired = isOwner && !isPermanent && trialEndsAt && trialEndsAt.getTime() < Date.now();

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden relative">
      
      {/* Mobile Top Header */}
      <div className="md:hidden absolute top-0 left-0 right-0 h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 z-40">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-gray-900 dark:text-white truncate max-w-[200px] text-base">{companyDetails.name}</span>
        </div>
        <div className="w-8 h-8 rounded-full bg-brand-blue flex items-center justify-center font-bold text-sm shrink-0 text-white shadow-sm">
          {user?.name?.charAt(0) || 'U'}
        </div>
      </div>

      {/* Sidebar Backdrop Overlay for Mobile */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Content */}
      <aside className={cn(
        "fixed md:relative inset-y-0 left-0 z-50 w-72 md:w-64 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col shrink-0 flex-none transition-transform duration-300 md:translate-x-0 shadow-2xl md:shadow-none h-full",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-start">
          <div className="min-w-0 flex-1">
            {['admin', 'content', 'design'].includes(currentRole) && (
              <button 
                onClick={() => navigate('/companies')}
                className="flex items-center text-sm text-gray-500 hover:text-brand-blue mb-4 transition-colors p-1 -ml-1 rounded-md"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Quay lại
              </button>
            )}
            <h1 className="text-xl font-bold text-brand-blue dark:text-blue-400 truncate w-full pr-4">
              {companyDetails.name}
            </h1>
            <p className="text-xs text-gray-500 mt-1 truncate">{companyDetails.sub}</p>
          </div>
          <button 
            className="md:hidden p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-full"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          {filteredNavItems.map((item) => {
            const toPath = item.path ? `/company/${id}/${item.path}` : `/company/${id}`;
            return (
              <NavLink
                key={item.path}
                to={toPath}
                end={item.exact}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive 
                    ? 'bg-brand-blue/10 text-brand-blue dark:bg-brand-blue/20 dark:text-blue-400' 
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
                  isExpired && 'opacity-50 pointer-events-none' // disable clicks if expired
                )}
                onClick={(e) => {
                  if (isExpired) e.preventDefault();
                  if (window.innerWidth < 768) {
                    setIsMobileMenuOpen(false);
                  }
                }}
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={cn('w-5 h-5', isActive ? 'text-brand-blue dark:text-blue-400' : 'text-gray-500 dark:text-gray-400')} />
                    {item.label}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center font-bold text-sm">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user?.name}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold truncate mt-0.5">{user?.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Giao diện Sáng' : 'Giao diện Tối'}
              className="p-2 text-gray-500 hover:text-brand-blue hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-lg transition-colors cursor-pointer relative z-50"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button 
              onClick={logout}
              title="Đăng xuất"
              className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/40 rounded-lg transition-colors cursor-pointer relative z-50"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden overflow-y-auto w-full bg-gray-50 dark:bg-gray-900 relative pt-14 md:pt-0">
        {isExpired ? (
          <div className="absolute inset-0 z-40 bg-white/60 dark:bg-gray-900/80 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="bg-white dark:bg-gray-800 border border-red-100 dark:border-red-900/50 p-10 rounded-2xl shadow-2xl max-w-lg w-full text-center animate-in fade-in zoom-in duration-300">
              <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Rocket className="w-10 h-10 text-red-500 translate-y-1 -translate-x-0.5 rotate-45 opacity-50" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-1 bg-red-600 -rotate-45 block transform"></div>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Tài khoản hết hạn thử nghiệm</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
                Rất tiếc! Mã dùng thử 7 ngày của tài khoản Chủ Công ty đã kết thúc. Vui lòng liên hệ với bộ phận hỗ trợ hoặc Admin hệ thống để gia hạn tài khoản thành vĩnh viễn và tiếp tục sử dụng tất cả tính năng không giới hạn.
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={logout}
                  className="px-6 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition-colors"
                >
                  Đăng xuất
                </button>
                <a 
                  href="https://zalo.me" 
                  target="_blank" 
                  rel="noreferrer"
                  className="px-6 py-2.5 bg-brand-blue hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 shadow-lg shadow-brand-blue/20"
                >
                  <MessageCircle className="w-4 h-4" /> Liên hệ hỗ trợ
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-6 md:p-8 overflow-hidden w-full max-w-[100vw]">
            <Outlet context={{ currentRole, permissions: myPermissions }} />
          </div>
        )}
      </main>
    </div>
  );
}
