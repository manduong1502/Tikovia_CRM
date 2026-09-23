import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Edit, CalendarDays, FileText, Video, X, Save, Upload, Loader2, Paperclip, ExternalLink, Activity, Rocket, Trash2, Eye, Image as ImageIcon, Clock } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { cn } from '../../components/ui/Card';
import { supabase } from '../../lib/supabase';
import { uploadFile } from '../../lib/uploadHelper';
import { useAuth } from '../../contexts/AuthContext';

export function PublishedContent() {
  const { id: companyId } = useParams();
  const { user } = useAuth();
  const role = user?.role || 'sale';
  const canInteract = ['content', 'design', 'admin'].includes(role);
  const [targetPosts, setTargetPosts] = useState(0);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Filter States for Summary
  const [filterType, setFilterType] = useState<'all' | 'month' | 'custom'>('all');
  
  const getCurrentMonthStr = () => {
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    return `${month < 10 ? '0' + month : month}/${year}`;
  };
  
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthStr());
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    fetchPosts();

    // Lắng nghe thay đổi Realtime từ Supabase cho trang triển khai
    const channel = supabase
      .channel(`published_contents_realtime_${companyId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'published_contents',
        filter: `company_id=eq.${companyId}`
      }, () => {
        fetchPosts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  const getUniqueMonths = (items: any[]) => {
    const months = new Set<string>();
    months.add(getCurrentMonthStr());
    
    items.forEach(item => {
      const date = parseDateString(item.date);
      const m = date.getMonth() + 1;
      const y = date.getFullYear();
      const monthStr = `${m < 10 ? '0' + m : m}/${y}`;
      months.add(monthStr);
    });
    
    return Array.from(months).sort((a, b) => {
      const [mA, yA] = a.split('/').map(Number);
      const [mB, yB] = b.split('/').map(Number);
      if (yA !== yB) return yB - yA;
      return mB - mA;
    });
  };

  const getTargetStorageKey = (type: 'all' | 'month' | 'custom', monthStr: string, startStr: string, endStr: string) => {
    if (!companyId) return '';
    if (type === 'all') {
      return `target_posts_${companyId}`;
    } else if (type === 'month') {
      return `target_posts_${companyId}_month_${monthStr.replace('/', '-')}`;
    } else {
      const startKey = startStr.replace(/\//g, '-');
      const endKey = endStr.replace(/\//g, '-');
      return `target_posts_${companyId}_custom_${startKey}_${endKey}`;
    }
  };

  const getFilteredPostsForSummary = () => {
    if (filterType === 'all') return posts;
    
    return posts.filter(post => {
      const postDate = parseDateString(post.date);
      if (filterType === 'month') {
        const m = postDate.getMonth() + 1;
        const y = postDate.getFullYear();
        const monthStr = `${m < 10 ? '0' + m : m}/${y}`;
        return monthStr === selectedMonth;
      } else if (filterType === 'custom') {
        if (!customStartDate || !customEndDate) return true;
        const start = parseDateString(customStartDate);
        const end = parseDateString(customEndDate);
        
        const postTime = new Date(postDate.getFullYear(), postDate.getMonth(), postDate.getDate()).getTime();
        const startTime = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
        const endTime = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
        
        return postTime >= startTime && postTime <= endTime;
      }
      return true;
    });
  };

  const handleFilterTypeChange = (type: 'all' | 'month' | 'custom') => {
    setFilterType(type);
    if (type === 'custom' && (!customStartDate || !customEndDate)) {
      const today = new Date();
      const y = today.getFullYear();
      const m = today.getMonth() + 1;
      const lastDay = new Date(y, m, 0).getDate();
      
      const pad = (num: number) => num < 10 ? `0${num}` : num;
      setCustomStartDate(`01/${pad(m)}/${y}`);
      setCustomEndDate(`${pad(lastDay)}/${pad(m)}/${y}`);
    }
  };

  useEffect(() => {
    if (!companyId) return;
    const key = getTargetStorageKey(filterType, selectedMonth, customStartDate, customEndDate);
    if (key) {
      const saved = localStorage.getItem(key);
      if (saved) {
        setTargetPosts(parseInt(saved));
      } else {
        setTargetPosts(0);
      }
    }
  }, [companyId, filterType, selectedMonth, customStartDate, customEndDate]);

  const handleUpdateLink = async (id: number, newLink: string) => {
    try {
      const { error } = await supabase
        .from('published_contents')
        .update({ link: newLink })
        .eq('id', id);

      if (error) throw error;
      setPosts(posts.map(p => p.id === id ? { ...p, link: newLink } : p));
    } catch (err: any) {
      console.error(err);
      alert('Lỗi cập nhật link: ' + err.message);
    }
  };

  const handleDeletePost = async (id: number) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa ghi nhận bài viết đã triển khai này không?")) return;
    try {
      const targetPost = posts.find(p => p.id === id);
      const { error } = await supabase
        .from('published_contents')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Reset trạng thái bài viết bên kế hoạch về 'Chờ duyệt'
      if (targetPost) {
        if (targetPost.plan_id) {
          const { error: syncError } = await supabase
            .from('content_plans')
            .update({ status: 'Chờ duyệt' })
            .eq('id', targetPost.plan_id);
          
          if (syncError) console.error('Lỗi hoàn tác trạng thái kế hoạch:', syncError);
        } else if (targetPost.title) {
          const { error: syncError } = await supabase
            .from('content_plans')
            .update({ status: 'Chờ duyệt' })
            .eq('company_id', targetPost.company_id)
            .eq('title', targetPost.title);
          
          if (syncError) console.error('Lỗi hoàn tác trạng thái kế hoạch:', syncError);
        }
      }

      setPosts(posts.filter(p => p.id !== id));
    } catch (err: any) {
      console.error(err);
      alert('Lỗi khi xóa bài viết: ' + err.message);
    }
  };

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('published_contents').select('*').eq('company_id', companyId).order('id', { ascending: false });
      if (error) throw error;
      if (data) {
        setPosts(data);
      }
    } catch (err) {
      console.log('Lỗi fetching Supabase:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingItem(null);
    const today = new Date();
    const formattedDate = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;

    setEditForm({
      date: formattedDate,
      publish_time: '09:00',
      title: '',
      desc: '',
      type: 'Text',
      media: '',
      notes: '',
      link: ''
    });
    setIsModalOpen(true);
  };

  const handleEditClick = (item: any) => {
    setEditingItem(item);
    setEditForm({ 
      ...item,
      publish_time: item.publish_time || '09:00'
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (editingItem) {
        const { error } = await supabase
          .from('published_contents')
          .update({
            date: editForm.date,
            publish_time: editForm.publish_time || '09:00',
            title: editForm.title,
            desc: editForm.desc,
            type: editForm.type,
            media: editForm.media,
            notes: editForm.notes,
            link: editForm.link
          })
          .eq('id', editingItem.id);

        if (error) throw error;

        // Đồng bộ ngược lại các thay đổi sang trang Kế hoạch nội dung theo plan_id
        if (editingItem.plan_id) {
          const { error: syncError } = await supabase
            .from('content_plans')
            .update({
              date: editForm.date,
              publish_time: editForm.publish_time || '09:00',
              title: editForm.title,
              desc: editForm.desc,
              type: editForm.type,
              material: editForm.media,
              notes: editForm.notes
            })
            .eq('id', editingItem.plan_id);

          if (syncError) console.error('Lỗi đồng bộ sửa sang trang Kế hoạch nội dung:', syncError);
        } else if (editingItem.title) {
          const { error: syncError } = await supabase
            .from('content_plans')
            .update({
              date: editForm.date,
              publish_time: editForm.publish_time || '09:00',
              title: editForm.title,
              desc: editForm.desc,
              type: editForm.type,
              material: editForm.media,
              notes: editForm.notes
            })
            .eq('company_id', editingItem.company_id)
            .eq('title', editingItem.title);

          if (syncError) console.error('Lỗi đồng bộ sửa sang trang Kế hoạch nội dung:', syncError);
        }

        setPosts(posts.map(p => p.id === editingItem.id ? { ...p, ...editForm } : p));
      } else {
        const { data, error } = await supabase
          .from('published_contents')
          .insert([{
            company_id: companyId,
            date: editForm.date,
            title: editForm.title,
            desc: editForm.desc,
            type: editForm.type,
            media: editForm.media,
            notes: editForm.notes,
            link: editForm.link
          }])
          .select();

        if (error) {
          throw error;
        } else if (data) {
          // Tạo một kế hoạch tương ứng ở trạng thái Đã duyệt bên trang Kế hoạch
          const { data: planData, error: planError } = await supabase
            .from('content_plans')
            .insert([{
              company_id: companyId,
              date: editForm.date,
              title: editForm.title,
              desc: editForm.desc,
              type: editForm.type,
              material: editForm.media,
              notes: editForm.notes,
              status: 'Đã duyệt'
            }])
            .select();
          
          if (!planError && planData && planData.length > 0) {
            await supabase
              .from('published_contents')
              .update({ plan_id: planData[0].id })
              .eq('id', data[0].id);
            data[0].plan_id = planData[0].id;
          }

          setPosts([data[0], ...posts]);
        }
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Lỗi khi lưu! Đang ở chế độ local.');
      if (!editingItem) {
        setPosts([{ ...editForm, id: Date.now() }, ...posts]);
      } else {
        setPosts(posts.map(p => p.id === editingItem.id ? { ...p, ...editForm } : p));
        if (editingItem.plan_id) {
          triggerN8nSync(editingItem.plan_id);
        }
      }
      setIsModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const triggerN8nSync = async (planId: number | string) => {
    try {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const defaultBackend = isLocal ? 'http://localhost:3005/api' : 'https://crm.tikovia.vn/api';
      const backendUrl = (isLocal && !import.meta.env.VITE_BACKEND_URL?.includes('localhost'))
        ? defaultBackend
        : (import.meta.env.VITE_BACKEND_URL || defaultBackend);
      const cleanUrl = backendUrl.replace(/\/+$/, '');
      const endpoint = cleanUrl.endsWith('/api') ? `${cleanUrl}/automation/trigger-approval` : `${cleanUrl}/api/automation/trigger-approval`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId })
      });
      const data = await res.json();
      console.log('Đã đồng bộ n8n từ trang triển khai:', data);
    } catch (e) {
      console.warn('Lỗi gọi automation sync từ triển khai:', e);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, item: any) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      setUploadingId(item.id);
      
      // Upload file to Google Drive (via Backend) or Supabase Storage
      const uploadResult = await uploadFile(file, `pub_${item.id}`);
      const publicUrl = uploadResult.url;

      const updatedMedia = item.media ? `${item.media}\nFILE:${publicUrl}` : `FILE:${publicUrl}`;
      await supabase.from('published_contents').update({ media: updatedMedia }).eq('id', item.id);

      // Đồng bộ ngược lại file đính kèm sang trang Kế hoạch
      if (item.plan_id) {
        const { error: syncError } = await supabase
          .from('content_plans')
          .update({ material: updatedMedia })
          .eq('id', item.plan_id);

        if (syncError) {
          console.error('Lỗi đồng bộ file đính kèm sang trang Kế hoạch:', syncError);
        } else {
          triggerN8nSync(item.plan_id);
        }
      } else if (item.title) {
        const { error: syncError } = await supabase
          .from('content_plans')
          .update({ material: updatedMedia })
          .eq('company_id', item.company_id)
          .eq('title', item.title);

        if (syncError) console.error('Lỗi đồng bộ file đính kèm sang trang Kế hoạch:', syncError);
      }

      setPosts(posts.map(p => p.id === item.id ? { ...p, media: updatedMedia } : p));
    } catch (err) {
      console.error('Lỗi upload', err);
      alert('Lỗi tải file. Vui lòng kiểm tra lại Storage bucket.');
    } finally {
      setUploadingId(null);
    }
  };

  const handleDeleteMediaFile = async (item: any, fileUrlToDelete: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa file đính kèm này không?")) return;
    try {
      const lines = (item.media || '').split('\n');
      const updatedLines = lines.filter((line: string) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('FILE:')) {
          const url = trimmed.replace('FILE:', '').trim();
          return url !== fileUrlToDelete;
        }
        return true;
      });
      const updatedMedia = updatedLines.join('\n').trim();

      const { error } = await supabase
        .from('published_contents')
        .update({ media: updatedMedia })
        .eq('id', item.id);

      if (error) throw error;

      // Đồng bộ ngược lại xóa file sang trang Kế hoạch
      if (item.plan_id) {
        const { error: syncError } = await supabase
          .from('content_plans')
          .update({ material: updatedMedia })
          .eq('id', item.plan_id);

        if (syncError) console.error('Lỗi đồng bộ xóa file đính kèm sang trang Kế hoạch:', syncError);
      } else if (item.title) {
        const { error: syncError } = await supabase
          .from('content_plans')
          .update({ material: updatedMedia })
          .eq('company_id', item.company_id)
          .eq('title', item.title);

        if (syncError) console.error('Lỗi đồng bộ xóa file đính kèm sang trang Kế hoạch:', syncError);
      }

      setPosts(posts.map(p => p.id === item.id ? { ...p, media: updatedMedia } : p));
    } catch (err: any) {
      console.error(err);
      alert('Lỗi xóa file: ' + err.message);
    }
  };

  const isVideoUrl = (url: string) => {
    return url.match(/\.(mp4|mov|webm|avi|mkv|flv|wmv)($|\?)/i) != null;
  };

  const isImageUrl = (url: string) => {
    if (isVideoUrl(url)) return false;
    return url.match(/\.(jpeg|jpg|gif|png|webp|svg)($|\?)/i) != null || url.includes('/storage/v1/object/public/materials') || url.includes('drive.google.com') || url.includes('/api/upload');
  };

  const renderMedia = (mediaText: string, item: any) => {
    if (!mediaText) return <span className="text-xs text-gray-400 italic">Chưa có ảnh/video</span>;
    return (
      <div className="flex flex-col gap-1.5">
        {mediaText.split('\n').map((line, idx) => {
          if (line.trim().startsWith('FILE:')) {
            const url = line.replace('FILE:', '').trim();
            const isVid = isVideoUrl(url);
            const isImg = isImageUrl(url);
            return (
              <div key={idx} className="flex items-center gap-1.5 flex-wrap">
                {isVid ? (
                  <button
                    type="button"
                    onClick={() => setPreviewImage(url)}
                    className="flex items-center gap-1.5 px-2 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded text-xs font-medium transition-colors cursor-pointer"
                    title="Bấm để xem video"
                  >
                    <Video className="w-3 h-3 text-purple-600 dark:text-purple-400" /> Xem video
                  </button>
                ) : isImg ? (
                  <button
                    type="button"
                    onClick={() => setPreviewImage(url)}
                    className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-medium transition-colors cursor-pointer"
                    title="Bấm để xem ảnh"
                  >
                    <Eye className="w-3 h-3 text-brand-blue" /> Xem ảnh
                  </button>
                ) : (
                  <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-medium transition-colors w-max">
                    <Paperclip className="w-3 h-3" /> File đính kèm
                  </a>
                )}
                <a href={url} target="_blank" rel="noreferrer" title="Mở link trực tiếp" className="p-1 text-gray-400 hover:text-brand-blue rounded transition-colors">
                  <ExternalLink className="w-3 h-3" />
                </a>
                {canInteract && (
                  <button 
                    onClick={() => handleDeleteMediaFile(item, url)}
                    title="Xóa file đính kèm này"
                    className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors animate-in fade-in"
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

  const groupedPosts = [...getGroupedItems(posts)].reverse();

  const filteredPostsForSummary = getFilteredPostsForSummary();
  const completedCount = filteredPostsForSummary.length;
  const remainingCount = Math.max(0, targetPosts - completedCount);

  return (
    <div className="space-y-6 relative animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Activity className="w-6 h-6 text-brand-blue" />
            Báo cáo triển khai
          </h2>
          <p className="text-sm text-gray-500 mt-1">Lưu trữ và theo dõi các bài viết đã được đăng tải chính thức</p>
        </div>
        {canInteract && (
          <div className="flex items-center gap-3">
            <Button onClick={handleOpenAddModal} className="gap-2 shadow-sm bg-brand-blue hover:bg-blue-700 text-white">
              <Plus className="w-4 h-4" />
              Ghi bài đã đăng
            </Button>
          </div>
        )}
      </div>

      <Card className="p-0 overflow-hidden relative">
        {loading && <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">Đang tải...</div>}
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/20">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            Danh sách bài đăng trên nền tảng
            <span className="bg-blue-100 text-brand-blue text-xs py-0.5 px-2 rounded-full font-bold">{posts.length}</span>
          </h3>
        </div>

        {posts.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            Chưa có ghi nhận bài viết nào đã đăng.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {groupedPosts.map((group) => (
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
                    {/* Desktop: Table */}
                    <div className="hidden md:block overflow-x-auto w-full scrollbar-thin border border-gray-100 dark:border-gray-800 rounded-lg">
                      <table className="w-full text-left border-collapse min-w-[1100px]">
                        <thead>
                          <tr className="border-b border-gray-100 dark:border-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900">
                            <th className="px-6 py-4 font-medium" style={{ width: '10%' }}>Thời gian</th>
                            <th className="px-6 py-4 font-medium" style={{ width: '15%' }}>Tiêu đề</th>
                            <th className="px-6 py-4 font-medium" style={{ width: '20%' }}>Nội dung</th>
                            <th className="px-6 py-4 font-medium" style={{ width: '10%' }}>Thể loại</th>
                            <th className="px-6 py-4 font-medium" style={{ width: '15%' }}>Ảnh/Video chính thức</th>
                            <th className="px-6 py-4 font-medium" style={{ width: '12%' }}>Ghi chú</th>
                            <th className="px-6 py-4 font-medium" style={{ width: '10%' }}>Link bài viết</th>
                            {canInteract && <th className="px-6 py-4 font-medium text-right">Hành động</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm bg-white dark:bg-gray-900">
                          {group.items.map((item: any) => (
                            <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors align-top bg-white dark:bg-gray-900">
                              <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                                <div className="flex flex-col gap-1.5 font-medium">
                                  <span className="flex items-center gap-2"><CalendarDays className="w-4 h-4 text-brand-blue" /> {item.date}</span>
                                  {item.publish_time && (
                                    <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-normal">
                                      <Clock className="w-3.5 h-3.5" /> {item.publish_time}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <p className="font-semibold text-gray-900 dark:text-white line-clamp-3 leading-relaxed">{item.title}</p>
                              </td>
                              <td className="px-6 py-4">
                                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 leading-relaxed break-words">{item.desc}</p>
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
                                  {renderMedia(item.media, item)}
                                  {canInteract && (
                                    <label className={cn(
                                      "inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors w-max border",
                                      uploadingId === item.id
                                        ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                        : "bg-white text-gray-600 hover:bg-gray-50 hover:text-brand-blue border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                                    )}>
                                      {uploadingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                                      {uploadingId === item.id ? 'Đang tải...' : 'Upload ảnh/video'}
                                      <input type="file" className="hidden" accept="image/*,video/*" onChange={(e) => handleFileUpload(e, item)} disabled={uploadingId === item.id} />
                                    </label>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-xs text-gray-500 italic break-words">{item.notes}</span>
                              </td>
                              <td className="px-6 py-4">
                                {item.link ? (
                                  <div className="flex flex-col gap-1">
                                    <a href={item.link.startsWith('http') ? item.link : `https://${item.link}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-brand-blue hover:text-blue-700 hover:underline">
                                      <ExternalLink className="w-3.5 h-3.5" /> Mở bài viết
                                    </a>
                                    {canInteract && (
                                      <button 
                                        onClick={() => {
                                          const newLink = prompt("Nhập link bài viết mới:", item.link);
                                          if (newLink !== null) {
                                            handleUpdateLink(item.id, newLink);
                                          }
                                        }}
                                        className="text-[10px] text-gray-400 hover:text-brand-blue text-left cursor-pointer"
                                      >
                                        Sửa link
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  canInteract ? (
                                    <button
                                      onClick={() => {
                                        const newLink = prompt("Nhập link bài viết đã đăng:");
                                        if (newLink !== null && newLink.trim() !== '') {
                                          handleUpdateLink(item.id, newLink.trim());
                                        }
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 text-brand-blue rounded text-xs font-medium hover:bg-blue-100 transition-colors cursor-pointer"
                                    >
                                      + Thêm link
                                    </button>
                                  ) : (
                                    <span className="text-xs text-gray-400">Chưa có link</span>
                                  )
                                )}
                              </td>
                              {canInteract && (
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button onClick={() => handleEditClick(item)} title="Sửa" className="p-1.5 text-gray-500 hover:text-brand-blue hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors bg-white dark:bg-gray-800 shadow-sm border border-gray-150 dark:border-gray-700">
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDeletePost(item.id)} title="Xóa" className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors bg-white dark:bg-gray-800 shadow-sm border border-gray-150 dark:border-gray-700">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile: Card view */}
                    <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800 border border-gray-100 dark:border-gray-800 rounded-lg">
                      {group.items.map((item: any) => (
                        <div key={item.id} className="p-4 space-y-2.5 bg-white dark:bg-gray-900">
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
                              <span className={cn(
                                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border",
                                item.type === 'Text' || !item.type ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400" : "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400",
                              )}>
                                {item.type === 'Text' || !item.type ? <FileText className="w-2.5 h-2.5" /> : <Video className="w-2.5 h-2.5" />}
                                {item.type || 'Text'}
                              </span>
                            </div>
                            {item.link ? (
                              <div className="flex items-center gap-2">
                                <a href={item.link.startsWith('http') ? item.link : `https://${item.link}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] text-brand-blue font-medium">
                                  <ExternalLink className="w-3.5 h-3.5" /> Mở link
                                </a>
                                {canInteract && (
                                  <button 
                                    onClick={() => {
                                      const newLink = prompt("Nhập link bài viết mới:", item.link);
                                      if (newLink !== null) {
                                        handleUpdateLink(item.id, newLink);
                                      }
                                    }}
                                    className="text-[9px] text-gray-400 cursor-pointer"
                                  >
                                    (Sửa)
                                  </button>
                                )}
                              </div>
                            ) : (
                              canInteract && (
                                <button
                                  onClick={() => {
                                    const newLink = prompt("Nhập link bài viết đã đăng:");
                                    if (newLink !== null && newLink.trim() !== '') {
                                      handleUpdateLink(item.id, newLink.trim());
                                    }
                                  }}
                                  className="text-[10px] text-brand-blue font-medium bg-blue-50 px-2 py-0.5 rounded border border-blue-100 cursor-pointer"
                                >
                                  + Thêm link
                                </button>
                              )
                            )}
                          </div>
                          <p className="font-semibold text-sm text-gray-900 dark:text-white leading-snug">{item.title}</p>
                          {item.desc && <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{item.desc}</p>}
                          {item.media && <div className="text-xs">{renderMedia(item.media, item)}</div>}
                          {item.notes && <p className="text-[11px] text-gray-400 italic">💡 {item.notes}</p>}
                          <div className="flex items-center gap-2 pt-1">
                            {canInteract && (
                              <>
                                <button onClick={() => handleEditClick(item)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-blue bg-brand-blue/5 border border-brand-blue/20 rounded-lg">
                                  <Edit className="w-3 h-3" /> Sửa
                                </button>
                                <button onClick={() => handleDeletePost(item.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30">
                                  <Trash2 className="w-3 h-3" /> Xóa
                                </button>
                                <label className={cn(
                                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border",
                                  uploadingId === item.id ? "bg-gray-100 text-gray-400 border-gray-200" : "text-gray-600 bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700"
                                )}>
                                  {uploadingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                                  {uploadingId === item.id ? 'Tải...' : 'Upload'}
                                  <input type="file" className="hidden" accept="image/*,video/*" onChange={(e) => handleFileUpload(e, item)} disabled={uploadingId === item.id} />
                                </label>
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

      {/* Summary Panel */}
      <div className="flex justify-start mt-6">
        <Card className="w-full max-w-md bg-white dark:bg-gray-900 border-l-2 border-l-brand-blue shadow-sm">
          <div className="p-5">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-blue" /> Tổng hợp tiến độ
              </h4>
              {canInteract && (
                <Button
                  variant="outline"
                  className="text-[11px] h-6 px-2 py-0 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 shadow-sm"
                  onClick={() => {
                    const label = filterType === 'all' 
                      ? 'tất cả thời gian' 
                      : filterType === 'month' 
                        ? `tháng ${selectedMonth}` 
                        : `chu kỳ từ ${customStartDate} đến ${customEndDate}`;
                    const val = prompt(`Nhập tổng số bài viết cần bàn giao cho ${label}:`, targetPosts.toString());
                    if (val !== null && !isNaN(parseInt(val))) {
                      setTargetPosts(parseInt(val));
                      const key = getTargetStorageKey(filterType, selectedMonth, customStartDate, customEndDate);
                      if (key) localStorage.setItem(key, val);
                    }
                  }}
                >
                  Ghi trước chỉ tiêu
                </Button>
              )}
            </div>

            {/* Filter Section */}
            <div className="mb-4 space-y-3 bg-gray-50 dark:bg-gray-800/40 p-3 rounded-lg border border-gray-100 dark:border-gray-800/60">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-500">Phạm vi tổng hợp:</span>
                <select
                  value={filterType}
                  onChange={e => handleFilterTypeChange(e.target.value as any)}
                  className="text-xs bg-white dark:bg-gray-900 border border-gray-250 dark:border-gray-700 rounded px-2 py-1 focus:ring-1 focus:ring-brand-blue font-medium cursor-pointer"
                >
                  <option value="all">Tất cả thời gian</option>
                  <option value="month">Theo tháng</option>
                  <option value="custom">Chu kỳ tự chọn</option>
                </select>
              </div>

              {filterType === 'month' && (
                <div className="flex items-center justify-between gap-2 animate-in fade-in duration-200">
                  <span className="text-xs font-semibold text-gray-500">Chọn tháng:</span>
                  <select
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(e.target.value)}
                    className="text-xs bg-white dark:bg-gray-900 border border-gray-250 dark:border-gray-700 rounded px-2 py-1 focus:ring-1 focus:ring-brand-blue font-medium cursor-pointer"
                  >
                    {getUniqueMonths(posts).map(m => (
                      <option key={m} value={m}>Tháng {m}</option>
                    ))}
                  </select>
                </div>
              )}

              {filterType === 'custom' && (
                <div className="grid grid-cols-2 gap-2 pt-1 animate-in slide-in-from-top-2 duration-200">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Từ ngày</label>
                    <input
                      type="text"
                      className="w-full text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 focus:ring-1 focus:ring-brand-blue font-medium"
                      placeholder="DD/MM/YYYY"
                      value={customStartDate}
                      onChange={e => setCustomStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Đến ngày</label>
                    <input
                      type="text"
                      className="w-full text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 focus:ring-1 focus:ring-brand-blue font-medium"
                      placeholder="DD/MM/YYYY"
                      value={customEndDate}
                      onChange={e => setCustomEndDate(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2.5 text-[14px]">
              <div className="flex justify-between text-gray-500">
                <span>Tổng số bài viết:</span>
                <span className="font-bold text-gray-900 dark:text-white">{targetPosts}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Đã hoàn thành:</span>
                <span className="font-bold text-green-600">{completedCount}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Chưa hoàn thành:</span>
                <span className="font-bold text-orange-500">{remainingCount}</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 mt-4 overflow-hidden shadow-inner">
                <div
                  className="bg-brand-blue h-full rounded-full transition-all duration-500"
                  style={{ width: `${targetPosts > 0 ? Math.min(100, (completedCount / targetPosts) * 100) : 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <Card className="w-full max-w-2xl p-0 overflow-hidden bg-white dark:bg-gray-900 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Rocket className="w-5 h-5 text-gray-400" />
                {editingItem ? 'Sửa thông tin bài đăng' : 'Ghi bài đã đăng'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5 text-brand-blue" />
                    Thời gian đăng bài
                  </label>
                  <input
                    type="text"
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-brand-blue/50 text-gray-900 dark:text-white"
                    value={editForm.date || ''}
                    onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                    placeholder="Ví dụ: 15/4/2026"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-brand-blue" />
                    Giờ đăng
                  </label>
                  <input
                    type="time"
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3.5 py-2 text-sm focus:ring-2 focus:ring-brand-blue/50 text-gray-900 dark:text-white font-medium"
                    value={editForm.publish_time || '09:00'}
                    onChange={e => setEditForm({ ...editForm, publish_time: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tiêu đề bài viết</label>
                <input
                  type="text"
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-blue/50 text-gray-900 dark:text-white"
                  value={editForm.title || ''}
                  onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nội dung đã đăng</label>
                <textarea
                  rows={3}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-blue/50 text-gray-900 dark:text-white"
                  value={editForm.desc || ''}
                  onChange={e => setEditForm({ ...editForm, desc: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Thể loại</label>
                  <select
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-blue/50 text-gray-900 dark:text-white"
                    value={editForm.type || 'Text'}
                    onChange={e => setEditForm({ ...editForm, type: e.target.value })}
                  >
                    <option value="Text">Text (Hình ảnh & Chữ)</option>
                    <option value="Video">Video (Tiktok, Reels)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Link URL bài viết (Facebook/Tiktok)</label>
                  <input
                    type="text"
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-blue/50 text-gray-900 dark:text-white"
                    value={editForm.link || ''}
                    onChange={e => setEditForm({ ...editForm, link: e.target.value })}
                    placeholder="https://facebook.com/..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mô tả File/Ảnh chính thức</label>
                  <input
                    type="text"
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-blue/50 text-gray-900 dark:text-white placeholder-gray-400"
                    placeholder="Ghi chú về file đính kèm..."
                    value={editForm.media || ''}
                    onChange={e => setEditForm({ ...editForm, media: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ghi chú thêm</label>
                  <input
                    type="text"
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-blue/50 text-gray-900 dark:text-white placeholder-gray-400"
                    placeholder="Khách hàng đã rep tốt..."
                    value={editForm.notes || ''}
                    onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 bg-gray-50/50 dark:bg-gray-800/50">
              <Button
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="bg-white dark:bg-gray-800"
              >
                Hủy bỏ
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="gap-2 bg-brand-blue hover:bg-blue-700 text-white border-0"
              >
                {isSaving ? (
                  <>Đang lưu...</>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Lưu bài viết
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Lightbox Preview Modal cho Ảnh tư liệu / Triển khai */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-4xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/80">
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-brand-blue" /> Xem tư liệu / Hình ảnh bài viết
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
              {isVideoUrl(previewImage) ? (
                <video 
                  src={previewImage} 
                  controls 
                  autoPlay 
                  className="max-h-[75vh] max-w-full rounded-lg shadow-sm"
                />
              ) : (
                <img 
                  src={previewImage} 
                  alt="Ảnh bài viết" 
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
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
