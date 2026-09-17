import axios from 'axios';
import { supabase } from '../supabase.js';

let isRunning = false;

export async function evaluateAllPendingChats() {
  if (isRunning) return;
  isRunning = true;
  try {
    // 1. Fetch un-evaluated messages
    const { data: recentMessages, error: msgError } = await supabase
      .from('messages')
      .select('company_id, sender_id, created_at, ai_evaluation, is_from_bot')
      .is('ai_evaluation', null)
      .order('created_at', { ascending: false });

    if (msgError || !recentMessages || recentMessages.length === 0) {
      isRunning = false;
      return;
    }

    // 2. Group by sender_id to find the absolute latest message time and message participants
    const pendingChatsMap = new Map();
    for (const msg of recentMessages) {
      if (!pendingChatsMap.has(msg.sender_id)) {
        pendingChatsMap.set(msg.sender_id, {
          company_id: msg.company_id,
          sender_id: msg.sender_id,
          latest_time: new Date(msg.created_at).getTime(),
          hasCustomer: false,
          hasSale: false
        });
      }
      
      const chat = pendingChatsMap.get(msg.sender_id);
      if (msg.is_from_bot) chat.hasSale = true;
      else chat.hasCustomer = true;
    }

    const now = Date.now();
    const DELAY_MS = 15 * 1000; // 15 giây để test (mặc định 15 mins)

    // 3. Evaluate chats that have BOTH sides active and are idle
    for (const chat of pendingChatsMap.values()) {
       // Chỉ "Chốt xổ" khi 2 bên đều đã nhắn tin đáp trả nhau trong đợt này
       if (chat.hasCustomer && chat.hasSale) {
          if (now - chat.latest_time >= DELAY_MS) {
             await performEvaluation(chat.company_id, chat.sender_id);
          }
       }
    }
  } catch (e) {
    console.error("Auto Evaluator Crash:", e);
  } finally {
    isRunning = false;
  }
}

async function performEvaluation(company_id, sender_id) {
  try {
    const { data: company } = await supabase.from('companies').select('ai_config').eq('id', company_id).single();
    const config = company?.ai_config;
    if (!config || !config.apiKey) {
      return; 
    }

    const { data: messages } = await supabase.from('messages')
      .select('*')
      .eq('company_id', company_id)
      .eq('sender_id', sender_id)
      .order('created_at', { ascending: true })
      .limit(100); 
      
    if (!messages || messages.length === 0) return;

    const transcript = messages.map(m => {
      const role = m.is_from_bot ? `Sale(${m.staff_name || 'Bot'})` : `Khách`;
      return `${role}: ${m.message}`;
    }).join('\n');

    let customRules = "";
    if (config.trainingGuideline) {
      customRules = `\nDưới đây là tiêu chuẩn chấm điểm riêng của công ty này:
${config.trainingGuideline.severe ? `- Đánh giá [Nghiêm trọng] NẾU: ${config.trainingGuideline.severe}` : ''}
${config.trainingGuideline.improve ? `- Đánh giá [Cần cải thiện] NẾU: ${config.trainingGuideline.improve}` : ''}
${config.trainingGuideline.feedback ? `- Đánh giá [Góp ý] NẾU: ${config.trainingGuideline.feedback}` : ''}
${config.trainingGuideline.good ? `- Đánh giá [Tốt] NẾU: ${config.trainingGuideline.good}` : ''}
`;
    }

    const promptText = `Nhiệm vụ của bạn là nhận xét đoạn hội thoại 1 dịch vụ khách hàng.
YÊU CẦU BẮT BUỘC: Bạn PHẢI MỞ ĐẦU phần trả lời bằng chính xác 1 trong 4 nhãn sau tùy thuộc vào chất lượng tư vấn của nhân viên (bao gồm dấu ngoặc vuông luôn):
- [Nghiêm trọng] (nếu chửi bới, làm phật ý khách, không chào hỏi, v.v.)
- [Cần cải thiện] (nếu chậm trễ, hời hợt, chưa nhiệt tình)
- [Góp ý] (nếu bình thường, còn có thể làm tốt hơn)
- [Tốt] (nếu tư vấn chuẩn xác, nhiệt tình)
${customRules}
Tiếp theo sau nhãn đó là 1 đoạn văn (khoảng 3-4 câu) nhận xét ngắn gọn thái độ và kỹ năng của Sale.

ĐOẠN CHAT:
${transcript}`;

    let aiResult = "AI chưa thể phân tích thành công.";

    if (config.provider === 'openai' || config.provider === 'gemini') {
      const apiUrl = config.useCustomUrl && config.baseUrl ? config.baseUrl : 'https://api.openai.com/v1/chat/completions';
      const openaiRes = await axios.post(apiUrl, {
        model: config.model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: promptText }]
      }, {
        headers: { 'Authorization': `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' }
      });
      aiResult = openaiRes.data.choices[0].message.content;
    } else if (config.provider === 'claude') {
      const apiUrl = config.useCustomUrl && config.baseUrl ? config.baseUrl : 'https://api.anthropic.com/v1/messages';
      const claudeRes = await axios.post(apiUrl, {
        model: config.model || 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        messages: [{ role: 'user', content: promptText }]
      }, {
        headers: {
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      });
      aiResult = claudeRes.data.content[0].text;
    }

    // Ghi kết quả ngược lại Database cho TẤT CẢ các tin nhắn của hội thoại này 
    // Từ giờ trở đi hội thoại này không còn bị quét (ai_evaluation IS NOT NULL)
    await supabase.from('messages')
      .update({ ai_evaluation: aiResult })
      .eq('sender_id', sender_id)
      .eq('company_id', company_id);

    console.log(`[CQA Tự động] Đã đánh giá thành công hội thoại: ${sender_id}`);
  } catch (e) {
    console.error(`[CQA Lỗi] Không thể đánh giá ${sender_id}:`, e.response?.data || e.message);
  }
}

export function startAutoEvaluator() {
  console.log("Starting Auto AI Evaluator... (Checking every 1 minute for 15-minute idle chats)");
  // Chạy background quét mỗi 1 phút
  setInterval(evaluateAllPendingChats, 60 * 1000);
}
