import { Router } from 'express';
import { supabase } from '../supabase.js';
import axios from 'axios';

const router = Router();

function parseScheduledDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  const time = timeStr && timeStr.includes(':') ? timeStr.trim() : '09:00';
  const [hours, minutes] = time.split(':').map(n => String(parseInt(n, 10) || 0).padStart(2, '0'));

  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const day = String(parts[0]).padStart(2, '0');
    const month = String(parts[1]).padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day} ${hours}:${minutes}:00`;
  }

  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:00`;
  }
  return `${dateStr} ${hours}:${minutes}:00`;
}

function extractMediaUrls(materialText) {
  if (!materialText) return [];
  const urls = [];
  const lines = materialText.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('FILE:')) {
      urls.push(trimmed.replace('FILE:', '').trim());
    } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      urls.push(trimmed);
    }
  }
  return urls;
}

// Trigger webhook to n8n when post is approved
router.post('/trigger-approval', async (req, res) => {
  const { planId } = req.body;
  if (!planId) {
    return res.status(400).json({ error: 'planId is required' });
  }

  try {
    // 1. Fetch Plan details
    const { data: plan, error: planError } = await supabase
      .from('content_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      return res.status(404).json({ error: 'Plan not found: ' + (planError?.message || '') });
    }

    // 2. Fetch Company details
    const { data: company } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', plan.company_id)
      .maybeSingle();

    // 3. Fetch Channel details if channel_id is selected
    let channelInfo = null;
    if (plan.channel_id) {
      const { data: ch } = await supabase
        .from('channels')
        .select('id, name, provider, page_id, access_token, auth_data')
        .eq('id', plan.channel_id)
        .maybeSingle();

      if (ch) {
        channelInfo = {
          id: ch.id,
          name: ch.name,
          provider: ch.provider,
          page_id: ch.page_id,
          access_token: ch.access_token || ch.auth_data?.page_token || ch.auth_data?.secretKey || null
        };
      }
    }

    // 4. Construct Media & Schedule
    const mediaUrls = extractMediaUrls(plan.material);
    const scheduledAt = parseScheduledDateTime(plan.date, plan.publish_time);

    const isFacebookAutoPost = Boolean(channelInfo && channelInfo.provider === 'facebook' && channelInfo.access_token);

    const payload = {
      event: 'plan_approved',
      timestamp: new Date().toISOString(),
      plan_id: plan.id,
      company_id: plan.company_id,
      company_name: company?.name || 'Không xác định',
      title: plan.title || '',
      content: plan.desc || '',
      desc: plan.desc || '',
      type: plan.type || 'Text',
      material_raw: plan.material || '',
      media_urls: mediaUrls,
      date: plan.date,
      publish_time: plan.publish_time || '09:00',
      scheduled_at: scheduledAt,
      is_facebook_autopost: isFacebookAutoPost,
      status_initial: isFacebookAutoPost ? 'Chờ đăng' : 'Đăng thủ công',
      channel: channelInfo
    };

    const n8nWebhookUrl = process.env.N8N_CONTENT_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL;
    let n8nResponse = null;

    if (n8nWebhookUrl) {
      try {
        const resp = await axios.post(n8nWebhookUrl, payload, { timeout: 10000 });
        n8nResponse = { status: resp.status, data: resp.data };
      } catch (webhookErr) {
        console.warn('n8n Webhook delivery error:', webhookErr.message);
        n8nResponse = { error: webhookErr.message };
      }
    } else {
      console.log('n8n Webhook URL not set yet in .env, payload generated successfully:', payload.plan_id);
    }

    return res.json({
      success: true,
      delivered_to_n8n: !!n8nWebhookUrl,
      payload,
      n8nResponse
    });
  } catch (err) {
    console.error('Lỗi automation trigger:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Callback from n8n when post is live or updated
router.post('/callback-published', async (req, res) => {
  const { plan_id, live_post_url, status, error_log } = req.body;
  if (!plan_id) {
    return res.status(400).json({ error: 'plan_id is required' });
  }

  try {
    // Update published_contents
    const updateData = {};
    if (live_post_url) {
      updateData.link = live_post_url;
    }
    if (error_log) {
      updateData.notes = `[n8n Log: ${error_log}]`;
    }

    const { error } = await supabase
      .from('published_contents')
      .update(updateData)
      .eq('plan_id', plan_id);

    if (error) {
      console.error('Error updating published_contents from n8n callback:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true, message: 'Updated post link in CRM' });
  } catch (err) {
    console.error('Error in callback-published:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
