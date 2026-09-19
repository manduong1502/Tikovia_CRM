import React, { useState } from 'react';
import { Book, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AddChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
}

export function AddChannelModal({ isOpen, onClose, companyId }: AddChannelModalProps) {
  const [platform, setPlatform] = useState('zalo');
  const [channelName, setChannelName] = useState('');
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [syncCycle, setSyncCycle] = useState('15');
  const [storeMedia, setStoreMedia] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelName || !appId || !appSecret) return;
    
    setIsLoading(true);
    try {
      const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
      const rawBackend = (isLocal && !import.meta.env.VITE_BACKEND_URL?.includes('localhost'))
        ? 'http://localhost:3005/api'
        : (import.meta.env.VITE_BACKEND_URL || 'https://crm.tikovia.vn/api');
      const backendBase = rawBackend.replace(/\/+$/, '').replace(/\/api$/, '');
      const endpoint = `${backendBase}/api/channels/connect`;

      let backendSuccess = false;
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            platform, 
            name: channelName, 
            appId, 
            secretKey: appSecret, 
            companyId,
            syncCycle: parseInt(syncCycle),
            storeMedia 
          })
        });
        const data = await response.json();
        if (data.authUrl) {
          window.location.href = data.authUrl;
          return;
        } else if (data.success) {
          backendSuccess = true;
          onClose();
          window.location.reload();
          return;
        }
      } catch (beErr) {
        console.warn('Backend /channels/connect unreachable or error, using direct DB fallback:', beErr);
      }

      // Dự phòng lưu trực tiếp vào Supabase nếu backend có sự cố kết nối
      if (!backendSuccess && platform === 'facebook') {
        const { error: dbError } = await supabase.from('channels').insert({
          company_id: companyId,
          provider: 'facebook',
          page_id: appId,
          name: channelName,
          access_token: appSecret,
          status: 'connected',
          auth_data: { appId, secretKey: appSecret, page_token: appSecret, syncCycle: parseInt(syncCycle), storeMedia }
        });
        if (dbError) throw dbError;

        // Đồng bộ sang n8n Webhook
        try {
          const { data: comp } = await supabase.from('companies').select('name').eq('id', companyId).maybeSingle();
          const n8nWebhookUrl = 'https://bot.tikovia.vn/webhook/tikovia-post-approved';
          fetch(n8nWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'channel_connected',
              timestamp: new Date().toISOString(),
              company_id: companyId,
              company_name: comp?.name || 'Tên công ty',
              channel: { name: channelName, provider: 'facebook', page_id: appId, access_token: appSecret }
            })
          }).catch(e => console.warn('n8n notify error:', e));
        } catch (e) {
          console.warn('Silent n8n notify fail:', e);
        }

        onClose();
        window.location.reload();
        return;
      }
    } catch (err: any) {
      console.error('Lỗi khi kết nối kênh:', err);
      alert('Lỗi khi kết nối: ' + (err?.message || 'Có lỗi xảy ra'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-gray-800 rounded shadow-xl w-full max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <h2 className="text-xl font-medium text-gray-900 dark:text-white mb-6 tracking-tight">Kết nối kênh mới</h2>
            
            <div className="space-y-[1.1rem]">
              {/* Loại kênh */}
              <div className="relative">
                <label className="absolute -top-2 left-3 inline-block bg-white dark:bg-gray-800 px-1 text-[11px] font-medium text-gray-500 z-10">
                  Loại kênh
                </label>
                <select 
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="block w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-[10px] text-[15px] text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none appearance-none"
                  style={{ backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1em' }}
                >
                  <option value="zalo">Zalo OA</option>
                  <option value="facebook">Facebook Page</option>
                </select>
              </div>

              {/* Tên kênh */}
              <div>
                <input 
                  type="text" 
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="Tên kênh"
                  className="block w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-[10px] text-[15px] text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none placeholder-gray-400"
                  required
                />
              </div>

              {/* Nút hướng dẫn */}
              <a href="#" className="flex items-center justify-center gap-2 w-full py-[10px] bg-[#eef6fe] dark:bg-blue-900/40 text-blue-500 rounded text-[14px] hover:bg-blue-100 transition duration-200">
                <Book className="w-4 h-4" />
                Hướng dẫn lấy App ID và Secret Key
              </a>

              {/* App ID / Page ID & Secret / Token */}
              <div>
                <div className="relative">
                  <input 
                    type="text" 
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    placeholder={platform === 'zalo' ? "App ID" : "Page ID"}
                    className="block w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-[10px] text-[15px] text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none placeholder-gray-400"
                    required
                  />
                  <p className="text-[12px] text-gray-500 pt-1 pb-3 px-[2px]">
                    {platform === 'zalo' ? 'Lấy từ Cài đặt ứng dụng trên Zalo Developers' : 'ID của Fanpage (lấy từ Business Settings hoặc Graph API Explorer)'}
                  </p>
                </div>
                
                <div className="relative">
                  <input 
                    type="text" 
                    value={appSecret}
                    onChange={(e) => setAppSecret(e.target.value)}
                    placeholder={platform === 'zalo' ? "App Secret" : "Page Access Token (hoặc Long-lived Token)"}
                    className="block w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-[10px] text-[15px] text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none placeholder-gray-400"
                    required
                  />
                  <p className="text-[12px] text-gray-500 pt-1 pb-3 px-[2px]">
                    {platform === 'zalo' ? '' : 'Token có quyền pages_messaging (Không hết hạn càng tốt)'}
                  </p>
                </div>
              </div>

              {/* Info text */}
              {platform === 'zalo' ? (
                <div className="flex gap-2 text-[14px] text-gray-600 dark:text-gray-400 mt-2">
                  <Info className="w-[18px] h-[18px] flex-shrink-0 mt-[2px] text-gray-500" strokeWidth={1.5} />
                  <p className="leading-snug">Nếu ứng dụng Zalo có nhiều OA, bước tiếp theo sẽ mở trang Zalo để chọn OA — hãy chọn <strong>đúng OA</strong> tương ứng với kênh này.</p>
                </div>
              ) : (
                <div className="flex gap-2 text-[14px] text-gray-600 dark:text-gray-400 mt-2">
                  <Info className="w-[18px] h-[18px] flex-shrink-0 mt-[2px] text-gray-500" strokeWidth={1.5} />
                  <p className="leading-snug">Đảm bảo bạn đã cấu hình Webhook trên Facebook App với Token xác minh: <strong>{import.meta.env.VITE_FB_VERIFY_TOKEN || 'my_tikovia_secret_token'}</strong></p>
                </div>
              )}

              {/* Chu kỳ đồng bộ */}
              <div className="relative pt-3">
                <div className="relative">
                  <label className="absolute -top-[9px] left-3 inline-block bg-white dark:bg-gray-800 px-1 text-[11px] font-medium text-gray-500 z-10">
                    Chu kỳ đồng bộ
                  </label>
                  <select 
                    value={syncCycle}
                    onChange={(e) => setSyncCycle(e.target.value)}
                    className="block w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-[10px] text-[15px] text-gray-700 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none appearance-none"
                    style={{ backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1em' }}
                  >
                    <option value="15">Mỗi 15 phút (mặc định)</option>
                    <option value="30">Mỗi 30 phút</option>
                    <option value="60">Mỗi 1 giờ</option>
                    <option value="1">Realtime (Webhook)</option>
                  </select>
                </div>
                <p className="text-[12px] text-gray-500 mt-1 px-[2px]">Khoảng thời gian giữa mỗi lần tự động đồng bộ tin nhắn</p>
              </div>

              {/* Lưu trữ file */}
              <div className="pt-2 pb-2">
                <label className="flex items-center gap-[10px] cursor-pointer">
                  <div className="relative flex items-center">
                    <input 
                      type="checkbox" 
                      className="sr-only"
                      checked={storeMedia}
                      onChange={(e) => setStoreMedia(e.target.checked)}
                    />
                    <div className={`block w-9 h-[20px] rounded-full transition-colors ${storeMedia ? 'bg-gray-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                    <div className={`absolute left-[2px] bg-white w-4 h-4 rounded-full shadow-sm transition-transform ${storeMedia ? 'translate-x-[16px]' : ''}`}></div>
                  </div>
                  <span className="text-[15px] text-gray-800 dark:text-gray-200">Lưu trữ file/ảnh từ cuộc chat</span>
                </label>
                <p className="text-[12px] text-gray-500 ml-[46px] mt-1 -mb-1">Tải và lưu file, ảnh từ cuộc chat lên server. Tăng dung lượng lưu trữ.</p>
              </div>

            </div>
          </div>

          <div className="flex justify-end gap-1 p-4 pb-5 bg-white dark:bg-gray-800 rounded-b-lg mr-2">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-[14px] text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition"
            >
              Hủy
            </button>
            <button 
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-[14px] text-blue-400 font-medium hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition"
            >
              {isLoading ? 'Đang xử lý...' : `Tạo & Xác thực qua ${platform === 'zalo' ? 'Zalo' : 'Facebook'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
