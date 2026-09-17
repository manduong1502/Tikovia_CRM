import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RootLayout } from './layouts/RootLayout';
import { CompanyLayout } from './layouts/CompanyLayout';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { Overview } from './pages/company/Overview';
import { ContentPlan } from './pages/company/ContentPlan';
import { PublishedContent } from './pages/company/PublishedContent';
import { Channels } from './pages/company/Channels';
import { Messages } from './pages/company/Messages';
import { ChatbotData } from './pages/company/ChatbotData';
import { Users } from './pages/company/Users';
import { Settings } from './pages/company/Settings';
import { AiTasks } from './pages/company/AiTasks';
import { Accounts } from './pages/Accounts';
import { MyMessages } from './pages/company/MyMessages';
import { Demos } from './pages/company/Demos';

const ProtectedRoute = ({ children, requireGlobalRoles }: { children: React.ReactNode, requireGlobalRoles?: string[] }) => {
  const { isAuthenticated, user } = useAuth();
  
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  
  // Custom redirect for Sale/Owner trying to access admin dashboard
  if (requireGlobalRoles && user && !requireGlobalRoles.includes(user.role)) {
    return <Navigate to={`/company/${user.company_id || ''}`} replace />;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            {/* Main Platform Routes - Locked to Admin/Content/Design */}
            <Route path="/" element={<ProtectedRoute requireGlobalRoles={['admin', 'content', 'design']}><RootLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/companies" replace />} />
              <Route path="companies" element={<Dashboard />} />
              <Route path="accounts" element={<Accounts />} />
              <Route path="settings" element={<div className="p-8 text-black dark:text-white">Cài đặt Platform</div>} />
              <Route path="ai-costs" element={<div className="p-8 text-black dark:text-white">Chi phí AI</div>} />
            </Route>

            {/* Company Context Routes - Accessible to all auth users but visually filtered by their local permission */}
            <Route path="/company/:id" element={<ProtectedRoute><CompanyLayout /></ProtectedRoute>}>
              <Route index element={<Overview />} />
              <Route path="content-plan" element={<ContentPlan />} />
              <Route path="deploy" element={<PublishedContent />} />
              <Route path="channels" element={<Channels />} />
              <Route path="messages" element={<Messages />} />
              <Route path="my-messages" element={<MyMessages />} />
              <Route path="chatbot-data" element={<ChatbotData />} />
              <Route path="users" element={<Users />} />
              <Route path="demo-web" element={<Demos type="web" />} />
              <Route path="demo-zalo" element={<Demos type="zalo" />} />
              <Route path="settings" element={<Settings />} />
              <Route path="ai-tasks" element={<AiTasks />} />
              
              {/* Catch missing nested routes for company */}
              <Route path="*" element={<div className="text-gray-500">Đang phát triển...</div>} />
            </Route>

          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
