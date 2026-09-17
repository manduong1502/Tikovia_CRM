import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Trash2, ExternalLink, MessageCircle, Image as ImageIcon, Loader2, Save, X, Search, Info } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { cn } from '../../components/ui/Card';
import { supabase } from '../../lib/supabase';
import { uploadFile } from '../../lib/uploadHelper';

// Lưới giao diện hiển thị các Demo Web / Zalo
export function Demos({ type }: { type: 'web' | 'zalo' }) {
  const { currentRole } = useOutletContext<{ currentRole: string, permissions: string[] }>();
  const [demos, setDemos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [form, setForm] = useState({
    name: '',
    link: '',
    industry: '',
    image_url: ''
  });

  const title = type === 'web' ? 'Kho Giao diện Website' : 'Kho Giao diện Zalo MiniApp';
  const subtitle = type === 'web' 
                   ? 'Khám phá các mẫu website chuẩn SEO, tốc độ cao được thiết kế sẵn'
                   : 'Trải nghiệm các siêu ứng dụng MiniApp đẳng cấp chạy trực tiếp trên Zalo';

  useEffect(() => {
    fetchDemos();
  }, [type]);

  const fetchDemos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tikovia_demos')
        .select('*')
        .eq('type', type)
        .order('created_at', { ascending: false });
        
      if (!error && data) {
        setDemos(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = () => {
    setForm({ name: '', link: '', industry: '', image_url: '' });
    setIsModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // Upload demo image to Google Drive (via Backend) or Supabase Storage
      const uploadResult = await uploadFile(file, `demo_${type}`);
      setForm({ ...form, image_url: uploadResult.url });
    } catch (err: any) {
      alert("Lỗi Upload ảnh: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveDemo = async () => {
    if (!form.name || !form.link) {
      alert("Vui lòng điền đủ Tên và Link demo!");
      return;
    }
    
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('tikovia_demos')
        .insert([{
           type,
           name: form.name,
           industry: form.industry,
           link: form.link,
           image_url: form.image_url
        }])
        .select();
        
      if (error) throw error;
      
      if (data) {
        setDemos([data[0], ...demos]);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      alert("Có lỗi xảy ra: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Bạn có chắc muốn xóa Demo này?")) return;
    
    try {
      const { error } = await supabase.from('tikovia_demos').delete().eq('id', id);
      if (error) throw error;
      setDemos(demos.filter(d => d.id !== id));
    } catch (err: any) {
      alert("Lỗi xóa: " + err.message);
    }
  };

  // Filter items
  const filteredDemos = demos.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-gray-900 to-gray-800 dark:from-gray-900 dark:to-black p-5 md:p-8 rounded-2xl shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-blue/20 blur-3xl rounded-full -translate-y-1/2 translate-x-1/3"></div>
        
        <div className="relative z-10">
          <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-1 md:mb-2">{title}</h2>
          <p className="text-gray-300 max-w-xl text-sm leading-relaxed">{subtitle}</p>
        </div>
        
        <div className="relative z-10 shrink-0">
          {currentRole === 'admin' && (
            <Button onClick={handleOpenModal} className="bg-white text-gray-900 hover:bg-gray-100 flex items-center gap-2 font-bold shadow-lg shadow-black/20 px-6 py-2.5">
              <Plus className="w-5 h-5" />
              Thêm Mẫu {type === 'web' ? 'Web' : 'MiniApp'}
            </Button>
          )}
        </div>
      </div>

      {/* Tip for Zalo MiniApp Demo on Desktop */}
      {type === 'zalo' && (
        <div className="bg-blue-50 dark:bg-brand-blue/10 border border-blue-200 dark:border-brand-blue/20 rounded-xl p-4 flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="p-2 bg-white dark:bg-brand-blue/20 rounded-lg shrink-0 shadow-sm border border-blue-100 dark:border-transparent">
            <Info className="w-5 h-5 text-brand-blue dark:text-blue-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-blue-900 dark:text-blue-300 mb-1 flex items-center gap-2">
              Mẹo trải nghiệm tốt nhất trên máy tính
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-200 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300">Dành cho Desktop</span>
            </h4>
            <p className="text-sm text-blue-800 dark:text-blue-200/80 leading-relaxed md:pr-10">
              Với màn hình máy tính (Desktop/Laptop), vui lòng nhấn <strong>F12</strong> sau đó nhấn biểu tượng điện thoại (hoặc tổ hợp phím <kbd className="px-1.5 py-0.5 bg-white dark:bg-black/20 rounded text-xs border border-blue-200 dark:border-blue-900 font-mono shadow-sm">Ctrl + Shift + M</kbd>) để chuyển sang màn hình giả lập kích thước điện thoại. Điều này giúp Zalo MiniApp hoạt động với bố cục và thiết kế chuẩn nhất!
            </p>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <Card className="p-0 overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800">
        
        {/* Toolbar: Search */}
        <div className="p-3 md:p-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 md:w-5 md:h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Tìm kiếm mẫu giao diện..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 md:pl-10 pr-4 py-2 md:py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all dark:text-white"
            />
          </div>
          <div className="text-xs md:text-sm font-medium text-gray-500 shrink-0">
            Tổng cộng: {filteredDemos.length} mẫu
          </div>
        </div>

        {/* Table Area */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center p-20">
              <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
            </div>
          ) : filteredDemos.length === 0 ? (
            <div className="text-center p-20">
              <ImageIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Không tìm thấy giao diện nào</h3>
              <p className="text-gray-500 text-sm">Thử thay đổi từ khóa tìm kiếm hoặc thêm mẫu mới.</p>
            </div>
          ) : (
            <div className="md:overflow-x-auto w-full scrollbar-thin">
            {/* Desktop: Table */}
            <table className="hidden md:table w-full text-left text-sm whitespace-nowrap md:whitespace-normal">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-gray-800/30 border-b border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-4 w-16 text-center">STT</th>
                  <th className="px-6 py-4 w-32">Hình Ảnh</th>
                  <th className="px-6 py-4 w-48">Ngành</th>
                  <th className="px-6 py-4">Tên Giao Diện</th>
                  <th className="px-6 py-4 w-56">Đường Dẫn Chi Tiết</th>
                  <th className="px-6 py-4 text-right w-40">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm bg-white dark:bg-gray-900">
                {filteredDemos.map((demo, index) => (
                  <tr key={demo.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                    <td className="px-6 py-4 text-center font-medium text-gray-500 dark:text-gray-400">{index + 1}</td>
                    <td className="px-6 py-4">
                      {demo.image_url ? (
                        <div className="w-20 h-20 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 shrink-0 cursor-pointer" onClick={() => setPreviewImage(demo.image_url)} title="Bấm để phóng to">
                          <img src={demo.image_url} alt={demo.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center border border-gray-200 dark:border-gray-700">
                          <ImageIcon className="w-6 h-6 text-gray-300" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800/50">{demo.industry || 'Chưa phân loại'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-gray-900 dark:text-white text-base">{demo.name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <a href={demo.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-brand-blue hover:text-blue-700 font-medium transition-colors bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 px-3 py-1.5 rounded-lg">
                        <ExternalLink className="w-4 h-4" /> Truy cập Demo
                      </a>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {currentRole === 'admin' ? (
                        <button onClick={() => handleDelete(demo.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Xóa Demo">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      ) : (
                        <a href={`https://zalo.me/1105969719865346334?message=${encodeURIComponent(`Chào bạn, tôi cần hỗ trợ trực tiếp từ chuyên viên về việc triển khai mẫu ${type === 'web' ? 'Website' : 'Miniapp'} có tên: [${demo.name}].`)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-blue hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm shadow-brand-blue/30 w-full justify-center md:w-auto" title="Liên hệ tư vấn giao diện này">
                          <MessageCircle className="w-4 h-4" /> Liên hệ
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile: Card view */}
            <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
              {filteredDemos.map((demo) => (
                <div key={demo.id} className="p-4 space-y-3">
                  <div className="flex items-center gap-3 w-full">
                    {demo.image_url ? (
                      <div className="w-14 h-14 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 shrink-0 cursor-pointer" onClick={() => setPreviewImage(demo.image_url)}>
                        <img src={demo.image_url} alt={demo.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center border border-gray-200 dark:border-gray-700 shrink-0">
                        <ImageIcon className="w-5 h-5 text-gray-300" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-gray-900 dark:text-white leading-tight">{demo.name}</p>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 mt-1">{demo.industry || 'Chưa phân loại'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full">
                    <a href={demo.link} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-brand-blue bg-blue-50 hover:bg-blue-100 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800/50 rounded-lg transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" /> Truy cập Demo
                    </a>
                    {currentRole === 'admin' ? (
                      <button onClick={() => handleDelete(demo.id)} className="flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium text-red-500 border border-red-200 dark:border-red-800/50 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" /> Xóa
                      </button>
                    ) : (
                      <a href={`https://zalo.me/1105969719865346334?message=${encodeURIComponent(`Chào bạn, tôi cần hỗ trợ trực tiếp từ chuyên viên về việc triển khai mẫu ${type === 'web' ? 'Website' : 'Miniapp'} có tên: [${demo.name}].`)}`} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-brand-blue hover:bg-blue-700 rounded-lg shadow-sm">
                        <MessageCircle className="w-3.5 h-3.5" /> Liên hệ tư vấn
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
            </div>
          )}
        </div>
      </Card>

      {/* Adding Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <Card className="w-full max-w-lg p-0 overflow-hidden bg-white dark:bg-gray-900 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-brand-blue" />
                Thêm Demo Mới
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Tên Giao Diện (Tiêu đề)</label>
                  <input 
                    type="text" 
                    className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-blue/50 text-gray-900 dark:text-white outline-none"
                    placeholder="VD: Landing Quần Áo"
                    value={form.name}
                    onChange={e => setForm({...form, name: e.target.value})}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Trực thuộc ngành</label>
                  <input 
                    type="text" 
                    className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-blue/50 text-gray-900 dark:text-white outline-none"
                    placeholder="VD: Thời trang & May mặc..."
                    value={form.industry || ''}
                    onChange={e => setForm({...form, industry: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Link Trải Nghiệm (URL)</label>
                <input 
                  type="text" 
                  className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-blue/50 text-gray-900 dark:text-white outline-none"
                  placeholder="https://..."
                  value={form.link}
                  onChange={e => setForm({...form, link: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Ảnh Cover Demo (Bắt buộc)</label>
                
                {form.image_url ? (
                  <div className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
                    <img src={form.image_url} alt="preview" className="w-full h-full object-cover" />
                    <button 
                      onClick={() => setForm({...form, image_url: ''})}
                      className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-sm"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className={cn(
                    "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors",
                    isUploading ? "bg-gray-50 border-gray-300" : "bg-gray-50 hover:bg-gray-100 border-gray-300 hover:border-brand-blue dark:bg-gray-800 dark:border-gray-700 hover:dark:border-brand-blue"
                  )}>
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      {isUploading ? (
                        <Loader2 className="w-8 h-8 text-brand-blue animate-spin mb-2" />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
                      )}
                      <p className="text-sm text-gray-500 font-medium">
                        {isUploading ? 'Đang tải lên Supabase...' : 'Click hoặc Kéo thả ảnh vào đây'}
                      </p>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={isUploading} />
                  </label>
                )}
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 bg-gray-50 dark:bg-gray-800/80">
              <Button variant="outline" onClick={() => setIsModalOpen(false)} className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                Hủy bỏ
              </Button>
              <Button onClick={handleSaveDemo} disabled={isSaving || isUploading} className="gap-2 bg-brand-blue hover:bg-blue-700 text-white border-0 shadow-lg shadow-blue-500/20 px-6">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSaving ? 'Đang lưu...' : 'Xuất bản Demo'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[200] p-4 bg-black/80 backdrop-blur-sm overflow-y-auto flex flex-col items-center justify-start min-h-screen"
          onClick={() => setPreviewImage(null)}
        >
          <div 
            className="relative w-full flex justify-center mt-12 mb-12 h-max" 
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setPreviewImage(null)}
              className="absolute -top-12 right-0 md:right-auto md:-right-12 p-2 text-white/50 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors backdrop-blur-md z-10"
            >
              <X className="w-6 h-6" />
            </button>
            <img 
              src={previewImage} 
              alt="Preview" 
              className={cn(
                "rounded-2xl shadow-2xl animate-in fade-in zoom-in-75 duration-300 ease-out",
                type === 'web' 
                  ? "max-w-5xl max-h-[85vh] object-contain" 
                  : "w-full max-w-sm sm:max-w-md h-auto object-contain"
              )} 
            />
          </div>
        </div>
      )}

    </div>
  );
}
