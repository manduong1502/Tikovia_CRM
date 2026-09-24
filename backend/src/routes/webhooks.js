import { Router } from 'express';
import { supabase } from '../supabase.js';
import axios from 'axios';

const router = Router();

// Lấy Token Zalo hợp lệ (Tự động Refresh nếu hết hạn)
async function getValidZaloToken(channelData) {
  const auth = channelData.auth_data || {};
  if (!auth.access_token || !auth.refresh_token) return null;

  if (Date.now() >= (auth.token_expires_at || 0)) {
    console.log("Refreshing Zalo token for channel", channelData.id);
    try {
      const resp = await axios.post('https://oauth.zaloapp.com/v4/oa/access_token', new URLSearchParams({
        app_id: auth.appId,
        grant_type: 'refresh_token',
        refresh_token: auth.refresh_token
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'secret_key': auth.secretKey
        }
      });
      const tokenData = resp.data;
      if (tokenData.access_token) {
        auth.access_token = tokenData.access_token;
        auth.refresh_token = tokenData.refresh_token;
        auth.token_expires_at = Date.now() + (parseInt(tokenData.expires_in || 90000) * 1000) - 300000;
        await supabase.from('channels').update({ auth_data: auth }).eq('id', channelData.id);
        return auth.access_token;
      }
      console.error("Failed to refresh Zalo token", tokenData);
      return null;
    } catch (e) {
      console.error("Zalo refresh error", e);
      return null;
    }
  }
  return auth.access_token;
}

