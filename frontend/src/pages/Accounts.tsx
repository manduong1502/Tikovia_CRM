import React, { useState, useEffect } from 'react';
import { Shield, FileText, UserCheck, Users, Plus, X, Save, ShieldCheck, CheckSquare, Square, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Card, cn } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

const permissionsList = [
  { id: 'view_dashboard', label: 'Xem Tổng quan', desc: 'Truy cập Dashboard thống kê' },
  { id: 'view_content_plan', label: 'Xem Kế hoạch Nội dung', desc: 'Đọc danh sách bài viết' },
  { id: 'manage_content_plan', label: 'Chỉnh sửa Kế hoạch Nội dung', desc: 'Thêm, sửa và nộp bản thảo bài viết' },
  { id: 'approve_content_plan', label: 'Duyệt bài Kế hoạch', desc: 'Có quyền Phê duyệt/Từ chối bài duyệt' },
  { id: 'view_published', label: 'Xem Báo cáo Triển khai', desc: 'Xem kho bằng chứng bài viết đã lên sóng mạng xã hội' },
  { id: 'manage_published', label: 'Sửa Báo cáo Triển khai', desc: 'Quyền ghi chỉ tiêu, úp URL báo cáo' },
  { id: 'manage_channels', label: 'Quản lý Kênh', desc: 'Cấu hình và Kết nối Fanpage/Zalo OA' },
  { id: 'manage_messages', label: 'Trực Tin nhắn', desc: 'Xem và nhắn tin trả lời khách hàng Facebook/Zalo' },
  { id: 'manage_ai_tasks', label: 'Tác vụ AI', desc: 'Sử dụng Agent quản lý nhắc việc tự động' },
  { id: 'manage_users', label: 'Quản lý Nhân sự', desc: 'Mời thành viên mới (Chỉ áp dụng với Quyền Tạo Sale)' },
];

const roleMappings: Record<string, string[]> = {
  admin: ['view_dashboard', 'view_content_plan', 'manage_content_plan', 'approve_content_plan', 'view_published', 'manage_published', 'manage_channels', 'manage_messages', 'manage_ai_tasks', 'manage_users'],
  content: ['view_dashboard', 'view_content_plan', 'manage_content_plan', 'view_published', 'manage_published'],
  design: ['view_dashboard', 'view_content_plan', 'manage_content_plan', 'view_published', 'manage_published'],
  owner: ['view_dashboard', 'view_content_plan', 'approve_content_plan', 'view_published', 'manage_channels', 'manage_messages', 'manage_ai_tasks', 'manage_users']
};

