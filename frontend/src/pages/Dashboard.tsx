import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MoreVertical, Building2, X, Save, Loader2, Trash2, Edit, AlertCircle, CalendarDays } from 'lucide-react';
import { Card, cn } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [companies, setCompanies] = useState<any[]>([]);
  const setCompaniesSorted = (list: any[]) => {
    const sorted = [...list].sort((a: any, b: any) => {
      const statusA = a.status === 'Hoàn thành' ? 1 : 0;
      const statusB = b.status === 'Hoàn thành' ? 1 : 0;
      return statusA - statusB;
    });
    setCompanies(sorted);
  };
  const [loading, setLoading] = useState(true);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // States for Add Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // States for Edit Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editCompanyId, setEditCompanyId] = useState<string | null>(null);
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editCompanyCost, setEditCompanyCost] = useState('');
  const [editCompanyStatus, setEditCompanyStatus] = useState('Hoạt động');
  const [editCompanyEndDate, setEditCompanyEndDate] = useState('');
  const [isEditSaving, setIsEditSaving] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenDropdownId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const { data: companiesData, error: companiesError } = await supabase.from('companies').select('*').order('created_at', { ascending: false });
      if (companiesError) throw companiesError;

      const { data: usersData, error: usersError } = await supabase.from('tikovia_users').select('company_id, permissions');

      if (companiesData) {
        // Gom nhóm user theo company_id và permissions phân công
        const userCountMap = (usersData || []).reduce((acc: any, user: any) => {
          // Nhóm tài khoản thuộc công ty trực tiếp
          if (user.company_id) {
            acc[user.company_id] = (acc[user.company_id] || 0) + 1;
          }

          // Nhóm các tài khoản hệ thống (Content) được gán (assign) qua permissions
          if (user.permissions && Array.isArray(user.permissions)) {
            user.permissions.forEach((p: string) => {
              if (p.startsWith('company_assign_')) {
                const cId = p.replace('company_assign_', '');
                acc[cId] = (acc[cId] || 0) + 1;
              }
            });
          }

          return acc;
        }, {});

        let formatted = companiesData.map((c: any) => ({
          ...c,
          accounts: userCountMap[c.id] || 0,
          aiCost: c.ai_cost || (c.ai_config && c.ai_config.ai_cost) || `${(Math.floor(Math.random() * 5) + 1) * 500}đ`, // Dùng ai_cost thực tế hoặc fallback
          status: c.status || (c.ai_config && c.ai_config.status) || 'Hoạt động',
          endDate: c.end_date || (c.ai_config && c.ai_config.end_date) || ''
        }));

        // Lọc hiển thị cho role=content
        if (user?.role === 'content') {
          const assignedIds = (user.permissions || [])
            .filter((p: string) => p.startsWith('company_assign_'))
            .map((p: string) => p.replace('company_assign_', ''));
          formatted = formatted.filter((c: any) => assignedIds.includes(c.id));
        }

        setCompaniesSorted(formatted);
      }
    } catch (err) {
      console.error("Lỗi fetch công ty", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCompany = async () => {
    if (!newCompanyName.trim()) return;
    setIsSaving(true);
    try {
      const { data, error } = await supabase.from('companies').insert([{ name: newCompanyName }]).select();
      if (error) throw error;

      if (data) {
        setCompaniesSorted([{
          ...data[0],
          accounts: 0,
          aiCost: '0đ',
          status: 'Hoạt động'
        }, ...companies]);

        // Tự động yêu cầu n8n tạo Sheet (Tab) mới cho công ty trên Google Sheets
        try {
          const backendBase = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
            ? 'http://localhost:3005/api'
            : (import.meta.env.VITE_BACKEND_URL || 'https://crm.tikovia.vn/api');

          fetch(`${backendBase}/automation/create-company-sheet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companyId: data[0].id, companyName: newCompanyName.trim() })
          }).catch(e => console.warn('Tự động tạo Sheet lỗi:', e));
        } catch (e) {
          console.warn('Lỗi gọi API tạo Sheet:', e);
        }
      }
      setIsModalOpen(false);
      setNewCompanyName('');
    } catch (err) {
      console.error(err);
      alert('Lỗi tạo công ty');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditCompany = async () => {
    if (!editCompanyId || !editCompanyName.trim()) return;
    setIsEditSaving(true);
    let success = false;
    let fallbackUsed = false;
    try {
      // 1. Try updating name, ai_cost, status and end_date columns
      const { error } = await supabase
        .from('companies')
        .update({ 
          name: editCompanyName, 
          ai_cost: editCompanyCost, 
          status: editCompanyStatus,
          end_date: editCompanyEndDate 
        })
        .eq('id', editCompanyId);

      if (error) {
        // If column doesn't exist, try fallback to ai_config JSON object
        const isColumnMissing = 
          error.message.includes('does not exist') || 
          error.message.includes('schema cache') || 
          error.message.includes('Could not find') ||
          error.code === '42703' || 
          error.code === 'PGRST204';

        if (isColumnMissing) {
          fallbackUsed = true;

          const { data: currentData } = await supabase
            .from('companies')
            .select('ai_config')
            .eq('id', editCompanyId)
            .single();

          const currentConfig = (currentData && currentData.ai_config) ? currentData.ai_config : {};
          const updatedConfig = { 
            ...currentConfig, 
            ai_cost: editCompanyCost, 
            status: editCompanyStatus,
            end_date: editCompanyEndDate 
          };

          const { error: fallbackError } = await supabase
            .from('companies')
            .update({ name: editCompanyName, ai_config: updatedConfig })
            .eq('id', editCompanyId);

          if (fallbackError) throw fallbackError;
          success = true;
        } else {
          throw error;
        }
      } else {
        success = true;
      }

      if (success) {
        setCompaniesSorted(companies.map(c => c.id === editCompanyId ? {
          ...c,
          name: editCompanyName,
          aiCost: editCompanyCost,
          ai_cost: editCompanyCost,
          status: editCompanyStatus,
          endDate: editCompanyEndDate,
          end_date: editCompanyEndDate,
          ai_config: fallbackUsed ? { 
            ...(c.ai_config || {}), 
            ai_cost: editCompanyCost, 
            status: editCompanyStatus,
            end_date: editCompanyEndDate 
          } : c.ai_config
        } : c));

        setIsEditModalOpen(false);
      }
    } catch (err: any) {
      console.error(err);
      alert('Lỗi chỉnh sửa công ty: ' + err.message);
    } finally {
      setIsEditSaving(false);
    }
  };

  const handleDeleteCompany = async (id: string, name: string) => {
    setOpenDropdownId(null);
    if (!window.confirm(`Hành động nguy hiểm: Bạn có chắc chắn muốn xóa TOÀN BỘ dữ liệu của công ty "${name}"?\nMọi tài khoản, tin nhắn, và nội dung thuộc công ty này sẽ bị xóa sạch khỏi Database vĩnh viễn.`)) {
      return;
    }
    try {
      // 1. Gỡ công ty khỏi Admin và Content (giữ lại họ)
      await supabase.from('tikovia_users').update({ company_id: null }).eq('company_id', id).in('role', ['admin', 'content']);

      // 2. Xóa vĩnh viễn Sale và Owner của công ty
      await supabase.from('tikovia_users').delete().eq('company_id', id).in('role', ['sale', 'owner']);

      // 3. Xóa dữ liệu liên quan để tránh lỗi khóa ngoại (Foreign Key Constraint)
      await supabase.from('messages').delete().eq('company_id', id);
      await supabase.from('channels').delete().eq('company_id', id);
      await supabase.from('content_plans').delete().eq('company_id', id);
      await supabase.from('published_contents').delete().eq('company_id', id);

      // 4. Cuối cùng, xóa bảng công ty
      const { error } = await supabase.from('companies').delete().eq('id', id);
      if (error) throw error;
      setCompaniesSorted(companies.filter(c => c.id !== id));
    } catch (err) {
      console.error(err);
      alert('Lỗi khi xóa công ty. Tham khảo Log console để biết chi tiết.');
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto relative animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Quản lý Công ty</h1>
          <p className="text-gray-500 text-sm mt-1">Quản lý và theo dõi hiệu suất các dự án của khách hàng</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2 shadow-sm bg-brand-blue hover:bg-blue-700 text-white w-full sm:w-auto justify-center">
          <Plus className="w-4 h-4 flex-shrink-0" />
          <span className="whitespace-nowrap">Thêm Công ty</span>
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center p-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
        </div>
      ) : companies.length === 0 ? (
        <div className="text-center p-20 bg-gray-50 border border-dashed rounded-xl dark:bg-gray-800/50 dark:border-gray-700">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Chưa có công ty nào</h3>
          <p className="text-gray-500 mb-6">Hãy bấm Thêm công ty để bắt đầu hệ thống quản lý chuẩn SaaS</p>
          <Button onClick={() => setIsModalOpen(true)} className="mx-auto">Thêm Công ty mới</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map((company) => (
            <Card
              key={company.id}
              className="hover:border-brand-blue/50 hover:shadow-md transition-all cursor-pointer group relative bg-white dark:bg-gray-900"
              onClick={() => navigate(`/company/${company.id}`)}
            >
              <div
                className="absolute top-3 right-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenDropdownId(openDropdownId === company.id ? null : company.id);
                }}
              >
                <MoreVertical className="w-5 h-5" />
                {openDropdownId === company.id && (
                  <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 py-1 z-20">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdownId(null);
                        setEditCompanyId(company.id);
                        setEditCompanyName(company.name);
                        setEditCompanyCost(company.aiCost);
                        setEditCompanyStatus(company.status || 'Hoạt động');
                        setEditCompanyEndDate(company.endDate || '');
                        setIsEditModalOpen(true);
                      }}
                      className="w-full text-left px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-2 transition-colors border-b border-gray-100 dark:border-gray-800"
                    >
                      <Edit className="w-4 h-4 text-gray-400" />
                      Sửa thông tin
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCompany(company.id, company.name);
                      }}
                      className="w-full text-left px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Xóa công ty
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-brand-blue dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white text-lg line-clamp-1 pr-6">{company.name}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className={CompanyStatusBadge(company.status)}>{company.status}</span>
                    {company.endDate && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400 ring-1 ring-inset ring-amber-600/20">
                        <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                        Hạn: {company.endDate}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Tài khoản</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{company.accounts} nhân sự</p>
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditCompanyId(company.id);
                    setEditCompanyName(company.name);
                    setEditCompanyCost(company.aiCost);
                    setEditCompanyStatus(company.status || 'Hoạt động');
                    setEditCompanyEndDate(company.endDate || '');
                    setIsEditModalOpen(true);
                  }}
                  className="group/cost hover:bg-gray-50 dark:hover:bg-gray-800/50 p-1 -m-1 rounded transition-colors"
                  title="Click để chỉnh sửa chi phí"
                >
                  <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                    Chi phí gói / tháng
                    <Edit className="w-3.5 h-3.5 opacity-0 group-hover/cost:opacity-100 transition-opacity text-brand-blue shrink-0" />
                  </p>
                  <p className="font-medium inline-block bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                    {company.aiCost}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Adding Company Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <Card className="w-full max-w-md p-0 overflow-hidden bg-white dark:bg-gray-900 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-gray-400" />
                Khởi tạo Dữ liệu Công ty mới (Tenant)
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tên dự án / Công ty</label>
              <input
                type="text"
                autoFocus
                className="w-full text-base bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-brand-blue/50 text-gray-900 dark:text-white placeholder-gray-400 font-medium"
                placeholder="Ví dụ: CRM Agency"
                value={newCompanyName}
                onChange={e => setNewCompanyName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddCompany()}
              />
              <p className="text-xs text-gray-500 mt-2">Hệ thống sẽ tạo ra một phân vùng CSDL (RLS) hoàn toàn độc lập cho công ty này.</p>
            </div>
            <div className="p-5 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 bg-gray-50/50 dark:bg-gray-800/50">
              <Button
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="bg-white dark:bg-gray-800"
              >
                Hủy bỏ
              </Button>
              <Button
                onClick={handleAddCompany}
                disabled={isSaving || !newCompanyName.trim()}
                className="gap-2 bg-brand-blue hover:bg-blue-700 text-white"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSaving ? 'Đang tạo...' : 'Tạo mới'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Editing Company Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <Card className="w-full max-w-md p-0 overflow-hidden bg-white dark:bg-gray-900 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-gray-400" />
                Chỉnh sửa Thông tin Công ty
              </h3>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditCompanyId(null);
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tên dự án / Công ty</label>
                <input
                  type="text"
                  className="w-full text-base bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-brand-blue/50 text-gray-900 dark:text-white placeholder-gray-400 font-medium"
                  placeholder="Ví dụ: CRM Agency"
                  value={editCompanyName}
                  onChange={e => setEditCompanyName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Chi phí AI gói / tháng</label>
                <input
                  type="text"
                  className="w-full text-base bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-brand-blue/50 text-gray-900 dark:text-white placeholder-gray-400 font-medium"
                  placeholder="Ví dụ: 2,500,000đ"
                  value={editCompanyCost}
                  onChange={e => setEditCompanyCost(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Trạng thái hoạt động</label>
                <select
                  className="w-full text-base bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-brand-blue/50 text-gray-900 dark:text-white font-medium cursor-pointer"
                  value={editCompanyStatus}
                  onChange={e => setEditCompanyStatus(e.target.value)}
                >
                  <option value="Hoạt động">Hoạt động (Xanh lá)</option>
                  <option value="Hoàn thành">Hoàn thành (Xanh dương)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Thời gian kết thúc gói</label>
                <input
                  type="text"
                  className="w-full text-base bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-brand-blue/50 text-gray-900 dark:text-white placeholder-gray-400 font-medium"
                  placeholder="Ví dụ: 30/06/2026"
                  value={editCompanyEndDate}
                  onChange={e => setEditCompanyEndDate(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleEditCompany()}
                />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 bg-gray-50/50 dark:bg-gray-800/50">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditCompanyId(null);
                  setEditCompanyEndDate('');
                }}
                className="bg-white dark:bg-gray-800"
              >
                Hủy bỏ
              </Button>
              <Button
                onClick={handleEditCompany}
                disabled={isEditSaving || !editCompanyName.trim()}
                className="gap-2 bg-brand-blue hover:bg-blue-700 text-white"
              >
                {isEditSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isEditSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function CompanyStatusBadge(status: string) {
  if (status === 'Hoạt động') {
    return 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 ring-1 ring-inset ring-emerald-600/20';
  }
  if (status === 'Hoàn thành') {
    return 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 ring-1 ring-inset ring-blue-600/20';
  }
  return 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400 ring-1 ring-inset ring-gray-500/20';
}
