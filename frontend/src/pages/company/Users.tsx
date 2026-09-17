import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Users as UsersIcon, Shield, UserCheck, Plus, Edit, Trash2, X, Save, Building2, ShieldCheck, CheckSquare, Square, Building, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { cn } from '../../components/ui/Card';
import { useAuth } from '../../contexts/AuthContext';

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
  { id: 'manage_users', label: 'Quản lý Nhân sự', desc: 'Mời thành viên mới và cấp quyền' },
];

const roleMappings: Record<string, string[]> = {
  admin: ['view_dashboard', 'view_content_plan', 'manage_content_plan', 'approve_content_plan', 'view_published', 'manage_published', 'manage_channels', 'manage_messages', 'manage_ai_tasks', 'manage_users'],
  content: ['view_dashboard', 'view_content_plan', 'manage_content_plan', 'view_published', 'manage_published'],
  design: ['view_dashboard', 'view_content_plan', 'manage_content_plan', 'view_published', 'manage_published'],
  owner: ['view_dashboard', 'view_content_plan', 'approve_content_plan', 'view_published', 'manage_channels', 'manage_messages', 'manage_ai_tasks', 'manage_users'],
  sale: ['view_dashboard', 'manage_messages']
};

export function Users() {
  const { user } = useAuth();
  const currentUserRole = user?.role || 'sale';
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  
  const { id: companyId } = useParams();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '123',
    roleKey: 'content',
    permissions: roleMappings['content']
  });

  const [users, setUsers] = useState<any[]>([
    { id: 1, name: 'Admin System', email: 'admin@tikovia.vn', roleName: 'Tikovia Admin', status: 'Hoạt động', joinDate: '1/1/2026' }
  ]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [systemContentUsers, setSystemContentUsers] = useState<any[]>([]);

  useEffect(() => {
    fetchUsers();
  }, [companyId]);

  const fetchUsers = async () => {
    if (!companyId) return;
    setLoading(true);
    
    // Normal users belonging to company
    const { data: normalData } = await supabase.from('tikovia_users').select('*').eq('company_id', companyId);
    
    // Fetch all content and design users and filter in-memory do lỗi JSONB Supabase filter
    const { data: allAgencyData } = await supabase.from('tikovia_users')
      .select('*')
      .in('role', ['content', 'design']);
      
    const assignedData = (allAgencyData || []).filter(u => 
      (u.permissions || []).includes(`company_assign_${companyId}`)
    );
      
    const combinedData = [...(normalData || [])];
    if (assignedData) {
      assignedData.forEach(au => {
        if (!combinedData.find(c => c.id === au.id)) {
          combinedData.push(au);
        }
      });
    }

    const mapped = combinedData.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      roleName: u.role === 'sale' ? 'Nhân viên Sale' : u.role === 'owner' ? 'Chủ Công Ty' : u.role === 'content' ? 'Content Agency' : u.role === 'design' ? 'Design Team' : u.role,
      status: 'Hoạt động',
      company_id: u.company_id,
      permissions: u.permissions || [],
      joinDate: new Date(u.created_at || Date.now()).toLocaleDateString()
    }));
    
    setUsers(mapped);
    setLoading(false);
  };

  const openAssignModal = async () => {
    setIsAssignModalOpen(true);
    const { data } = await supabase.from('tikovia_users').select('*').in('role', ['content', 'design']).is('company_id', null);
    if (data) {
      setSystemContentUsers(data);
    }
  };

  const assignContentStaff = async (contentUser: any) => {
    const isAssigned = (contentUser.permissions || []).includes(`company_assign_${companyId}`);
    if (isAssigned) {
      alert('Content này đã được gán vào dự án từ trước!');
      return;
    }
    try {
      const newPerms = [...(contentUser.permissions || []), `company_assign_${companyId}`];
      await supabase.from('tikovia_users').update({ permissions: newPerms }).eq('id', contentUser.id);
      setIsAssignModalOpen(false);
      fetchUsers();
    } catch (err) {
      console.error(err);
      alert('Lỗi gán content');
    }
  };

  const handleDeleteUser = async (userToDelete: any) => {
    if (!window.confirm(`Tiếp tục hủy/xóa nhân sự ${userToDelete.name} khỏi dự án?`)) return;
    try {
      if (['content', 'design'].includes(userToDelete.role) && userToDelete.company_id !== companyId) {
        // Gỡ assignment khỏi mảng permissions
        const newPerms = userToDelete.permissions.filter((p: string) => p !== `company_assign_${companyId}`);
        await supabase.from('tikovia_users').update({ permissions: newPerms }).eq('id', userToDelete.id);
      } else {
        // Hard-delete khỏi csdl
        await supabase.from('tikovia_users').delete().eq('id', userToDelete.id);
      }
      fetchUsers();
    } catch (err) {
      console.error(err);
      alert('Lỗi thao tác');
    }
  };

  const handleRoleChange = (selectedRole: string) => {
    setFormData(prev => ({
      ...prev,
      roleKey: selectedRole,
      permissions: roleMappings[selectedRole] || []
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
        roleKey: 'custom' // If manually edited, change role to custom
      };
    });
  };

  const openAddModal = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      password: '123',
      roleKey: 'sale',
      permissions: roleMappings['sale']
    });
    setIsModalOpen(true);
  };

  const saveUserToDB = async () => {
    if (!formData.name || !formData.email) return alert('Nhập đủ thông tin');
    setIsSaving(true);
    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.roleKey,
        company_id: companyId,
        permissions: formData.permissions
      };
      const { error } = await supabase.from('tikovia_users').insert([payload]);
      if (error) {
        alert('Lỗi tạo user: ' + error.message);
      } else {
        setIsModalOpen(false);
        fetchUsers();
      }
    } catch (err) {
      console.log(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 relative animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <UsersIcon className="w-6 h-6 text-brand-blue" />
            Nhân sự & Phân quyền
          </h2>
          <p className="text-sm text-gray-500 mt-1">Hệ thống phân quyền truy cập Đa công ty (Role-Based Access Control)</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {currentUserRole === 'admin' && (
            <Button onClick={openAssignModal} className="gap-2 bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 w-full sm:w-auto justify-center">
              <UserCheck className="w-4 h-4 flex-shrink-0" />
              <span className="whitespace-nowrap">Chỉ định Content (Từ Hệ thống)</span>
            </Button>
          )}
          <Button onClick={openAddModal} className="gap-2 bg-brand-blue hover:bg-blue-700 text-white shadow-sm w-full sm:w-auto justify-center">
            <Plus className="w-4 h-4 flex-shrink-0" />
            <span className="whitespace-nowrap">Thêm thành viên mới</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-6">
        <Card className="flex items-center gap-2 md:gap-4 !p-3 md:!p-6 bg-white dark:bg-gray-900 border-l-4 border-l-brand-blue shadow-sm">
          <div className="p-2 md:p-3 rounded-xl bg-blue-50 dark:bg-blue-900/50 text-brand-blue">
            <Building className="w-4 h-4 md:w-6 md:h-6" />
          </div>
          <div>
            <h4 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white">3</h4>
            <p className="text-[10px] md:text-sm font-medium text-gray-500 dark:text-gray-400">Công ty</p>
          </div>
        </Card>
        <Card className="flex items-center gap-2 md:gap-4 !p-3 md:!p-6 bg-white dark:bg-gray-900 shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="p-2 md:p-3 rounded-xl bg-purple-50 dark:bg-purple-900/50 text-purple-600">
            <Shield className="w-4 h-4 md:w-6 md:h-6" />
          </div>
          <div>
            <h4 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white">1</h4>
            <p className="text-[10px] md:text-sm font-medium text-gray-500 dark:text-gray-400">Admin</p>
          </div>
        </Card>
        <Card className="flex items-center gap-2 md:gap-4 !p-3 md:!p-6 bg-white dark:bg-gray-900 shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="p-2 md:p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/50 text-emerald-600">
            <UsersIcon className="w-4 h-4 md:w-6 md:h-6" />
          </div>
          <div>
            <h4 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white">2</h4>
            <p className="text-[10px] md:text-sm font-medium text-gray-500 dark:text-gray-400">Khách hàng</p>
          </div>
        </Card>
        <Card className="flex items-center gap-2 md:gap-4 !p-3 md:!p-6 bg-white dark:bg-gray-900 shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="p-2 md:p-3 rounded-xl bg-orange-50 dark:bg-orange-900/50 text-orange-600">
            <UserCheck className="w-4 h-4 md:w-6 md:h-6" />
          </div>
          <div>
            <h4 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white">1</h4>
            <p className="text-[10px] md:text-sm font-medium text-gray-500 dark:text-gray-400">Nội bộ</p>
          </div>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 dark:text-white text-lg">Danh sách tài khoản hệ thống</h3>
        </div>
        <div className="overflow-x-auto">
          {/* Desktop: Table */}
          <table className="hidden md:table w-full text-left border-collapse min-w-[900px]">
             <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-[13px] font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">
                <th className="px-6 py-4">Thành viên</th>
                <th className="px-6 py-4">Vai trò bảo mật</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 text-brand-blue flex items-center justify-center font-bold text-sm shrink-0">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white text-[15px]">{user.name}</div>
                        <div className="text-xs text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-bold gap-1.5 shadow-sm border",
                      user.roleName.includes('Admin') 
                        ? "bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/30 dark:border-purple-800/50 dark:text-purple-400" 
                        : user.roleName.includes('Chủ')
                          ? "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/30 dark:border-amber-800/50 dark:text-amber-400"
                          : user.roleName.includes('Design')
                            ? "bg-cyan-50 border-cyan-200 text-cyan-700 dark:bg-cyan-900/30 dark:border-cyan-800/50 dark:text-cyan-400"
                            : "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800/50 dark:text-blue-400"
                    )}>
                      {user.roleName.includes('Admin') ? <Shield className="w-3.5 h-3.5" /> : user.roleName.includes('Design') ? <UsersIcon className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                      {user.roleName}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border",
                      user.status === 'Hoạt động' 
                        ? "text-emerald-700 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/30" 
                        : "text-gray-500 border-gray-200 bg-gray-50 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700"
                    )}>
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full mr-1.5",
                        user.status === 'Hoạt động' ? "bg-emerald-500" : "bg-gray-400"
                      )} />
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                       <button className="p-1.5 text-gray-500 hover:text-brand-blue hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded border border-gray-200 dark:border-gray-700 transition-colors bg-white dark:bg-gray-800 shadow-sm">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteUser(user)} className="p-1.5 text-red-500 hover:text-white hover:bg-red-500 rounded border border-red-200 dark:border-red-900/50 transition-colors bg-white dark:bg-gray-800 shadow-sm">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile: Card view */}
          <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
            {users.map((user) => (
              <div key={user.id} className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 text-brand-blue flex items-center justify-center font-bold text-sm shrink-0">
                  {user.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">{user.name}</span>
                    <span className={cn(
                      "inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border shrink-0",
                      user.roleName.includes('Admin') 
                        ? "bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" 
                        : user.roleName.includes('Chủ')
                          ? "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : user.roleName.includes('Design')
                            ? "bg-cyan-50 border-cyan-200 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400"
                            : "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    )}>
                      {user.roleName}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 truncate">{user.email}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button className="p-1.5 text-gray-400 hover:text-brand-blue rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDeleteUser(user)} className="p-1.5 text-red-400 hover:text-red-600 rounded border border-red-200 dark:border-red-900/50 bg-white dark:bg-gray-800">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* RBAC Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm overflow-y-auto pt-20 pb-20">
          <Card className="w-full max-w-4xl p-0 overflow-hidden bg-white dark:bg-gray-900 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-brand-blue" />
                Thiết lập Tài khoản & Ma trận Quyền hạn (RBAC)
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
                    placeholder="nguyenvan@agency.vn hoặc acc_sale"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Tên nhân sự</label>
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
                  <p className="text-[12px] text-brand-blue mb-2 p-2 bg-blue-50 dark:bg-blue-900/30 rounded border border-blue-100 dark:border-blue-900/50">
                    Tài khoản mới sẽ được tự động giới hạn ở không gian dữ liệu CRM của công ty hiện tại.
                  </p>
                </div>

                <div className="pt-2">
                  <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-2">Vai trò cấp quyền</label>
                  <div className="grid grid-cols-1 gap-2">
                    <button 
                      onClick={() => handleRoleChange('sale')}
                      className={cn("px-3 py-2 text-[13px] font-medium rounded-lg text-center transition-all border", formData.roleKey === 'sale' ? "bg-emerald-50 border-emerald-400 text-emerald-700 dark:bg-emerald-900/30" : "bg-white border-gray-200 text-gray-600 dark:bg-gray-800")}
                    >💬 Nhân viên Sale</button>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-2 italic">Lưu ý: Màn hình này chỉ có thể tạo Nhân sự trực thuộc công ty. Để phân quyền Chủ sở hữu và Admin, vui lòng ra trang Accounts tổng bên ngoài hệ thống.</p>
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
                    const disabledByRole = currentUserRole === 'owner' && !['view_dashboard', 'manage_messages'].includes(perm.id); // Tránh cty khách tự cấp quyền ảo
                    return (
                      <div 
                        key={perm.id} 
                        onClick={() => !disabledByRole && togglePermission(perm.id)}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-xl border transition-all select-none", 
                          isChecked ? "bg-blue-50/50 border-blue-200 shadow-sm dark:bg-blue-900/10 dark:border-blue-800/50" : "bg-white border-gray-100 hover:border-gray-300 dark:bg-gray-800 dark:border-gray-700",
                          disabledByRole ? "opacity-50 cursor-not-allowed grayscale" : "cursor-pointer"
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
      {/* Assign System User Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <Card className="w-full max-w-md p-0 overflow-hidden bg-white dark:bg-gray-900 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
              <h3 className="font-bold flex items-center gap-2 dark:text-white">
                <UserCheck className="w-5 h-5 text-purple-500" />
                Ghép nối Nhân sự Hệ thống
              </h3>
              <button onClick={() => setIsAssignModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-500 mb-4">Các nhân sự thuộc System (như Content Agency, Design Team) làm việc trên dự án này nhưng vẫn giữ quyền và số liệu tách biệt trong hệ thống.</p>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {systemContentUsers.length === 0 ? (
                  <p className="text-sm text-gray-500 p-4 text-center">Chưa có "Nhân viên Nội dung" nào mang nhãn Hệ thống.</p>
                ) : (
                  systemContentUsers.map((contentUser) => {
                    const isAssigned = (contentUser.permissions || []).includes(`company_assign_${companyId}`);
                    return (
                      <div 
                        key={contentUser.id}
                        onClick={() => assignContentStaff(contentUser)} 
                        className={cn(
                          "flex items-center justify-between p-3 border rounded-lg transition-all dark:border-gray-700",
                          isAssigned ? "bg-gray-50 dark:bg-gray-800/50 cursor-not-allowed opacity-60" : "hover:border-brand-blue cursor-pointer dark:hover:border-blue-500"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-brand-blue flex items-center justify-center font-bold text-sm">
                            {(contentUser.name || 'C').charAt(0)}
                          </div>
                          <div>
                            <div className="text-sm font-semibold dark:text-white">{contentUser.name}</div>
                            <div className="text-xs text-gray-500">{contentUser.email}</div>
                          </div>
                        </div>
                        {isAssigned ? (
                          <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded dark:bg-gray-700 dark:text-gray-300 font-medium">Đã cấu hình</span>
                        ) : (
                          <span className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded dark:bg-purple-900/40 dark:text-purple-400 font-medium hover:bg-purple-100">+ Click để gán</span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