export function Accounts() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '123',
    company: '',
    roleKey: 'admin',
    permissions: roleMappings['admin']
  });

  const [companies, setCompanies] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    // Fetch cả danh sách công ty để map tên
    const { data: comp } = await supabase.from('companies').select('id, name');
    if (comp) setCompanies(comp);
    
    // Fetch toàn bộ user
    const { data: usersData, error } = await supabase.from('tikovia_users').select('*').order('created_at', { ascending: false });
    if (usersData) {
      setUsers(usersData);
    }
    setLoading(false);
  };

  const handleRoleChange = (selectedRole: string) => {
    setFormData(prev => ({
      ...prev,
      roleKey: selectedRole,
      permissions: roleMappings[selectedRole] || [],
      // Cố tình chuyển đổi cty khi chọn Role chủ cty để mô phỏng nếu mảng tồn tại
      company: selectedRole === 'owner' && companies.length > 0 ? companies[0].id : ''
    }));
  };

  const togglePermission = (permId: string) => {
    setFormData(prev => {
      const isChecked = prev.permissions.includes(permId);
      return {
        ...prev,
        permissions: isChecked 
          ? prev.permissions.filter(id => id !== permId) 
          : [...prev.permissions, permId],
        roleKey: 'custom'
      };
    });
  };

  const openAddModal = () => {
    setFormData({
      name: '',
      email: '',
      password: '123',
      company: '',
      roleKey: 'admin',
      permissions: roleMappings['admin']
    });
    setIsModalOpen(true);
  };

  const saveUserToDB = async () => {
    if (!formData.name || !formData.email) return alert('Thiếu thông tin');
    setIsSaving(true);
    try {
      const payload: any = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.roleKey,
        company_id: formData.company || null,
        permissions: formData.permissions
      };
      
      if (formData.roleKey === 'owner') {
        payload.is_permanent = false;
        payload.trial_ends_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      } else {
        payload.is_permanent = true;
      }
      
      const { error } = await supabase.from('tikovia_users').insert([payload]);
      
      if (error) {
        alert('Lỗi thêm user: ' + error.message);
      } else {
        setIsModalOpen(false);
        fetchData();
      }
    } catch (err) {
      console.log(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpgrade = async (userId: string) => {
    try {
      const { error } = await supabase.from('tikovia_users').update({
        is_permanent: true,
        trial_ends_at: null
      }).eq('id', userId);
      if (!error) {
        fetchData();
      } else {
        alert('Lỗi gia hạn: ' + error.message);
      }
    } catch(err) {
      console.log(err);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 relative animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Quản lý Tài khoản tổng (Hệ thống)</h2>
          <p className="text-sm text-gray-500 mt-1">Kiểm soát tập trung toàn bộ nhân sự các module Tikovia và cấp tài khoản Khách hàng (Owners)</p>
        </div>
        <Button onClick={openAddModal} className="gap-2 shadow-sm shadow-brand-blue/20 bg-brand-blue hover:bg-blue-700 text-white w-full sm:w-auto justify-center">
          <Plus className="w-4 h-4 flex-shrink-0" />
          <span className="whitespace-nowrap">Cấp tài khoản mới</span>
        </Button>
      </div>

      <Card className="p-0 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-blue" />
            Danh sách Toàn bộ Tài khoản
          </h3>
        </div>
        {loading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center">
            <UserCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Hệ thống chưa ghi nhận tài khoản nào do bạn quản lý.</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full scrollbar-thin">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-white dark:bg-gray-900">
                <tr className="border-b border-gray-100 dark:border-gray-800 text-[13px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <th className="px-6 py-4">Hồ sơ Cán bộ / Khách hàng</th>
                  <th className="px-6 py-4">Thông tin đăng nhập</th>
                  <th className="px-6 py-4">Vai trò (Role)</th>
                  <th className="px-6 py-4">Thuộc Doanh Nghiệp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-[14px]">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-900 dark:text-white">{u.name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600 dark:text-gray-300 font-medium">{u.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide border",
                        u.role === 'admin' && "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30",
                        u.role === 'content' && "bg-blue-50 text-brand-blue border-blue-200 dark:bg-blue-900/30",
                        u.role === 'design' && "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30",
                        u.role === 'owner' && "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30",
                        u.role === 'sale' && "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30",
                        !['admin', 'content', 'design', 'owner', 'sale'].includes(u.role) && "bg-gray-50 text-gray-700 border-gray-200"
                      )}>
                        {u.role === 'admin' ? 'Admin' : u.role === 'content' ? 'Content' : u.role === 'design' ? 'Design' : u.role === 'owner' ? 'Chủ Công ty' : u.role === 'sale' ? 'Sale' : u.role}
                      </span>
                      {u.role === 'owner' && (
                        <div className="mt-2 flex items-center gap-2">
                          {u.is_permanent !== false ? (
                            <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">Vĩnh viễn</span>
                          ) : (
                            <>
                              {u.trial_ends_at && new Date(u.trial_ends_at).getTime() < Date.now() ? (
                                <span className="text-[11px] font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">Hết hạn</span>
                              ) : (
                                <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                  Còn {u.trial_ends_at ? Math.ceil((new Date(u.trial_ends_at).getTime() - Date.now()) / (1000 * 3600 * 24)) : 0} ngày
                                </span>
                              )}
                              <button 
                                onClick={() => handleUpgrade(u.id)}
                                className="text-[10px] font-bold text-white bg-amber-500 hover:bg-amber-600 px-2 py-0.5 rounded shadow-sm transition-colors"
                              >
                                Gia hạn vĩnh viễn
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap">
                        {u.company_id ? companies.find(c => c.id === u.company_id)?.name || 'Đã mất Data Công ty' : 'Tikovia (Hệ Thống)'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Full RBAC Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm overflow-y-auto pt-20 pb-20">
          <Card className="w-full max-w-4xl p-0 overflow-hidden bg-white dark:bg-gray-900 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-brand-blue" />
                Thiết lập Tài khoản Toàn Hệ Thống (RBAC)
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column: User Info */}
              <div className="space-y-5 border-r-0 md:border-r border-gray-100 dark:border-gray-800 pr-0 md:pr-6">
                <h4 className="font-semibold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-2">1. Thông tin Hồ sơ</h4>
                
                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Email / Tên đăng nhập</label>
                  <input 
                    type="text" 
                    className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-brand-blue focus:ring-1 focus:ring-brand-blue text-gray-900 dark:text-white shadow-sm"
                    placeholder="nguyenvan@agency.vn hoặc acc123"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Tên nhân sự / Tổ chức</label>
                  <input 
                    type="text" 
                    className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-brand-blue focus:ring-1 focus:ring-brand-blue text-gray-900 dark:text-white shadow-sm"
                    placeholder="Nguyễn Văn A"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Mật khẩu định danh</label>
                  <input 
                    type="password" 
                    className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-brand-blue focus:ring-1 focus:ring-brand-blue text-gray-900 dark:text-white shadow-sm"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                  />
                  <p className="text-[11px] mt-1 text-gray-500">Mặc định: 123</p>
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Công ty trực thuộc (chọn cho Chủ/Sale)</label>
                  <select 
                    className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-brand-blue focus:ring-1 focus:ring-brand-blue text-gray-900 dark:text-white shadow-sm cursor-pointer disabled:bg-gray-100 disabled:cursor-not-allowed"
                    value={formData.company}
                    onChange={e => setFormData({...formData, company: e.target.value})}
                    disabled={['admin', 'content', 'design'].includes(formData.roleKey)}
                  >
                    <option value="">-- Hệ Thống / Không thuộc công ty nào --</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div className="pt-2">
                  <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-2">Vai trò (Role Template)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      type="button"
                      onClick={() => handleRoleChange('admin')}
                      className={cn("px-3 py-2 text-[13px] font-medium rounded-lg text-center transition-all border col-span-2", formData.roleKey === 'admin' ? "bg-purple-50 border-purple-400 text-purple-700 dark:bg-purple-900/30" : "bg-white border-gray-200 text-gray-600 dark:bg-gray-800")}
                    >👑 Admin Hệ thống</button>
                    <button 
                      type="button"
                      onClick={() => handleRoleChange('content')}
                      className={cn("px-3 py-2 text-[13px] font-medium rounded-lg text-center transition-all border", formData.roleKey === 'content' ? "bg-blue-50 border-brand-blue text-brand-blue dark:bg-blue-900/30" : "bg-white border-gray-200 text-gray-600 dark:bg-gray-800")}
                    >📝 Content Agency</button>
                    <button 
                      type="button"
                      onClick={() => handleRoleChange('design')}
                      className={cn("px-3 py-2 text-[13px] font-medium rounded-lg text-center transition-all border", formData.roleKey === 'design' ? "bg-cyan-50 border-cyan-400 text-cyan-700 dark:bg-cyan-900/30" : "bg-white border-gray-200 text-gray-600 dark:bg-gray-800")}
                    >🎨 Design Team</button>
                    <button 
                      type="button"
                      onClick={() => handleRoleChange('owner')}
                      className={cn("px-3 py-2 text-[13px] font-medium rounded-lg text-center transition-all border", formData.roleKey === 'owner' ? "bg-amber-50 border-amber-400 text-amber-700 dark:bg-amber-900/30" : "bg-white border-gray-200 text-gray-600 dark:bg-gray-800")}
                    >👔 Chủ Cty Khách</button>
                  </div>
                </div>
              </div>

              {/* Right Column: Permission Matrix */}
              <div className="space-y-4">
                <div className="flex justify-between items-end border-b border-gray-100 dark:border-gray-800 pb-2">
                  <h4 className="font-semibold text-gray-900 dark:text-white">2. Ma trận Quyền hạn Access</h4>
                  <span className="text-[11px] text-gray-500 font-medium px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">
                    Đã tick: {formData.permissions.length}/10
                  </span>
                </div>
                
                <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {permissionsList.map(perm => {
                    const isChecked = formData.permissions.includes(perm.id);
                    return (
                      <div 
                        key={perm.id} 
                        onClick={() => togglePermission(perm.id)}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-xl border transition-all select-none cursor-pointer", 
                          isChecked ? "bg-blue-50/50 border-blue-200 shadow-sm dark:bg-blue-900/10 dark:border-blue-800/50" : "bg-white border-gray-100 hover:border-gray-300 dark:bg-gray-800 dark:border-gray-700",
                        )}
                      >
                        <div className={cn("mt-0.5 transition-colors", isChecked ? "text-brand-blue" : "text-gray-300 dark:text-gray-600")}>
                          {isChecked ? <CheckSquare className="w-5 h-5 fill-blue-100 dark:fill-blue-900/50" /> : <Square className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className={cn("text-[14px] font-semibold", isChecked ? "text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400")}>{perm.label}</p>
                          <p className="text-[12px] text-gray-500 mt-0.5">{perm.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 bg-gray-50 dark:bg-gray-800/50">
              <Button 
                variant="outline" 
                onClick={() => setIsModalOpen(false)}
                className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm"
              >
                Hủy bỏ
              </Button>
              <Button 
                onClick={saveUserToDB}
                disabled={isSaving}
                className="gap-2 bg-brand-blue hover:bg-blue-700 text-white shadow-sm px-6"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Lưu tài khoản
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
