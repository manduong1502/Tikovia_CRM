import { Router } from 'express';
import { supabase } from '../supabase.js';
import axios from 'axios';

const router = Router();

// Endpoint to authenticate and link a channel (Zalo or Facebook)
router.post('/connect', async (req, res) => {
  const { appId, secretKey, companyId, name, platform, syncCycle, storeMedia } = req.body;
  
  try {
    // 1. Temporarily store channel details in memory or a `pending_auth` table
    // For simplicity, we create an un-connected channel in Supabase first
    const { data: channelData, error } = await supabase.from('channels').insert({
      company_id: companyId,
      provider: platform,
      page_id: 'pending_' + Date.now(),
      name: name,
      auth_data: { appId, secretKey, syncCycle, storeMedia },
      status: 'pending'
    }).select('id').single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    let authUrl = '';
    const backendUrl = process.env.BACKEND_URL;
    
    if (platform === 'zalo') {
      const redirectUri = encodeURIComponent(`${backendUrl}/api/channels/zalo/callback`);
      authUrl = `https://oauth.zaloapp.com/v4/oa/permission?app_id=${appId}&redirect_uri=${redirectUri}&state=${channelData?.id || companyId}`;
      res.json({ authUrl });
    } else if (platform === 'facebook') {
      let pageAccessToken = secretKey;
      try {
        const fbRes = await axios.get(`https://graph.facebook.com/v18.0/me/accounts?access_token=${secretKey}`);
        const accountData = fbRes.data;
        if (accountData && accountData.data && Array.isArray(accountData.data)) {
           const page = accountData.data.find(p => p.id === appId);
           if (page && page.access_token) {
              pageAccessToken = page.access_token;
           }
        }
      } catch(e) {
        console.warn("FB Token Ex", e);
      }
      
      await supabase.from('channels').update({
         status: 'connected',
         page_id: appId,
         access_token: pageAccessToken,
         auth_data: { appId, secretKey: pageAccessToken, syncCycle, storeMedia, page_token: pageAccessToken }
      }).eq('id', channelData.id);

      // Đồng bộ thông tin Fanpage & Access Token sang n8n (Google Sheet)
      try {
        const { data: comp } = await supabase.from('companies').select('name').eq('id', companyId).maybeSingle();
        const n8nUrl = process.env.N8N_CONTENT_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL;
        if (n8nUrl) {
          axios.post(n8nUrl, {
            event: 'channel_connected',
            timestamp: new Date().toISOString(),
            company_id: companyId,
            company_name: comp?.name || 'Chưa đặt tên',
            channel: {
              name,
              provider: 'facebook',
              page_id: appId,
              access_token: pageAccessToken
            }
          }).catch(e => console.warn('n8n channel update notify error:', e.message));
        }
      } catch (notifyErr) {
        console.warn('Channel notify error:', notifyErr.message);
      }

      res.json({ success: true, authUrl: null });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to handle Zalo OAuth callback
router.get('/zalo/callback', async (req, res) => {
  const { code, state: channelId, oa_id } = req.query;
  
  try {
    // Save generated code to `channels` table but KEEP old auth_data
    // First get the old auth_data
    const { data: oldChannel } = await supabase.from('channels').select('auth_data').eq('id', channelId).single();
    const existingAuthData = oldChannel?.auth_data || {};
    
    // Đổi code Zalo lấy Access Token & Refresh Token
    let newTokens = {};
    if (existingAuthData.appId && existingAuthData.secretKey && code) {
      try {
        const resp = await axios.post('https://oauth.zaloapp.com/v4/oa/access_token', new URLSearchParams({
            app_id: existingAuthData.appId,
            grant_type: 'authorization_code',
            code: code
          }), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'secret_key': existingAuthData.secretKey
          }
        });
        const tokenData = resp.data;
        if (tokenData.access_token) {
          newTokens = {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            // trừ hao 5 phút = 300000 ms trễ
            token_expires_at: Date.now() + (parseInt(tokenData.expires_in || 90000) * 1000) - 300000 
          };
        } else {
          console.error("Zalo Token Exchange Error:", tokenData);
        }
      } catch (err) {
        console.error("Zalo Fetch Error:", err);
      }
    }

    const updatePayload = {
      auth_data: { ...existingAuthData, code, ...newTokens },
      status: 'connected'
    };
    if (oa_id) updatePayload.page_id = oa_id;

    const { data, error } = await supabase.from('channels').update(updatePayload).eq('id', channelId).select('company_id').single();
    
    if (error) throw error;

    const frontendUrl = process.env.FRONTEND_URL;
    res.send(`
      <html><body><script>
        alert("Kết nối Zalo OA thành công!");
        window.location.href = "${frontendUrl}/company/${data?.company_id || 'unknown'}/channels";
      </script></body></html>
    `);
  } catch (error) {
    res.status(500).send('Auth Error: ' + error.message);
  }
});

// Endpoint to handle FB callback
router.get('/facebook/callback', async (req, res) => {
  const { code, state: channelId } = req.query;
  
  try {
    const { data: oldChannel } = await supabase.from('channels').select('auth_data').eq('id', channelId).single();
    const existingAuthData = oldChannel?.auth_data || {};

    const { data, error } = await supabase.from('channels').update({
      auth_data: { ...existingAuthData, code },
      status: 'connected'
    }).eq('id', channelId).select('company_id').single();
    
    if (error) throw error;

    const frontendUrl = process.env.FRONTEND_URL;
    res.send(`
      <html><body><script>
        alert("Kết nối Facebook thành công!");
        window.location.href = "${frontendUrl}/company/${data?.company_id || 'unknown'}/channels";
      </script></body></html>
    `);
  } catch (error) {
    res.status(500).send('Auth Error: ' + error.message);
  }
});

export default router;
