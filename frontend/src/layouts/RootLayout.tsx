import React from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Menu } from 'lucide-react';

export function RootLayout() {
  const location = useLocation();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  // Root redirects to /companies by default
  if (location.pathname === '/') {
    return <Navigate to="/companies" replace />;
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden relative">
      
      {/* Mobile Top Header */}
      <div className="md:hidden absolute top-0 left-0 right-0 h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 z-30">
        <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 -ml-2 mr-3 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
          <Menu className="w-5 h-5" />
        </button>
        <span className="font-bold text-brand-blue dark:text-blue-400 text-base">Tikovia Admin</span>
      </div>

      <Sidebar 
        isMobileMenuOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)} 
      />

      <main className="flex-1 overflow-x-hidden overflow-y-auto w-full pt-14 md:pt-0">
        <div className="max-w-[100vw] overflow-hidden">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
