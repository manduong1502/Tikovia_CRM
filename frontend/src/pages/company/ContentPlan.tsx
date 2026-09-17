import React, { useState, useEffect } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { Plus, Edit, AlertCircle, CheckCircle2, XCircle, CalendarDays, FileText, Video, Eye, X, Save, Upload, Loader2, Paperclip, MessageSquare, Send, ExternalLink, Image as ImageIcon, Clock, Globe } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { cn } from '../../components/ui/Card';
import { supabase } from '../../lib/supabase';
import { uploadFile } from '../../lib/uploadHelper';

// Dữ liệu mẫu giả để show khi Supabase cấu hình lỗi hoặc chưa điền key
const fallbackData = [
  { id: 1, date: '5/4/2026', title: 'ĐẠI TIỆC GIẢM 50% - ĂN SÁNG CHỈ TỪ 17K', desc: 'Sáng vội vã, đừng để chiếc bụng đói làm bạn mất thần thái rạng rỡ...', type: 'Text', material: '5 ảnh không gian quán & món ăn', notes: 'Nhấn mạnh giá rẻ và tốc độ phục vụ (< 80 giây)', status: 'Chờ duyệt' },
];

export function ContentPlan() {
  const { id: companyId } = useParams();
  const { currentRole, permissions } = useOutletContext<{ currentRole: string, permissions: string[] }>();
  const [plans, setPlans] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingId, setUploadingId] = useState<number | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null); // null means "Add New", otherwise it's the item being edited
  const [editForm, setEditForm] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    fetchPlans();
    fetchChannels();

    // Lắng nghe thay đổi Realtime từ Supabase (Content tạo/sửa hoặc Khách duyệt bài)
    const channel = supabase
      .channel(`content_plans_realtime_${companyId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'content_plans',
        filter: `company_id=eq.${companyId}`
      }, () => {
        fetchPlans();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  const fetchChannels = async () => {
    if (!companyId) return;
    try {
      const { data, error } = await supabase
        .from('channels')
        .select('id, name, provider, page_id, status')
        .eq('company_id', companyId);
      if (data && !error) {
        setChannels(data);
      }
    } catch (err) {
      console.warn('Lỗi lấy danh sách kênh:', err);
    }
  };

  const getPlanTitle = (item: { title?: string; desc?: string; date?: string }) => {
    if (item.title && item.title.trim()) return item.title.trim();
    if (item.desc && item.desc.trim()) {
      const firstLine = item.desc.trim().split('\n')[0].trim();
      return firstLine.length > 80 ? firstLine.slice(0, 80) + '...' : firstLine;
    }
    return `Bài viết ngày ${item.date || ''}`;
  };

  const syncApprovedPlans = async (plansList: any[]) => {
    try {
      const approvedPlans = plansList.filter(p => p.status === 'Đã duyệt');
      if (approvedPlans.length === 0) return;

      // Lấy danh sách bài viết hiện có ở trang triển khai để so sánh theo plan_id hoặc (date, desc)
      const { data: existingPubs, error } = await supabase
        .from('published_contents')
        .select('id, plan_id, title, date, desc')
        .eq('company_id', companyId);

      if (error) throw error;

      const existingPlanIds = new Set(
        (existingPubs || [])
          .map(p => p.plan_id ? String(p.plan_id) : null)
          .filter(Boolean)
      );

      const existingDateDesc = new Set(
        (existingPubs || []).map(p => `${p.date}_${(p.desc || '').slice(0, 30).trim()}`)
      );

      const toInsert = approvedPlans.filter(p => {
        if (existingPlanIds.has(String(p.id))) return false;
        const key = `${p.date}_${(p.desc || '').slice(0, 30).trim()}`;
        if (existingDateDesc.has(key)) return false;
        return true;
      });

      if (toInsert.length > 0) {
        const today = new Date();
        const formattedDate = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;

        const insertPayloads = toInsert.map(p => ({
          company_id: companyId,
          plan_id: p.id,
          date: p.date || formattedDate,
          publish_time: p.publish_time || '09:00',
          channel_id: p.channel_id || null,
          title: getPlanTitle(p),
          desc: p.desc || '',
          type: p.type || 'Text',
          media: p.material || '',
          notes: p.notes || '',
          link: ''
        }));

        const { error: insertError } = await supabase
          .from('published_contents')
          .insert(insertPayloads);

        if (insertError) {
          console.error("Lỗi tự động đồng bộ bài viết đã duyệt:", insertError);
        } else {
          console.log(`Đã đồng bộ tự động ${toInsert.length} bài viết đã duyệt sang trang triển khai.`);
        }
      }
    } catch (err) {
      console.error("Lỗi kiểm tra đồng bộ tự động:", err);
    }
  };

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('content_plans').select('*').eq('company_id', companyId).order('id', { ascending: true });
      if (error) throw error;

      // Nếu có data (dù rỗng 0 dòng), thì gán vào để nhìn thấy bảng rỗng
      if (data) {
        setPlans(data);
        syncApprovedPlans(data);
      }
    } catch (err) {
      console.log('Lỗi Supabase, dùng dữ liệu mẫu:', err);
      setPlans(fallbackData);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingItem(null); // Không có item nào đang sửa -> Thêm mới

    // Lấy ngày hôm nay làm mặc định
    const today = new Date();
    const formattedDate = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;

    setEditForm({
      date: formattedDate,
      publish_time: '09:00',
      channel_id: '',
      title: '',
      desc: '',
      type: 'Text',
      material: '',
      notes: '',
      status: 'Chờ duyệt'
    });
    setIsModalOpen(true);
  };

  const handleEditClick = (item: any) => {
    setEditingItem(item);
    setEditForm({
      ...item,
      publish_time: item.publish_time || '09:00',
      channel_id: item.channel_id || ''
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (editingItem) {
        // Cập nhật (Update) bài viết hiện có
        const { error } = await supabase
          .from('content_plans')
          .update({
            date: editForm.date,
            publish_time: editForm.publish_time || '09:00',
            channel_id: editForm.channel_id || null,
            title: editForm.title,
            desc: editForm.desc,
            type: editForm.type,
            material: editForm.material,
            notes: editForm.notes
          })
          .eq('id', editingItem.id);

        if (error) {
          console.error('Lỗi update:', error);
          alert('Lỗi cập nhật bài viết: ' + error.message);
          return;
        }

        // Nếu bài viết đã duyệt, đồng bộ các trường đã sửa sang trang triển khai
        if (editingItem.status === 'Đã duyệt') {
          const finalTitle = getPlanTitle(editForm);
          // Tìm theo plan_id trước
          const { data: pubByPlan } = await supabase
            .from('published_contents')
            .select('id')
            .eq('company_id', editingItem.company_id)
            .eq('plan_id', editingItem.id)
            .maybeSingle();

          if (pubByPlan) {
            await supabase
              .from('published_contents')
              .update({
                date: editForm.date,
                publish_time: editForm.publish_time || '09:00',
                channel_id: editForm.channel_id || null,
                title: finalTitle,
                desc: editForm.desc,
                type: editForm.type,
                media: editForm.material,
                notes: editForm.notes
              })
              .eq('id', pubByPlan.id);
          } else {
            await supabase
              .from('published_contents')
              .update({
                date: editForm.date,
                publish_time: editForm.publish_time || '09:00',
                channel_id: editForm.channel_id || null,
                title: finalTitle,
                desc: editForm.desc,
                type: editForm.type,
                media: editForm.material,
                notes: editForm.notes,
                plan_id: editingItem.id
              })
              .eq('company_id', editingItem.company_id)
              .eq('title', editingItem.title || finalTitle);
          }
        }

        // Cập nhật lại UI cục bộ
        setPlans(plans.map(p => p.id === editingItem.id ? { ...p, ...editForm } : p));
      } else {
        // Thêm mới (Insert) bài viết
        const { data, error } = await supabase
          .from('content_plans')
          .insert([{
            company_id: companyId,
            date: editForm.date,
            publish_time: editForm.publish_time || '09:00',
            channel_id: editForm.channel_id || null,
            title: editForm.title,
            desc: editForm.desc,
            type: editForm.type,
            material: editForm.material,
            notes: editForm.notes,
            status: 'Chờ duyệt'
          }])
          .select();

        if (error) {
          console.error('Lỗi insert:', error);
          alert('Lỗi thêm bài viết mới: ' + error.message);
          return;
        } else if (data && data.length > 0) {
          // Thêm dữ liệu từ server trả về vào UI
          setPlans([...plans, data[0]]);
        }
      }
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      alert('Có lỗi xảy ra: ' + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveFeedback = async (closeModal = true) => {
    if (!editingItem) return;
    setIsSaving(true);
    try {
      const feedbackNotes = editForm.notes || '';
      const { error } = await supabase
        .from('content_plans')
        .update({ notes: feedbackNotes })
        .eq('id', editingItem.id);

      if (error) throw error;

      // Đồng bộ sang trang triển khai nếu bài viết đã ở trạng thái Đã duyệt
      if (editingItem.status === 'Đã duyệt') {
        const { error: syncError } = await supabase
          .from('published_contents')
          .update({ notes: feedbackNotes })
          .eq('company_id', editingItem.company_id)
          .eq('plan_id', editingItem.id);

        if (syncError) {
          await supabase
            .from('published_contents')
            .update({ notes: feedbackNotes })
            .eq('company_id', editingItem.company_id)
            .eq('title', editingItem.title);
        }
      }

      setPlans(plans.map(p => p.id === editingItem.id ? { ...p, notes: feedbackNotes } : p));
      if (closeModal) {
        alert('Đã gửi phản hồi (Feedback) thành công!');
        setIsModalOpen(false);
      }
    } catch (err: any) {
      console.error(err);
      alert('Có lỗi xảy ra khi lưu Feedback: ' + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, item: any) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      setUploadingId(item.id);

      // Upload file to Google Drive (via Backend) or Supabase Storage
      const uploadResult = await uploadFile(file, `plan_${item.id}`);
      const publicUrl = uploadResult.url;

      // Ghép link vào trường material dưới dang FILE:url để UI tự động detect thành nút download
      const updatedMaterial = item.material ? `${item.material}\nFILE:${publicUrl}` : `FILE:${publicUrl}`;

      await supabase.from('content_plans').update({ material: updatedMaterial }).eq('id', item.id);

      // Nếu bài viết đã duyệt, đồng bộ file đính kèm sang trang triển khai theo plan_id
      if (item.status === 'Đã duyệt') {
        const { error: syncError } = await supabase
          .from('published_contents')
          .update({ media: updatedMaterial })
          .eq('company_id', item.company_id)
          .eq('plan_id', item.id);
        
        if (syncError) {
          await supabase
            .from('published_contents')
            .update({ media: updatedMaterial })
            .eq('company_id', item.company_id)
            .eq('title', item.title);
        }
      }

      // Update local UI
      setPlans(plans.map(p => p.id === item.id ? { ...p, material: updatedMaterial } : p));

    } catch (err) {
      console.error('Lỗi upload', err);
    } finally {
      setUploadingId(null);
    }
  };

  // Cập nhật Status (kèm theo đồng bộ feedback nếu có)
  const handleUpdateStatus = async (item: any, newStatus: string, updatedNotes?: string) => {
    try {
      const finalNotes = updatedNotes !== undefined ? updatedNotes : (item.notes || '');
      // Gọi lên Supabase update
      const { error } = await supabase
        .from('content_plans')
        .update({ status: newStatus, notes: finalNotes })
        .eq('id', item.id);
      
      if (error) throw error;

      // Update UI
      setPlans(plans.map(p => p.id === item.id ? { ...p, status: newStatus, notes: finalNotes } : p));

      // Tự động đẩy qua trang triển khai (published_contents) nếu trạng thái là "Đã duyệt"
      if (newStatus === 'Đã duyệt') {
        // Kiểm tra xem đã tồn tại bài viết này ở trang triển khai chưa theo plan_id
        const { data: existing } = await supabase
          .from('published_contents')
          .select('id')
          .eq('company_id', item.company_id)
          .eq('plan_id', item.id)
          .maybeSingle();

        if (!existing) {
          const today = new Date();
          const formattedDate = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
          
          await supabase.from('published_contents').insert([{
            company_id: item.company_id,
            plan_id: item.id,
            date: item.date || formattedDate,
            publish_time: item.publish_time || '09:00',
            channel_id: item.channel_id || null,
            title: getPlanTitle(item),
            desc: item.desc || '',
            type: item.type || 'Text',
            media: item.material || '',
            notes: finalNotes,
            link: '' // Chừa link trống để gắn sau
          }]);
        } else {
          // Cập nhật lại notes nếu đã tồn tại ở trang triển khai
          await supabase
            .from('published_contents')
            .update({ 
              notes: finalNotes,
              title: getPlanTitle(item),
              desc: item.desc || '',
              media: item.material || '',
              publish_time: item.publish_time || '09:00',
              channel_id: item.channel_id || null
            })
            .eq('id', existing.id);
        }

        // Kích hoạt Webhook gửi bài sang n8n tự động hóa
        try {
          const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
          const cleanUrl = backendUrl.replace(/\/+$/, '');
          const endpoint = cleanUrl.endsWith('/api') ? `${cleanUrl}/automation/trigger-approval` : `${cleanUrl}/api/automation/trigger-approval`;
          fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId: item.id })
          }).then(res => res.json()).then(data => {
            console.log('Đã kích hoạt n8n automation:', data);
          }).catch(e => console.warn('Lỗi kích hoạt n8n automation:', e));
        } catch (e) {
          console.warn('Lỗi gọi automation trigger:', e);
        }
      }
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi cập nhật trạng thái');
    }
  };

  const handleDeleteMaterialFile = async (item: any, fileUrlToDelete: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa file đính kèm này không?")) return;
    try {
      const lines = (item.material || '').split('\n');
      const updatedLines = lines.filter((line: string) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('FILE:')) {
          const url = trimmed.replace('FILE:', '').trim();
          return url !== fileUrlToDelete;
        }
        return true;
      });
      const updatedMaterial = updatedLines.join('\n').trim();

      const { error } = await supabase
        .from('content_plans')
        .update({ material: updatedMaterial })
        .eq('id', item.id);

      if (error) throw error;

      if (item.status === 'Đã duyệt') {
        const { error: syncError } = await supabase
          .from('published_contents')
          .update({ media: updatedMaterial })
          .eq('company_id', item.company_id)
          .eq('plan_id', item.id);
        
        if (syncError) {
          await supabase
            .from('published_contents')
            .update({ media: updatedMaterial })
            .eq('company_id', item.company_id)
            .eq('title', item.title);
        }
      }

      setPlans(plans.map(p => p.id === item.id ? { ...p, material: updatedMaterial } : p));
    } catch (err: any) {
      console.error(err);
      alert('Lỗi xóa file: ' + err.message);
    }
  };

  const isImageUrl = (url: string) => {
    return url.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i) != null || url.includes('/storage/v1/object/public/materials') || url.includes('drive.google.com') || url.includes('/api/upload');
  };

  // Helper render Tư liệu cần để tự extract URL thành link bấm được & xem trước ảnh
  const renderMaterial = (materialText: string, item: any) => {
    if (!materialText) return <span className="text-xs text-gray-400 italic">Chưa có tư liệu</span>;
    return (
      <div className="flex flex-col gap-1.5">
        {materialText.split('\n').map((line, idx) => {
          if (line.trim().startsWith('FILE:')) {
            const url = line.replace('FILE:', '').trim();
            const isImg = isImageUrl(url);
            return (
              <div key={idx} className="flex items-center gap-1.5 flex-wrap">
                {isImg ? (
                  <button 
                    type="button"
                    onClick={() => setPreviewImage(url)} 
                    className="inline-flex items-center gap-1.5 px-2 py-1 bg-brand-blue/10 text-brand-blue rounded text-[10px] font-medium hover:bg-brand-blue/20 transition-colors cursor-pointer"
                    title="Bấm để xem ảnh"
                  >
                    <Eye className="w-3 h-3" /> Xem ảnh
                  </button>
                ) : (
                  <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-2 py-1 bg-brand-blue/10 text-brand-blue rounded text-[10px] font-medium hover:bg-brand-blue/20 transition-colors w-max">
                    <Paperclip className="w-3 h-3" /> Đính kèm
                  </a>
                )}
                <a href={url} target="_blank" rel="noreferrer" title="Mở link trực tiếp" className="p-1 text-gray-400 hover:text-brand-blue rounded transition-colors">
                  <ExternalLink className="w-3 h-3" />
                </a>
                {permissions.includes('manage_content_plan') && (
                  <button 
                    onClick={() => handleDeleteMaterialFile(item, url)}
                    title="Xóa file đính kèm này"
                    className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          }
          return <span key={idx} className="text-xs text-gray-600 dark:text-gray-400 leading-snug break-words">{line}</span>;
        })}
      </div>
    );
  };

  const getMonday = (d: Date): Date => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  const parseDateString = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  const getGroupedItems = (items: any[]) => {
    if (items.length === 0) return [];
    
    const parsedItems = items.map(item => ({
      ...item,
      parsedDate: parseDateString(item.date)
    }));
    
    const minTime = Math.min(...parsedItems.map(item => item.parsedDate.getTime()));
    const maxTime = Math.max(...parsedItems.map(item => item.parsedDate.getTime()));
    
    const minDate = new Date(minTime);
    const maxDate = new Date(maxTime);
    
    const week1Start = getMonday(minDate);
    
    const diffTime = maxDate.getTime() - week1Start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const totalWeeks = Math.max(1, Math.floor(diffDays / 7) + 1);
    
    const groups: any[] = [];
    for (let i = 0; i < totalWeeks; i++) {
      const start = new Date(week1Start.getTime() + i * 7 * 24 * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
      groups.push({
        weekNumber: i + 1,
        startDateStr: `${start.getDate()}/${start.getMonth() + 1}`,
        endDateStr: `${end.getDate()}/${end.getMonth() + 1}/${end.getFullYear()}`,
        items: []
      });
    }
    
    parsedItems.forEach(item => {
      const itemTime = item.parsedDate.getTime();
      const diffTime = itemTime - week1Start.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const weekIndex = Math.max(0, Math.floor(diffDays / 7));
      if (weekIndex < groups.length) {
        groups[weekIndex].items.push(item);
      } else {
        groups[groups.length - 1].items.push(item);
      }
    });

    groups.forEach(g => {
      g.items.sort((a: any, b: any) => b.parsedDate.getTime() - a.parsedDate.getTime());
    });
    
    return groups;
  };

  const groupedPlans = [...getGroupedItems(plans)].reverse();

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            Kế hoạch nội dung
          </h2>
          <p className="text-sm text-gray-500 mt-1">Quản lý và phê duyệt nội dung tiếp thị</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {permissions.includes('manage_content_plan') && (
            <Button onClick={handleOpenAddModal} className="gap-2 shadow-sm shadow-brand-blue/20 bg-brand-blue hover:bg-blue-700 text-white w-full sm:w-auto justify-center">
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span className="whitespace-nowrap">Thêm bài viết</span>
            </Button>
          )}
        </div>
      </div>

      <Card className="p-0 overflow-hidden relative">
        {loading && <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">Đang tải...</div>}
        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-semibold text-gray-900 dark:text-white">Danh sách bài đăng tuần này</h3>
        </div>

        {plans.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            Chưa có bài viết nào trong Database. Bấm "Thêm bài viết" ở góc trên để tạo bài mới!
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {groupedPlans.map((group) => (
              <div key={group.weekNumber} className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold bg-brand-blue/10 text-brand-blue px-2.5 py-1 rounded-md">
                    Tuần {group.weekNumber}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">
                    ({group.startDateStr} - {group.endDateStr})
                  </span>
                  <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full font-medium">
                    {group.items.length} bài viết
                  </span>
                </div>

                {group.items.length === 0 ? (
                  <p className="text-xs text-gray-400 italic pl-4">Không có bài viết nào trong tuần này.</p>
                ) : (
                  <>
                    {/* Desktop: Table view */}
                    <div className="hidden md:block overflow-x-auto w-full scrollbar-thin border border-gray-100 dark:border-gray-800 rounded-lg">
                      <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                          <tr className="border-b border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-400 uppercase bg-gray-50 dark:bg-gray-800/10">
                            <th className="px-6 py-3 font-medium" style={{ width: '12%' }}>Thời gian</th>
                            <th className="px-6 py-3 font-medium" style={{ width: '25%' }}>Nội dung chi tiết</th>
                            <th className="px-6 py-3 font-medium" style={{ width: '10%' }}>Thể loại</th>
                            <th className="px-6 py-3 font-medium" style={{ width: '20%' }}>Tư liệu đính kèm</th>
                            <th className="px-6 py-3 font-medium" style={{ width: '15%' }}>Ghi chú</th>
                            <th className="px-6 py-3 font-medium" style={{ width: '8%' }}>Trạng thái</th>
                            <th className="px-6 py-3 font-medium text-right">Hành động</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
                          {group.items.map((item: any) => (
                            <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors align-top">
                              <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                                <div className="flex flex-col gap-1.5 font-medium">
                                  <span className="flex items-center gap-2"><CalendarDays className="w-4 h-4 text-brand-blue" /> {item.date}</span>
                                  {item.publish_time && (
                                    <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-normal">
                                      <Clock className="w-3.5 h-3.5" /> {item.publish_time}
                                    </span>
                                  )}
                                  {item.channel_id && channels.find(c => c.id === item.channel_id) && (
                                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/30 text-brand-blue border border-blue-150 font-normal w-max">
                                      <Globe className="w-3 h-3" /> {channels.find(c => c.id === item.channel_id)?.name}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <p className="font-semibold text-gray-900 dark:text-white line-clamp-2 leading-tight mb-1">{item.title}</p>
                                <p className="text-xs text-gray-500 line-clamp-2">{item.desc}</p>
                              </td>
                              <td className="px-6 py-4">
                                <span className={cn(
                                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border",
                                  item.type === 'Text' || !item.type ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400" : "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400",
                                )}>
                                  {item.type === 'Text' || !item.type ? <FileText className="w-3 h-3" /> : <Video className="w-3 h-3" />}
                                  {item.type || 'Text'}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col gap-3">
                                  {renderMaterial(item.material, item)}
                                  {permissions.includes('manage_content_plan') && (
                                    <label className={cn(
                                      "inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors w-max border",
                                      uploadingId === item.id
                                        ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                        : "bg-white text-gray-600 hover:bg-gray-50 hover:text-brand-blue border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                                    )}>
                                      {uploadingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                                      {uploadingId === item.id ? 'Đang tải...' : 'Tải ảnh/video'}
                                      <input type="file" className="hidden" accept="image/*,video/*" onChange={(e) => handleFileUpload(e, item)} disabled={uploadingId === item.id} />
                                    </label>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-xs text-gray-500 italic break-words">
                                  {item.notes}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className={cn(
                                  "inline-flex items-center px-2 py-1 rounded text-xs font-medium border whitespace-nowrap",
                                  item.status === 'Đã duyệt' && "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400",
                                  item.status === 'Chờ duyệt' && "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400",
                                  item.status === 'Từ chối' && "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400"
                                )}>
                                  {item.status || 'Chờ duyệt'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {permissions.includes('manage_content_plan') ? (
                                    <button
                                      onClick={() => handleEditClick(item)}
                                      title="Sửa nội dung bài"
                                      className="p-1.5 text-gray-500 hover:text-brand-blue hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleEditClick(item)}
                                      title="Xem chi tiết (Read Only)"
                                      className="p-1.5 text-gray-500 hover:text-brand-blue hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                  )}

                                  {permissions.includes('approve_content_plan') && (
                                    <>
                                      {(item.status === 'Chờ duyệt' || item.status === 'Từ chối') && (
                                        <button onClick={() => handleUpdateStatus(item, 'Đã duyệt')} className="px-2 py-1 text-[11px] font-medium text-emerald-600 border border-emerald-600 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors">
                                          Phê Duyệt
                                        </button>
                                      )}
                                      {(item.status === 'Chờ duyệt' || item.status === 'Đã duyệt') && (
                                        <button onClick={() => handleUpdateStatus(item, 'Từ chối')} className="px-2 py-1 text-[11px] font-medium text-red-600 border border-red-600 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                                          Từ chối
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile: Card view */}
                    <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800 border border-gray-100 dark:border-gray-800 rounded-lg">
                      {group.items.map((item: any) => (
                        <div key={item.id} className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="flex items-center gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                                <CalendarDays className="w-3.5 h-3.5 text-brand-blue" /> {item.date}
                              </span>
                              {item.publish_time && (
                                <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                                  <Clock className="w-3 h-3" /> {item.publish_time}
                                </span>
                              )}
                              {item.channel_id && channels.find(c => c.id === item.channel_id) && (
                                <span className="flex items-center gap-1 text-[10px] font-medium text-brand-blue bg-blue-50 dark:bg-blue-900/40 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                                  <Globe className="w-2.5 h-2.5" /> {channels.find(c => c.id === item.channel_id)?.name}
                                </span>
                              )}
                              <span className={cn(
                                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border",
                                item.type === 'Text' || !item.type ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400" : "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400",
                              )}>
                                {item.type === 'Text' || !item.type ? <FileText className="w-2.5 h-2.5" /> : <Video className="w-2.5 h-2.5" />}
                                {item.type || 'Text'}
                              </span>
                            </div>
                            <span className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border shrink-0",
                              item.status === 'Đã duyệt' && "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400",
                              item.status === 'Chờ duyệt' && "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400",
                              item.status === 'Từ chối' && "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400"
                            )}>
                              {item.status || 'Chờ duyệt'}
                            </span>
                          </div>

                          <div>
                            <p className="font-semibold text-sm text-gray-900 dark:text-white leading-snug mb-0.5">{item.title}</p>
                            {item.desc && <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">{item.desc}</p>}
                          </div>

                          {item.material && (
                            <div className="text-xs">{renderMaterial(item.material, item)}</div>
                          )}

                          {item.notes && (
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 italic">💡 {item.notes}</p>
                          )}

                          <div className="flex items-center gap-2 pt-1">
                            {permissions.includes('manage_content_plan') ? (
                              <button
                                onClick={() => handleEditClick(item)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-blue bg-brand-blue/5 hover:bg-brand-blue/10 border border-brand-blue/20 rounded-lg transition-colors"
                              >
                                <Edit className="w-3 h-3" /> Sửa
                              </button>
                            ) : (
                              <button
                                onClick={() => handleEditClick(item)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700"
                              >
                                <Eye className="w-3 h-3" /> Xem
                              </button>
                            )}

                            {permissions.includes('manage_content_plan') && (
                              <label className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors border",
                                uploadingId === item.id
                                  ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                  : "text-gray-600 bg-gray-50 hover:bg-gray-100 border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
                              )}>
                                {uploadingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                                {uploadingId === item.id ? 'Tải lên...' : 'Tải file'}
                                <input type="file" className="hidden" accept="image/*,video/*" onChange={(e) => handleFileUpload(e, item)} disabled={uploadingId === item.id} />
                              </label>
                            )}

                            {permissions.includes('approve_content_plan') && (
                              <>
                                {(item.status === 'Chờ duyệt' || item.status === 'Từ chối') && (
                                  <button onClick={() => handleUpdateStatus(item, 'Đã duyệt')} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-600 border border-emerald-300 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors">
                                    <CheckCircle2 className="w-3 h-3" /> Duyệt
                                  </button>
                                )}
                                {(item.status === 'Chờ duyệt' || item.status === 'Đã duyệt') && (
                                  <button onClick={() => handleUpdateStatus(item, 'Từ chối')} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-500 border border-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                                    <XCircle className="w-3 h-3" /> Từ chối
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-3 gap-2 md:gap-6">
        <Card className="flex items-center gap-2 md:gap-4 !p-3 md:!p-6">
          <div className="p-2 md:p-3 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-500 rounded-full">
            <AlertCircle className="w-4 h-4 md:w-6 md:h-6" />
          </div>
          <div>
            <h4 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white">
              {plans.filter(p => !p.status || p.status === 'Chờ duyệt').length}
            </h4>
            <p className="text-[10px] md:text-sm font-medium text-gray-500 dark:text-gray-400">Chờ duyệt</p>
          </div>
        </Card>

        <Card className="flex items-center gap-2 md:gap-4 !p-3 md:!p-6">
          <div className="p-2 md:p-3 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-500 rounded-full">
            <CheckCircle2 className="w-4 h-4 md:w-6 md:h-6" />
          </div>
          <div>
            <h4 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white">
              {plans.filter(p => p.status === 'Đã duyệt').length}
            </h4>
            <p className="text-[10px] md:text-sm font-medium text-gray-500 dark:text-gray-400">Đã duyệt</p>
          </div>
        </Card>

        <Card className="flex items-center gap-2 md:gap-4 !p-3 md:!p-6">
          <div className="p-2 md:p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-500 rounded-full">
            <XCircle className="w-4 h-4 md:w-6 md:h-6" />
          </div>
          <div>
            <h4 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white">
              {plans.filter(p => p.status === 'Từ chối').length}
            </h4>
            <p className="text-[10px] md:text-sm font-medium text-gray-500 dark:text-gray-400">Từ chối</p>
          </div>
        </Card>
      </div>

      {/* Tích hợp Modal Thêm / Sửa / Xem & Feedback */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <Card className="w-full max-w-2xl p-0 overflow-hidden bg-white dark:bg-gray-900 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-blue" />
                {editingItem 
                  ? (permissions.includes('manage_content_plan') ? 'Sửa nội dung bài viết' : 'Xem nội dung bài viết & Feedback') 
                  : 'Thêm bài viết mới'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5 text-brand-blue" />
                    Ngày đăng dự kiến
                  </label>
                  <input
                    type="text"
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-brand-blue/50 text-gray-900 dark:text-white"
                    value={editForm.date || ''}
                    onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                    placeholder="Ví dụ: 15/4/2026"
                    disabled={!permissions.includes('manage_content_plan')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-brand-blue" />
                    Giờ hẹn đăng
                  </label>
                  <input
                    type="time"
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3.5 py-2 text-sm focus:ring-2 focus:ring-brand-blue/50 text-gray-900 dark:text-white font-medium"
                    value={editForm.publish_time || '09:00'}
                    onChange={e => setEditForm({ ...editForm, publish_time: e.target.value })}
                    disabled={!permissions.includes('manage_content_plan')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-brand-blue" />
                    Kênh xuất bản
                  </label>
                  <select
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-blue/50 text-gray-900 dark:text-white"
                    value={editForm.channel_id || ''}
                    onChange={e => setEditForm({ ...editForm, channel_id: e.target.value || null })}
                    disabled={!permissions.includes('manage_content_plan')}
                  >
                    <option value="">-- Đăng thủ công / Không tự động --</option>
                    {channels.map(ch => (
                      <option key={ch.id} value={ch.id}>
                        {ch.name} ({ch.provider === 'facebook' ? 'Fanpage' : ch.provider})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tiêu đề bài viết</label>
                <input
                  type="text"
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-blue/50 text-gray-900 dark:text-white font-medium"
                  value={editForm.title || ''}
                  onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                  disabled={!permissions.includes('manage_content_plan')}
                />
              </div>

              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mô tả / Nội dung chi tiết</label>
                <textarea
                  rows={8}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-blue/50 text-gray-900 dark:text-white min-h-[150px] md:min-h-[250px] resize-y custom-scrollbar"
                  value={editForm.desc || ''}
                  onChange={e => setEditForm({ ...editForm, desc: e.target.value })}
                  disabled={!permissions.includes('manage_content_plan')}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Thể loại</label>
                  <select
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-blue/50 text-gray-900 dark:text-white"
                    value={editForm.type || 'Text'}
                    onChange={e => setEditForm({ ...editForm, type: e.target.value })}
                    disabled={!permissions.includes('manage_content_plan')}
                  >
                    <option value="Text">Text (Hình ảnh & Chữ)</option>
                    <option value="Video">Video (Tiktok, Reels)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tư liệu cần đính kèm</label>
                  <input
                    type="text"
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-blue/50 text-gray-900 dark:text-white"
                    value={editForm.material || ''}
                    onChange={e => setEditForm({ ...editForm, material: e.target.value })}
                    disabled={!permissions.includes('manage_content_plan')}
                  />
                </div>
              </div>

              {/* Ô Feedback / Ghi chú cho phép Chủ công ty / Admin điền ý kiến */}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-brand-blue" />
                  Ghi chú / Phản hồi (Feedback của Chủ công ty)
                </label>
                <textarea
                  rows={3}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-blue/50 text-gray-900 dark:text-white placeholder-gray-400 shadow-sm resize-y"
                  placeholder="Điền góp ý, yêu cầu chỉnh sửa (Feedback) tại đây..."
                  value={editForm.notes || ''}
                  onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  💡 Bạn có thể nhập nội dung feedback tại đây và bấm <strong>Lưu Feedback</strong> hoặc duyệt/từ chối bài viết.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3 bg-gray-50/50 dark:bg-gray-800/50">
              <Button
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="bg-white dark:bg-gray-800"
              >
                {permissions.includes('manage_content_plan') ? 'Hủy bỏ' : 'Đóng'}
              </Button>

              <div className="flex flex-wrap items-center gap-2">
                {/* Nút Phê duyệt / Từ chối bài viết trực tiếp từ Popup dành cho Chủ công ty (owner / approve_content_plan) */}
                {permissions.includes('approve_content_plan') && editingItem && (
                  <>
                    {(editingItem.status === 'Chờ duyệt' || editingItem.status === 'Từ chối') && (
                      <Button
                        type="button"
                        onClick={async () => {
                          await handleUpdateStatus(editingItem, 'Đã duyệt', editForm.notes || '');
                          setIsModalOpen(false);
                        }}
                        className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border-0 text-xs px-3 py-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Phê Duyệt
                      </Button>
                    )}
                    {(editingItem.status === 'Chờ duyệt' || editingItem.status === 'Đã duyệt') && (
                      <Button
                        type="button"
                        onClick={async () => {
                          await handleUpdateStatus(editingItem, 'Từ chối', editForm.notes || '');
                          setIsModalOpen(false);
                        }}
                        className="gap-1.5 bg-red-600 hover:bg-red-700 text-white border-0 text-xs px-3 py-2"
                      >
                        <XCircle className="w-4 h-4" />
                        Từ Chối
                      </Button>
                    )}
                  </>
                )}

                {/* Nút Lưu bài viết cho Content / Design / Admin HOẶC Lưu Feedback cho Chủ công ty */}
                {permissions.includes('manage_content_plan') ? (
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="gap-2 bg-brand-blue hover:bg-blue-700 text-white border-0"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Lưu & Cập nhật
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleSaveFeedback(true)}
                    disabled={isSaving}
                    className="gap-2 bg-brand-blue hover:bg-blue-700 text-white border-0"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Lưu Feedback
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Lightbox Preview Modal cho Ảnh tư liệu */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-4xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/80">
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-brand-blue" /> Xem tư liệu / Hình ảnh đính kèm
              </span>
              <div className="flex items-center gap-2">
                <a 
                  href={previewImage} 
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Mở tab mới
                </a>
                <button 
                  onClick={() => setPreviewImage(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 flex items-center justify-center overflow-auto max-h-[calc(90vh-100px)] bg-gray-950/5 dark:bg-black/30">
              <img 
                src={previewImage} 
                alt="Tư liệu đính kèm" 
                className="max-h-[75vh] w-auto object-contain rounded-lg shadow-sm"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                  const parent = (e.target as HTMLElement).parentElement;
                  if (parent && !parent.querySelector('.error-box')) {
                    const box = document.createElement('div');
                    box.className = 'error-box text-center p-8 text-sm text-gray-500';
                    box.innerHTML = '⚠️ Không thể tải ảnh trực tiếp từ link lưu trữ cũ của hệ thống trước đây.<br/><br/><a href="' + previewImage + '" target="_blank" class="text-brand-blue underline inline-flex items-center gap-1 font-medium">Bấm vào đây để thử mở trực tiếp link</a>';
                    parent.appendChild(box);
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