// Zalo Webhook - Verify and Receive Messages
router.post('/zalo', async (req, res) => {
  try {
    const payload = req.body;
    console.log('Zalo Webhook Payload:', JSON.stringify(payload));

    // Handle generic message events
    if (payload.event_name === 'user_send_text') {
      // 1. Get channel ID mapping by matching app_id in auth_data
      const { data: channelData } = await supabase
        .from('channels')
        .select('id, company_id, page_id, auth_data')
        .eq('provider', 'zalo')
        .contains('auth_data', { appId: payload.app_id })
        .single();

      // 2. Insert Message
      if (channelData) {
        // Auto-heal the correct OA ID (page_id) if it was pending
        if (channelData.page_id !== payload.recipient.id) {
          await supabase.from('channels').update({ page_id: payload.recipient.id }).eq('id', channelData.id);
        }

        let sender_name = "Khách hàng " + payload.sender.id.slice(-4);
        let sender_avatar = null;

        try {
          const accessToken = await getValidZaloToken(channelData);
          if (accessToken) {
            const profileRes = await axios.get(
              `https://openapi.zalo.me/v3.0/oa/user/detail?data=${encodeURIComponent(JSON.stringify({ user_id: payload.sender.id }))}`,
              { headers: { 'access_token': accessToken } }
            );
            const profileBody = profileRes.data;
            if (profileBody.data) {
              if (profileBody.data.display_name) sender_name = profileBody.data.display_name;
              if (profileBody.data.avatar) sender_avatar = profileBody.data.avatar;
            }
          }
        } catch (e) { console.warn("Zalo Profile Error", e); }

        await supabase.from('messages').insert({
          company_id: channelData.company_id,
          channel_id: channelData.id,
          conversation_id: payload.sender.id,
          sender_id: payload.sender.id,
          sender_name: sender_name,
          sender_avatar: sender_avatar,
          message: payload.message.text,
          source: 'zalo',
          is_from_bot: false,
          created_at: new Date().toISOString()
        });

        // ==========================================
        // WEBHOOK GATEWAY -> N8N
        // ==========================================
        // Chỉ chặn Bot nếu nhân viên được gán trực tiếp gần đây (trong vòng 15 phút)
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        const { data: latestMsgs } = await supabase.from('messages')
          .select('assigned_staff_name')
          .eq('company_id', channelData.company_id)
          .eq('sender_id', payload.sender.id)
          .not('assigned_staff_name', 'is', null)
          .gte('created_at', fifteenMinutesAgo)
          .order('created_at', { ascending: false })
          .limit(1);

        const isAssigned = latestMsgs && latestMsgs.length > 0 && latestMsgs[0].assigned_staff_name;

        if (!isAssigned) {
          const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
          if (n8nWebhookUrl) {
            let sheetUrl = channelData.auth_data?.chatbot_sheet_url || '';
            let companyName = '';
            try {
              const { data: comp } = await supabase.from('companies').select('name, ai_config').eq('id', channelData.company_id).maybeSingle();
              if (comp) {
                companyName = comp.name || '';
                sheetUrl = sheetUrl || comp.ai_config?.chatbot_sheet_url || '';
              }
            } catch (cErr) {}

            const sheetId = (sheetUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || [])[1] || sheetUrl;

            axios.post(n8nWebhookUrl, {
              company_id: channelData.company_id,
              company_name: companyName,
              channel_id: channelData.id,
              sender_id: payload.sender.id,
              sender_name: sender_name,
              message: payload.message.text,
              source: 'zalo',
              chatbot_sheet_url: sheetUrl,
              chatbot_sheet_id: sheetId
            }).catch(e => console.warn('N8N Forward Error (Zalo):', e.message));
          }
        }
        // ==========================================
      }
    }

    // Zalo expects HTTP 200 response
    res.status(200).send('Event received');
  } catch (error) {
    console.error('Error in Zalo Webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/facebook', (req, res) => {
  // Facebook webhook verification
  const verifyToken = process.env.FB_VERIFY_TOKEN;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === verifyToken) {
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

router.post('/facebook', async (req, res) => {
  try {
    const payload = req.body;
    console.log('Facebook Webhook Payload:', JSON.stringify(payload));

    // Assuming page messaging
    if (payload.object === 'page') {
      // DEBUG: Log everything from page wrapper
      const debugPayload = {
        company_id: '31965301-ae96-4acc-bcd8-ee3207434bce',
        channel_id: '8417cce6-f0c5-4e5d-addf-bfc9eceeb67f',
        conversation_id: 'DEBUG_RAW',
        sender_id: 'DEBUG_RAW',
        message: "RAW PAYLOAD: " + JSON.stringify(payload).substring(0, 1500),
        source: 'facebook',
        is_from_bot: true
      };
      const { error: dbErr } = await supabase.from('messages').insert(debugPayload);
      if (dbErr) console.warn("DEBUG log error", dbErr);

      for (const entry of payload.entry) {
        for (const webhookEvent of entry.messaging) {
          if (!webhookEvent.message || !webhookEvent.message.text) continue;

          console.log('FB Webhook Message:', webhookEvent.message.text);

          const isEcho = webhookEvent.message.is_echo === true;
          const customerId = isEcho ? webhookEvent.recipient.id : webhookEvent.sender.id;
          const targetPageId = isEcho ? webhookEvent.sender.id : webhookEvent.recipient.id;

          const { data: channelData } = await supabase
            .from('channels')
            .select('id, company_id, auth_data')
            .eq('provider', 'facebook')
            .eq('page_id', targetPageId)
            .single();

          if (!channelData) {
            const debugNoPage = {
              company_id: '31965301-ae96-4acc-bcd8-ee3207434bce',
              conversation_id: customerId,
              sender_id: customerId,
              message: "DEBUG: PageID Not Found: " + targetPageId + " | Expected one of: 11059697198653463 | Payload: " + JSON.stringify(webhookEvent)
            };
            await supabase.from('messages').insert(debugNoPage);
          }

          if (channelData) {
            let sender_name = isEcho ? "Fanpage" : ("Khách hàng " + customerId.slice(-4));
            let sender_avatar = null;

            if (!isEcho) {
              try {
                const pageToken = channelData.auth_data?.page_token || channelData.auth_data?.secretKey;
                if (pageToken) {
                  const profileRes = await axios.get(`https://graph.facebook.com/${customerId}?fields=name,first_name,last_name,profile_pic&access_token=${pageToken}`);
                  const profile = profileRes.data;
                  if (profile && (profile.first_name || profile.last_name)) {
                    sender_name = `${profile.last_name || ''} ${profile.first_name || ''}`.trim();
                  } else if (profile && profile.name) {
                    sender_name = profile.name;
                  }
                  if (profile && profile.profile_pic) {
                    sender_avatar = profile.profile_pic;
                  }
                }
              } catch (e) { console.warn("FB Profile Error", e.message); }
            } else {
              // Deduplication logic: If we just inserted this message via the Tikovia Hub within the last 15 seconds, ignore this echo.
              const timeThreshold = new Date(Date.now() - 15000).toISOString();
              const textToMatch = webhookEvent.message.text.trim();

              const { data: recentMsgs } = await supabase.from('messages')
                .select('id, message')
                .eq('company_id', channelData.company_id)
                .eq('sender_id', customerId)
                .eq('is_from_bot', true)
                .gte('created_at', timeThreshold)
                .order('created_at', { ascending: false })
                .limit(5);

              if (recentMsgs && recentMsgs.find(m => m.message && m.message.trim() === textToMatch)) {
                console.log("Ignored FB webhooks echo because it was recently sent via Hub");
                continue; // SKIP insertion
              }
            }

            await supabase.from('messages').insert({
              company_id: channelData.company_id,
              channel_id: channelData.id,
              conversation_id: customerId,
              sender_id: customerId,
              sender_name: sender_name,
              sender_avatar: sender_avatar,
              message: webhookEvent.message.text,
              source: 'facebook',
              is_from_bot: isEcho,
              staff_name: isEcho ? 'Admin Fanpage' : null,
              created_at: new Date(webhookEvent.timestamp || Date.now()).toISOString()
            });

            // Removed Facebook Gateway per user request

            // Ghi log để phân tích cái Payload bị lỗi thiếu text hay gì
            if (isEcho && webhookEvent.message.text.includes('debug')) {
              await supabase.from('messages').insert({
                company_id: channelData.company_id,
                channel_id: channelData.id,
                conversation_id: customerId,
                sender_id: customerId,
                message: "DEBUG PAYLOAD: " + JSON.stringify(webhookEvent),
                source: 'facebook',
                is_from_bot: true
              });
            }
          }
        }
      }
      res.status(200).send('EVENT_RECEIVED');
    } else {
      res.sendStatus(404);
    }
  } catch (error) {
    console.error('Error in Facebook Webhook:', error);
    res.status(500).send('Oops');
  }
});

router.post('/evaluate_chat', async (req, res) => {
  try {
    const { company_id, sender_id } = req.body;
    if (!company_id || !sender_id) return res.status(400).json({ error: "Missing parameters" });

    // 1. Lấy thông tin AI config
    const { data: company } = await supabase.from('companies').select('ai_config').eq('id', company_id).single();
    const config = company?.ai_config;
    if (!config || !config.apiKey) return res.status(400).json({ error: "Chưa cấu hình API Key ở mục Cài đặt" });

    // 2. Lấy dữ liệu đoạn chat
    const { data: messages } = await supabase.from('messages')
      .select('*')
      .eq('company_id', company_id)
      .eq('sender_id', sender_id)
      .order('created_at', { ascending: true })
      .limit(50);

    if (!messages || messages.length === 0) return res.status(400).json({ error: "Đoạn chat trống" });

    // 3. Chuẩn bị transcript
    const transcript = messages.map(m => {
      const role = m.is_from_bot ? `Sale(${m.staff_name || 'Bot'})` : `Khách`;
      return `${role}: ${m.message}`;
    }).join('\n');

    const promptText = `Hãy đóng vai một chuyên gia kiểm định chất lượng (QA) dịch vụ khách hàng.
Dưới đây là một cuộc hội thoại giữa Nhân viên Sale và Khách hàng. Nhiệm vụ của bạn là nhận xét ngắn gọn (khoảng 3-4 câu) về thái độ, kỹ năng tư vấn của Sale, và khách hàng có nhu cầu chốt sale cao hay thấp.

ĐOẠN CHAT:
${transcript}

Nhận xét của bạn:`;

    let aiResult = "AI chưa thể phân tích thành công.";

    // 4. Gọi API AI
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

    // 5. Lưu kết quả vào Data cho TẤT CẢ message của id này để UI tự bắt được
    await supabase.from('messages')
      .update({ ai_evaluation: aiResult })
      .eq('sender_id', sender_id)
      .eq('company_id', company_id);

    res.json({ success: true, ai_evaluation: aiResult });
  } catch (e) {
    console.error("Evaluate Chat Error:", e.response?.data || e.message);
    res.status(500).json({ error: e.message || "Failed to process AI" });
  }
});

router.post('/send', async (req, res) => {
  try {
    const { company_id, channel_id, sender_id, message, source, staff_name, attachment_url, save_to_db } = req.body;
    if (!channel_id || !sender_id) return res.status(400).json({ error: "Missing parameters" });

    // 1. Get channel token
    const { data: channelData } = await supabase.from('channels')
      .select('auth_data, access_token')
      .eq('id', channel_id)
      .single();

    if (!channelData) return res.status(404).json({ error: "Channel not found" });

    // 2. Tùy chọn lưu xuống DB (dành cho bot qua n8n gọi vào)
    if (save_to_db) {
      // Find conversation_id from last message
      const { data: lastMsg } = await supabase.from('messages')
        .select('conversation_id').eq('sender_id', sender_id).limit(1);

      const conv_id = lastMsg && lastMsg.length > 0 ? lastMsg[0].conversation_id : sender_id;

      let msgText = message || "";
      if (attachment_url) {
        msgText += msgText ? `\n[Ảnh: ${attachment_url}]` : `[Ảnh đính kèm: ${attachment_url}]`;
      }

      await supabase.from('messages').insert({
        company_id,
        channel_id,
        conversation_id: conv_id,
        sender_id,
        message: msgText,
        source,
        is_from_bot: true,
        staff_name: staff_name || 'AI Bot',
        sender_name: staff_name || 'AI Bot'
      });
    }

    if (source === 'facebook') {
      const pageToken = channelData.auth_data?.page_token || channelData.auth_data?.secretKey;
      if (!pageToken) return res.status(401).json({ error: "No Fanpage Access Token configured" });

      // FB Payload Builder
      let fbMessagePayload = {};
      if (message) fbMessagePayload.text = message;
      if (attachment_url) {
        fbMessagePayload.attachment = {
          type: "image",
          payload: { url: attachment_url, is_reusable: false }
        };
      }

      // Send to FB Graph API
      await axios.post(
        `https://graph.facebook.com/v21.0/me/messages?access_token=${pageToken}`,
        {
          recipient: { id: sender_id },
          message: fbMessagePayload,
          messaging_type: "RESPONSE"
        }
      );

      res.json({ success: true });
    } else if (source === 'zalo') {
      const zaloToken = channelData.access_token || channelData.auth_data?.access_token || channelData.auth_data?.code || channelData.auth_data?.page_token || channelData.auth_data?.secretKey;
      if (!zaloToken) return res.status(401).json({ error: "No Zalo Access Token configured" });

      // Zalo Payload Builder
      let zaloMessagePayload = {};
      if (message) zaloMessagePayload.text = message;

      if (attachment_url) {
        try {
          // Convert Google Drive view URL to direct download URL
          let downloadUrl = attachment_url;
          const driveMatch = attachment_url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
          if (driveMatch && driveMatch[1]) {
            downloadUrl = `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
          }

          // 1. Download image to server memory first
          const imageResponse = await axios.get(downloadUrl, { responseType: 'arraybuffer', timeout: 10000 });

          // Determine content type dynamically
          const contentType = imageResponse.headers['content-type'] || 'image/jpeg';
          let ext = 'jpeg';
          if (contentType.includes('png')) ext = 'png';
          else if (contentType.includes('gif')) ext = 'gif';
          else if (contentType.includes('webp')) ext = 'webp';

          // 2. Build raw Multipart form data payload to upload to Zalo
          const boundary = '----TikoviaMagicBoundary12345';
          const data = Buffer.concat([
            Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="image.${ext}"\r\nContent-Type: ${contentType}\r\n\r\n`),
            imageResponse.data,
            Buffer.from(`\r\n--${boundary}--\r\n`)
          ]);

          // 3. Upload to Zalo to get attachment_id (Bypasses Zalo URL bugs completely)
          const uploadRes = await axios.post('https://openapi.zalo.me/v2.0/oa/upload/image', data, {
            headers: {
              'Content-Type': `multipart/form-data; boundary=${boundary}`,
              'access_token': zaloToken
            }
          });

          if (uploadRes.data && uploadRes.data.data && uploadRes.data.data.attachment_id) {
            zaloMessagePayload.attachment = {
              type: "template",
              payload: {
                template_type: "media",
                elements: [{ media_type: "image", attachment_id: uploadRes.data.data.attachment_id }]
              }
            };
          } else {
            throw new Error("Upload API failed: " + JSON.stringify(uploadRes.data));
          }
        } catch (err) {
          console.warn("Zalo Hard-Upload Error, falling back to basic link:", err.message);
          // 4. Ultimate Fallback to text url
          zaloMessagePayload.text = (zaloMessagePayload.text ? zaloMessagePayload.text + "\n\n" : "") + "[Link ảnh đính kèm]: " + attachment_url;
        }
      }

      // Send to Zalo OA API
      const zaloResponse = await axios.post(
        'https://openapi.zalo.me/v3.0/oa/message/cs',
        {
          recipient: { user_id: sender_id },
          message: zaloMessagePayload
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'access_token': zaloToken
          }
        }
      );

      // Nếu API Zalo trả về lỗi nội bộ (nhưng HTTP vẫn 200), chữa cháy bằng text link
      if (attachment_url && zaloResponse.data && zaloResponse.data.error && zaloResponse.data.error !== 0) {
        console.warn("Zalo rejected final image payload. Error:", zaloResponse.data);
        await axios.post(
          'https://openapi.zalo.me/v3.0/oa/message/cs',
          {
            recipient: { user_id: sender_id },
            message: { text: (message ? message + "\n\n" : "") + "[Link ảnh báo lỗi hiển thị]: " + attachment_url }
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'access_token': zaloToken
            }
          }
        );
      }

      res.json({ success: true, zalo_status: zaloResponse.data });
    } else {
      res.status(400).json({ error: "Unsupported source format" });
    }
  } catch (e) {
    console.error("Direct Send Error:", e.response?.data || e.message);
    res.status(500).json({ error: "Failed to send message: " + (e.response?.data?.error?.message || e.response?.data?.message || e.message) });
  }
});

export default router;
