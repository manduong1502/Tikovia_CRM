import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Bot, Save, AlertTriangle, Info, CheckCircle, ShieldAlert } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';

export function AiTasks() {
  const { id: companyId } = useParams();
  const [isSaving, setIsSaving] = useState(false);
  const [aiConfig, setAiConfig] = useState<any>({});

  const [guidelines, setGuidelines] = useState({
    severe: '',
    improve: '',
    feedback: '',
    good: ''
  });

  useEffect(() => {
    if (!companyId) return;
    const fetchSettings = async () => {
      const { data } = await supabase.from('companies').select('ai_config').eq('id', companyId).single();
      if (data && data.ai_config) {
        setAiConfig(data.ai_config);
        if (data.ai_config.trainingGuideline) {
          setGuidelines(data.ai_config.trainingGuideline);
        }
      }
    };
    fetchSettings();
  }, [companyId]);

  const handleSave = async () => {
    if (!companyId) return;
    setIsSaving(true);
    try {
      const updatedConfig = {
        ...aiConfig,
        trainingGuideline: guidelines
      };
      const { error } = await supabase.from('companies').update({ ai_config: updatedConfig }).eq('id', companyId);
      if (error) throw error;
      alert('Đã lưu cấu hình huấn luyện AI thành công!');
    } catch (e: any) {
      alert('Lỗi lưu cấu hình: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Bot className="w-6 h-6 text-brand-blue" />
            Đào tạo Tác vụ AI (Custom Training)
          </h2>
          <p className="text-sm text-gray-500 mt-1">Tuỳ chỉnh tư duy chấm điểm dịch vụ khách hàng phù hợp với văn hoá của doanh nghiệp bạn.</p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={isSaving}
          className="gap-2 bg-brand-blue hover:bg-blue-700 text-white shadow-sm w-full sm:w-auto justify-center"
        >
          <Save className="w-4 h-4 flex-shrink-0" />
          <span className="whitespace-nowrap">{isSaving ? 'Đang lưu...' : 'Lưu bộ luật AI'}</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 max-w-4xl">
        <Card className="border-l-4 border-l-red-500 overflow-hidden">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4 text-red-600 dark:text-red-400">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="font-bold text-lg">Tiêu chí [Nghiêm trọng] (Đỏ)</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">Các trường hợp lỗi nặng, gây phật ý khách hàng hoặc vi phạm quy tắc cấm. AI sẽ gắn nhãn đỏ nếu phát hiện.</p>
            <textarea
              rows={4}
              placeholder="Ví dụ: Nhân viên không chịu báo giá, nói chuyện cụt lủn cộc lốc, trả treo với khách hàng, không dùng kính ngữ 'dạ/vâng'..."
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-red-100 dark:border-red-900/50 rounded-lg p-4 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-gray-900 dark:text-gray-100"
              value={guidelines.severe}
              onChange={(e) => setGuidelines({ ...guidelines, severe: e.target.value })}
            />
          </div>
        </Card>

        <Card className="border-l-4 border-l-orange-500 overflow-hidden">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4 text-orange-600 dark:text-orange-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-lg">Tiêu chí [Cần cải thiện] (Cam)</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">Các trường hợp nhân viên xử lý chưa tốt, lề mề, hời hợt khiến giảm tỷ lệ chốt đơn.</p>
            <textarea
              rows={4}
              placeholder="Ví dụ: Bỏ đói khách quá 5 phút mới rep, chỉ biết báo giá xong im lặng không dẫn dắt thêm, không chủ động xin số điện thoại..."
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-orange-100 dark:border-orange-900/50 rounded-lg p-4 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-gray-900 dark:text-gray-100"
              value={guidelines.improve}
              onChange={(e) => setGuidelines({ ...guidelines, improve: e.target.value })}
            />
          </div>
        </Card>

        <Card className="border-l-4 border-l-gray-400 overflow-hidden">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4 text-gray-600 dark:text-gray-400">
              <Info className="w-5 h-5" />
              <h3 className="font-bold text-lg">Tiêu chí [Góp ý] (Khuyên dùng thêm)</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">Các trường hợp tư vấn ở mức an toàn, quy chuẩn nhưng thiếu điểm nhấn, có thể làm mượt mà hơn.</p>
            <textarea
              rows={4}
              placeholder="Ví dụ: Trả lời đúng trọng tâm nhưng thiếu icon cảm xúc, quên gửi hình ảnh thực tế sản phẩm..."
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-sm focus:ring-2 focus:ring-gray-400/20 focus:border-gray-400 text-gray-900 dark:text-gray-100"
              value={guidelines.feedback}
              onChange={(e) => setGuidelines({ ...guidelines, feedback: e.target.value })}
            />
          </div>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 overflow-hidden">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="w-5 h-5" />
              <h3 className="font-bold text-lg">Tiêu chí [Tốt] (Xanh lục)</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">Các trường hợp xử lý xuất sắc, chuẩn quy trình, khách hàng tỏ ra hài lòng.</p>
            <textarea
              rows={4}
              placeholder="Ví dụ: Xin được số điện thoại thành công, xưng hô lễ phép, chốt được lịch hẹn, khách hàng phản hồi tích cực..."
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-emerald-100 dark:border-emerald-900/50 rounded-lg p-4 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-gray-900 dark:text-gray-100"
              value={guidelines.good}
              onChange={(e) => setGuidelines({ ...guidelines, good: e.target.value })}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
