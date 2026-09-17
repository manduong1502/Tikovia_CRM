import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Database, Upload, Save, File, X, FileText, Image as ImageIcon, CheckCircle2, Loader2, Download } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';
import { uploadFile } from '../../lib/uploadHelper';

export function ChatbotData() {
  const { id: companyId } = useParams();
  const [existingFiles, setExistingFiles] = useState<any[]>([]);
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
  const [note, setNote] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (companyId) {
      fetchData();
    }
  }, [companyId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('companies').select('chatbot_notes, chatbot_files').eq('id', companyId).single();
      if (error && error.code !== 'PGRST116') {
        console.error(error);
      }
      if (data) {
        setNote(data.chatbot_notes || '');
        setExistingFiles(data.chatbot_files || []);
      }
    } catch (err) {
      console.log('Lỗi fetch chatbot data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFilesToUpload(prev => [...prev, ...Array.from(e.target.files!)]);
      setShowSuccess(false);
    }
  };

  const removeFileToUpload = (index: number) => {
    setFilesToUpload(prev => prev.filter((_, i) => i !== index));
    setShowSuccess(false);
  };
  
  const removeExistingFile = (index: number) => {
    if (!window.confirm('Bạn có chắc muốn xóa tệp này khỏi dữ liệu lưu trữ?')) return;
    setExistingFiles(prev => prev.filter((_, i) => i !== index));
    setShowSuccess(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let newlyUploaded: any[] = [];
      
      // Upload pending files to Google Drive (via Backend) or Supabase Storage
      if (filesToUpload.length > 0) {
        for (const file of filesToUpload) {
          const uploadedResult = await uploadFile(file, `chatbot_${companyId}`);
          newlyUploaded.push(uploadedResult);
        }
      }
      
      const finalFilesList = [...existingFiles, ...newlyUploaded];
      
      // Update the companies table
      const { error: updateError } = await supabase.from('companies').update({
        chatbot_notes: note,
        chatbot_files: finalFilesList
      }).eq('id', companyId);
      
      if (updateError) {
        if (updateError.message.includes('column "chatbot_notes" of relation "companies" does not exist')) {
           alert('Bạn chưa cập nhật SQL Database! Vui lòng nhờ kỹ thuật viên chạy lệnh thêm cột vào bảng companies.');
        } else {
           throw updateError;
        }
      } else {
        setExistingFiles(finalFilesList);
        setFilesToUpload([]);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 5000);
      }
    } catch (err: any) {
      console.error(err);
      alert('Lỗi lưu dữ liệu: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const getFileIcon = (file: File) => {
    const type = file.type;
    const name = file.name.toLowerCase();
    
    if (type.includes('image') || name.match(/\.(jpg|jpeg|png|gif)$/i)) {
      return <ImageIcon className="w-5 h-5 text-blue-500" />;
    }
    if (type.includes('sheet') || type.includes('excel') || name.match(/\.(xls|xlsx|csv)$/i)) {
      return <FileText className="w-5 h-5 text-emerald-500 flex-shrink-0" />;
    }
    if (type.includes('word') || type.includes('document') || name.match(/\.(doc|docx)$/i)) {
      return <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />;
    }
    return <File className="w-5 h-5 text-gray-500 flex-shrink-0" />;
  };

  return (
    <div className="space-y-6 relative animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Database className="w-6 h-6 text-brand-blue" />
            Nội dung Chatbot (Đào tạo AI)
          </h2>
          <p className="text-sm text-gray-500 mt-1">Cung cấp tài liệu sản phẩm, chính sách (Excel, Word, Ảnh) để huấn luyện trợ lý ảo bán hàng.</p>
        </div>
      </div>

      {showSuccess && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between mb-6 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
              Cập nhật dữ liệu thành công! Trợ lý AI sẽ học từ các tài liệu này trong vòng 5-10 phút.
            </p>
          </div>
          <button onClick={() => setShowSuccess(false)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <Card className="p-0 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm max-w-4xl overflow-hidden">
        <div className="p-6 space-y-8">
          {/* UPLOAD SECTION */}
          <div>
            <label className="block text-[15px] font-bold text-gray-900 dark:text-white mb-3">1. Upload Tài liệu Đào tạo</label>
            <label className="block border-2 border-dashed border-gray-200 hover:border-brand-blue/50 dark:border-gray-700 dark:hover:border-blue-500/50 rounded-xl p-10 text-center hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer relative group">
              <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Upload className="w-8 h-8 text-brand-blue" />
              </div>
              <p className="text-[15px] font-semibold text-gray-700 dark:text-gray-300">Kéo thả hoặc click để tải lên tệp tin</p>
              <p className="text-sm text-gray-500 mt-1.5">Hỗ trợ: Word, Excel, Hình ảnh sản phẩm (Tối đa 10MB/tệp)</p>
              <input type="file" multiple accept=".doc,.docx,.xls,.xlsx,image/*" onChange={handleFileChange} className="hidden" />
            </label>

            {/* Existing Files on DB */}
            {existingFiles.length > 0 && (
              <div className="mt-5 space-y-2.5">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Tệp đã lưu trên hệ thống</p>
                {existingFiles.map((file, i) => (
                  <div key={`exist-${i}`} className="flex items-center justify-between p-3.5 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/50 group transition-colors">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <File className="w-5 h-5 text-brand-blue flex-shrink-0" />
                      <a href={file.url} target="_blank" rel="noreferrer" className="text-[14px] font-semibold text-brand-blue hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 truncate hover:underline">
                        {file.name}
                      </a>
                      <span className="text-[12px] font-medium text-gray-400 bg-white dark:bg-gray-800 px-2 py-0.5 rounded shadow-sm border border-gray-100 dark:border-gray-700">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <a href={file.url} target="_blank" rel="noreferrer" className="p-1.5 text-gray-400 hover:bg-white hover:text-brand-blue dark:hover:bg-gray-800 rounded-lg transition-colors">
                        <Download className="w-4 h-4" />
                      </a>
                      <button onClick={() => removeExistingFile(i)} className="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* New Files to Upload */}
            {filesToUpload.length > 0 && (
              <div className="mt-5 space-y-2.5">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Tệp chuẩn bị tải lên</p>
                {filesToUpload.map((file, i) => (
                  <div key={`new-${i}`} className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800/80 group transition-colors hover:border-gray-300 dark:hover:border-gray-600">
                    <div className="flex items-center gap-3 overflow-hidden">
                      {getFileIcon(file)}
                      <span className="text-[14px] font-semibold text-gray-700 dark:text-gray-200 truncate">{file.name}</span>
                      <span className="text-[12px] font-medium text-gray-400 bg-white dark:bg-gray-800 px-2 py-0.5 rounded shadow-sm border border-gray-100 dark:border-gray-700">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                    <button 
                      onClick={() => removeFileToUpload(i)} 
                      title="Hủy tải lên"
                      className="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:text-gray-500 dark:hover:bg-red-900/30 dark:hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* NOTE SECTION */}
          <div>
            <label className="block text-[15px] font-bold text-gray-900 dark:text-white mb-3">2. Ghi chú dặn dò Chatbot (Prompt)</label>
            <p className="text-[13px] text-gray-500 mb-3">Nhập các lưu ý hoặc thông tin chỉ đạo cách AI trả lời khách hàng (Ví dụ: Miễn phí xịp ship nội thành Hà Nội, Thái độ nhiệt tình thân thiện...)</p>
            <textarea 
              rows={5}
              value={note}
              onChange={e => {
                setNote(e.target.value);
                setShowSuccess(false);
              }}
              className="w-full text-[14px] bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3 focus:border-brand-blue focus:ring-0 text-gray-900 dark:text-white placeholder-gray-400 transition-colors custom-scrollbar outline-none"
              placeholder="VD: Không áp dụng giảm giá đối với các sản phẩm xả kho..."
            />
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="p-5 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 bg-gray-50/50 dark:bg-gray-800/30">
          <Button 
            onClick={handleSave} 
            disabled={isSaving} 
            className="gap-2 bg-brand-blue hover:bg-blue-700 text-white min-w-[140px] shadow-sm transform transition-all active:scale-95 disabled:active:scale-100"
          >
            {isSaving ? (
              <>
                <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />
                Đang xử lý...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Lưu vào hệ thống
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
