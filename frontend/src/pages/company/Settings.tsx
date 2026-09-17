import React, { useState, useEffect } from 'react';
import { Bot, Save, Key, CheckCircle2, Lock, Activity, AlertCircle, Settings as SettingsIcon, BarChart3, Link } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { cn } from '../../components/ui/Card';
import { useAuth } from '../../contexts/AuthContext';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const claudeModels = [
  { title: 'Claude Sonnet 4.6 (Khuyên dùng)', value: 'claude-sonnet-4-6' },
  { title: 'Claude Haiku 4.5 (Nhanh & Rẻ)', value: 'claude-haiku-4-5' },
  { title: 'Claude Opus 4 (Mạnh nhất)', value: 'claude-opus-4' },
];

const geminiModels = [
  { title: 'Gemini 2.0 Flash (Nhanh & Rẻ)', value: 'gemini-2.0-flash' },
  { title: 'Gemini 2.5 Pro (Tốt nhất)', value: 'gemini-2.5-pro' },
];

const openaiModels = [
  { title: 'GPT-4o (Khuyên dùng)', value: 'gpt-4o' },
  { title: 'GPT-4o Mini (Nhanh & Rẻ)', value: 'gpt-4o-mini' },
];

export function Settings() {
  const { user } = useAuth();
  const { id: companyId } = useParams();
  const role = user?.role || 'sale';
  const [activeTab, setActiveTab] = useState<'ai' | 'analysis' | 'general'>('ai');
  
  // AI Settings
  const [provider, setProvider] = useState<'openai' | 'claude' | 'gemini'>('claude');
  const [model, setModel] = useState('claude-sonnet-4-6');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [useCustomUrl, setUseCustomUrl] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  
  // Analysis Settings
  const [batchMode, setBatchMode] = useState(true);
  const [batchSize, setBatchSize] = useState('5');
  
  const [isSaving, setIsSaving] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    if (provider === 'claude' && !hasInitialized) setModel('claude-sonnet-4-6');
    else if (provider === 'gemini' && !hasInitialized) setModel('gemini-2.0-flash');
    else if (provider === 'openai' && !hasInitialized) setModel('gpt-4o');
  }, [provider, hasInitialized]);

  useEffect(() => {
    if (!companyId) return;
    const fetchSettings = async () => {
      const { data } = await supabase.from('companies').select('ai_config').eq('id', companyId).single();
      if (data && data.ai_config) {
        const config = data.ai_config;
        if (config.provider) setProvider(config.provider);
        if (config.model) setModel(config.model);
        if (config.apiKey) setApiKey(config.apiKey);
        if (config.useCustomUrl) setUseCustomUrl(config.useCustomUrl);
        if (config.baseUrl) setBaseUrl(config.baseUrl);
        if (config.batchMode !== undefined) setBatchMode(config.batchMode);
        if (config.batchSize) setBatchSize(config.batchSize);
      }
      setHasInitialized(true);
    };
    fetchSettings();
  }, [companyId]);

  const handleSave = async () => {
    if (!companyId) return;
    setIsSaving(true);
    
    const configToSave = {
      provider,
      model,
      apiKey,
      useCustomUrl,
      baseUrl,
      batchMode,
      batchSize
    };

    try {
      await supabase.from('companies').update({ ai_config: configToSave }).eq('id', companyId);
      alert('Đã lưu cấu hình thành công!');
    } catch (err: any) {
      alert('Lỗi lưu cấu hình: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const getModelOptions = () => {
    if (provider === 'claude') return claudeModels;
    if (provider === 'gemini') return geminiModels;
    return openaiModels;
  };

  const renderTabs = () => (
    <div className="flex flex-col gap-2 w-full md:w-[260px] flex-shrink-0">
      <button 
        onClick={() => setActiveTab('ai')}
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors text-left border",
          activeTab === 'ai' ? "bg-brand-blue text-white border-blue-600 shadow-md shadow-blue-500/20" : "text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 border-transparent dark:border-gray-800"
        )}
      >
        <Bot className={cn("w-5 h-5", activeTab === 'ai' ? "text-white" : "text-gray-400")} />
        Cấu hình AI
      </button>
      <button 
        onClick={() => setActiveTab('analysis')}
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors text-left border",
          activeTab === 'analysis' ? "bg-brand-blue text-white border-blue-600 shadow-md shadow-blue-500/20" : "text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 border-transparent dark:border-gray-800"
        )}
      >
        <BarChart3 className={cn("w-5 h-5", activeTab === 'analysis' ? "text-white" : "text-gray-400")} />
        Phân tích & Đánh giá
      </button>
      <button 
        onClick={() => setActiveTab('general')}
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors text-left border",
          activeTab === 'general' ? "bg-brand-blue text-white border-blue-600 shadow-md shadow-blue-500/20" : "text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 border-transparent dark:border-gray-800"
        )}
      >
        <SettingsIcon className={cn("w-5 h-5", activeTab === 'general' ? "text-white" : "text-gray-400")} />
        Cài đặt chung
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <SettingsIcon className="w-6 h-6 text-brand-blue" /> 
            Cài đặt Hệ thống
          </h2>
          <p className="text-sm text-gray-500 mt-1">Cấu hình kết nối AI, phân tích Sale và thiết lập dự án</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        {renderTabs()}

        <Card className="flex-1 w-full bg-white dark:bg-gray-900 p-0 overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800 min-h-[500px]">
          
          {/* Tab 1: AI Config */}
          {activeTab === 'ai' && (
            <div className="p-8 animate-in fade-in duration-300">
              <h3 className="font-bold text-xl text-gray-900 dark:text-white mb-8 flex items-center gap-3">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  <Bot className="w-5 h-5 text-brand-blue" /> 
                </div>
                Cấu hình mô hình Trí Tuệ Nhân Tạo
              </h3>

              {role !== 'admin' ? (
                <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 p-10 text-center mx-auto max-w-lg mt-8">
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-8 h-8 text-red-500 dark:text-red-400" />
                  </div>
                  <h4 className="text-red-800 dark:text-red-400 font-bold text-lg mb-2">Yêu cầu quyền Quản trị viên</h4>
                  <p className="text-sm text-red-600 dark:text-red-300 leading-relaxed">Tính năng cấu hình kết nối API của trí tuệ nhân tạo có chứa dữ liệu nhạy cảm. Chỉ có người dùng với vai trò <strong>Admin</strong> mới có quyền xem và chỉnh sửa thông số này.</p>
                </div>
              ) : (
                <div className="space-y-6 max-w-2xl">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Nhà cung cấp AI (Provider)</label>
                    <select 
                      value={provider}
                      onChange={(e) => setProvider(e.target.value as any)}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 text-[15px] focus:border-brand-blue focus:ring-1 focus:ring-brand-blue text-gray-900 dark:text-white cursor-pointer transition-colors"
                      style={{ backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1em' }}
                    >
                      <option value="claude">Claude (Anthropic)</option>
                      <option value="gemini">Gemini (Google)</option>
                      <option value="openai">ChatGPT (OpenAI)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Model AI</label>
                    <select 
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 text-[15px] focus:border-brand-blue focus:ring-1 focus:ring-brand-blue text-gray-900 dark:text-white cursor-pointer transition-colors"
                      style={{ backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1em' }}
                    >
                      {getModelOptions().map(m => (
                        <option key={m.value} value={m.value}>{m.title}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Secret API Key</label>
                    <div className="relative">
                      <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        type={showKey ? "text" : "password"} 
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Nhập API Key của nhà cung cấp bạn chọn" 
                        className="w-full pl-10 pr-16 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[15px] focus:border-brand-blue focus:ring-1 focus:ring-brand-blue text-gray-900 dark:text-white placeholder-gray-400"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 hover:text-brand-blue font-medium bg-white dark:bg-gray-800 px-2 py-1 rounded-md shadow-sm border border-gray-100 dark:border-gray-700"
                      >
                        {showKey ? 'Ẩn' : 'Hiện'}
                      </button>
                    </div>
                  </div>

                  <div className="bg-gray-50/50 dark:bg-gray-800/30 p-4 rounded-xl border border-gray-100 dark:border-gray-800 mt-2">
                    <label className="flex items-center gap-3 cursor-pointer mb-1 w-max">
                      <div className="relative flex items-center">
                        <input 
                          type="checkbox" 
                          className="sr-only"
                          checked={useCustomUrl}
                          onChange={(e) => setUseCustomUrl(e.target.checked)}
                        />
                        <div className={`block w-9 h-[22px] rounded-full transition-colors ${useCustomUrl ? 'bg-brand-blue' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                        <div className={`absolute left-0.5 bg-white w-4 h-4 rounded-full shadow-sm transition-transform ${useCustomUrl ? 'translate-x-4' : ''}`}></div>
                      </div>
                      <span className="text-[14px] font-semibold text-gray-900 dark:text-white">Tùy chỉnh API Base URL</span>
                    </label>
                    <p className="text-[12px] text-gray-500 ml-[46px] mb-4">Mở nút này khi bạn muốn định tuyến proxy API qua OpenRouter, mạng LiteLLM nội bộ, hoặc máy chủ self-hosted riêng</p>

                    {useCustomUrl && (
                      <div className="ml-[46px] animate-in fade-in zoom-in-95 duration-200">
                        <input 
                          type="text" 
                          value={baseUrl}
                          onChange={(e) => setBaseUrl(e.target.value)}
                          placeholder={provider === 'claude' ? 'https://api.anthropic.com' : 'https://api.openai.com/v1'} 
                          className="w-full py-2.5 px-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:border-brand-blue focus:ring-1 focus:ring-brand-blue text-gray-900 dark:text-white shadow-sm placeholder-gray-300"
                        />
                      </div>
                    )}
                  </div>

                  <div className="pt-6 mt-4 border-t border-gray-100 dark:border-gray-800 flex gap-3">
                    <Button onClick={handleSave} disabled={isSaving} className="bg-brand-blue hover:bg-blue-700 text-white px-8 py-2.5 h-auto text-[15px]">
                      {isSaving ? 'Đang lưu...' : 'Lưu cấu hình AI'}
                    </Button>
                    <Button variant="outline" className="border-gray-200 dark:border-gray-700 px-6 py-2.5 h-auto text-[15px] font-medium text-gray-700 hover:bg-gray-50">
                      Kiểm tra API Key
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Analysis Settings */}
          {activeTab === 'analysis' && (
             <div className="p-8 animate-in fade-in duration-300">
              <h3 className="font-bold text-xl text-gray-900 dark:text-white mb-8 flex items-center gap-3">
                <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                Cài đặt Phân tích & Đánh giá chất lượng Chat
              </h3>

              {role !== 'admin' ? (
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 p-10 text-center mx-auto max-w-lg mt-8">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                  </div>
                  <h4 className="text-gray-900 dark:text-white font-bold text-lg mb-2">Dành cho Quản trị viên</h4>
                  <p className="text-sm text-gray-500 leading-relaxed">Bộ tính năng thiết lập chiến lược đánh giá cuộc chat bị khóa với nhân sự nhằm đảm bảo kết quả phân tích chất lượng nhân viên luôn được hiển thị khách quan độc lập nhất.</p>
                </div>
              ) : (
                <div className="space-y-6 max-w-2xl">
                  <div className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 rounded-xl p-5 mb-6">
                    <h4 className="font-bold text-green-700 dark:text-green-500 mb-2 flex items-center gap-2">Chế độ Batch (Tối ưu tiết kiệm Token)</h4>
                    <p className="text-[14px] text-green-800/80 dark:text-green-400/80 leading-relaxed">
                      Chế độ này gom nhóm nhiều cuộc chat vào chung 1 lần gọi API với AI (Ví dụ 5 chat = 1 thẻ prompt). Tính năng này được khuyên dùng để tiết kiệm tối đa lên đến <strong>60-80% chi phí</strong> hóa đơn AI hàng tháng so với việc chạy phân tích theo từng dòng tin.
                    </p>
                  </div>

                  <div className="pb-4">
                    <label className="flex items-center gap-3 cursor-pointer w-max">
                      <div className="relative flex items-center">
                        <input 
                          type="checkbox" 
                          className="sr-only"
                          checked={batchMode}
                          onChange={(e) => setBatchMode(e.target.checked)}
                        />
                        <div className={`block w-11 h-[24px] rounded-full transition-colors ${batchMode ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                        <div className={`absolute left-0.5 bg-white w-5 h-5 rounded-full shadow-sm transition-transform ${batchMode ? 'translate-x-[20px]' : ''}`}></div>
                      </div>
                      <span className="font-semibold text-gray-900 dark:text-white text-[16px]">Bật Gom lệnh (Batch Mode)</span>
                    </label>
                  </div>

                  {batchMode && (
                    <div className="animate-in slide-in-from-top-4 fade-in duration-300 ml-[56px] p-5 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-800 relative">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-400 rounded-l-xl"></div>
                      <label className="block text-[14px] font-semibold text-gray-700 dark:text-gray-300 mb-2">Số cuộc chat trên 1 lô xử lý (Batch Size)</label>
                      <select 
                        value={batchSize}
                        onChange={(e) => setBatchSize(e.target.value)}
                        className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 text-[14px] focus:border-green-500 focus:ring-1 focus:ring-green-500 text-gray-900 dark:text-white cursor-pointer shadow-sm"
                        style={{ backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1em' }}
                      >
                        <option value="3">Gộp 3 cuộc thoại (~40% tiết kiệm chi phí)</option>
                        <option value="5">Gộp 5 cuộc thoại (~60% tiết kiệm chi phí - Khuyên dùng)</option>
                        <option value="10">Gộp 10 cuộc thoại (~75% tiết kiệm chi phí)</option>
                        <option value="20">Gộp 20 cuộc thoại (~80% tiết kiệm - Dễ rủi ro Timeout)</option>
                      </select>
                      <p className="text-[13px] text-gray-500 mt-3 flex items-start gap-1.5">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 text-orange-400" />
                        Nếu Batch size quá lớn mà API mạng AI gặp lỗi chập chờn sẽ khiến kết quả của nhiều cuộc thoại cùng bị hủy. Chỉ nên duy trì ngưỡng 5-10 cuộc mỗi đợt.
                      </p>
                    </div>
                  )}

                  <div className="pt-8 mt-6 border-t border-gray-100 dark:border-gray-800">
                    <Button onClick={handleSave} disabled={isSaving} className="bg-brand-blue hover:bg-blue-700 text-white px-8 py-2.5 h-auto text-[15px]">
                      {isSaving ? 'Đang lưu...' : 'Lưu cấu hình Phân tích & Report'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: General Settings */}
          {activeTab === 'general' && (
            <div className="p-8 animate-in fade-in duration-300">
              <h3 className="font-bold text-xl text-gray-900 dark:text-white mb-8 flex items-center gap-3">
                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <SettingsIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                </div>
                Cài đặt Dự án Chung
              </h3>

              <div className="space-y-6 max-w-2xl">
                <div>
                  <label className="block text-[14px] font-semibold text-gray-700 dark:text-gray-300 mb-2">Tên dự án / Công ty</label>
                  <input type="text" defaultValue="Công ty Dược phẩm Tâm An" className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 text-[15px] focus:border-brand-blue focus:ring-1 focus:ring-brand-blue text-gray-900 dark:text-white shadow-sm" />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[14px] font-semibold text-gray-700 dark:text-gray-300 mb-2">Múi giờ máy chủ</label>
                    <select className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 text-[15px] focus:border-brand-blue text-gray-900 dark:text-white appearance-none cursor-pointer shadow-sm">
                      <option>Asia/Ho_Chi_Minh</option>
                      <option>UTC+0 (London Quốc tế)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[14px] font-semibold text-gray-700 dark:text-gray-300 mb-2">Dấu vân ngôn ngữ AI (Report)</label>
                    <select className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 text-[15px] focus:border-brand-blue text-gray-900 dark:text-white appearance-none cursor-pointer shadow-sm">
                      <option>Trả lời bằng Tiếng Việt</option>
                      <option>Trả lời bằng Tiếng Anh (English)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[14px] font-semibold text-gray-700 dark:text-gray-300 mb-2">Tỷ giá quy đổi Token (Để ước tính hóa đơn)</label>
                  <div className="flex bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm focus-within:ring-1 focus-within:ring-brand-blue focus-within:border-brand-blue overflow-hidden">
                    <span className="flex items-center justify-center bg-gray-50 dark:bg-gray-800/50 px-4 text-gray-500 text-sm font-medium border-r border-gray-200 dark:border-gray-700">1 USD =</span>
                    <input type="number" defaultValue="25500" className="w-full px-4 py-3 bg-transparent border-none focus:ring-0 text-[15px] text-gray-900 dark:text-white" />
                    <span className="flex items-center justify-center px-4 text-gray-500 font-medium">VNĐ</span>
                  </div>
                </div>

                <div className="pt-8 mt-6 border-t border-gray-100 dark:border-gray-800">
                  <Button onClick={handleSave} disabled={isSaving} className="bg-gray-800 hover:bg-gray-900 dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900 text-white px-8 py-2.5 h-auto text-[15px]">
                    Lưu cài đặt thông số chung
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
