import { supabase } from '../supabase.js';
import axios from 'axios';

// Hàm tự động làm mới Access Token Zalo OA
export const startZaloTokenCron = () => {
  console.log('Cron Job Zalo Token Started!');
  
  // Chạy luôn lệnh quét ở lần bật server đầu tiên
  refreshZaloTokens();
  
  // Cài đặt Timer cứ 1.5 giờ (5400000ms) sẽ tự chạy lại lệnh này 1 lần. 
  // Vì Token Zalo OA hiện hành thường sống được khoảng 2 tiếng - 24 tiếng. Khởi chạy mỗi tiếng rưỡi là đảm bảo an toàn tuyệt đối, chênh nhau không bao giờ bị đứt kết nối.
  setInterval(refreshZaloTokens, 5400000); 
};

const refreshZaloTokens = async () => {
  console.log('🔄 Checking Zalo OA channels to refresh access tokens...');
  try {
    const { data: channels, error } = await supabase
      .from('channels')
      .select('*')
      .eq('provider', 'zalo')
      .not('refresh_token', 'is', 'null');

    if (error) {
      console.error('Error fetching Zalo channels:', error);
      return;
    }

    if (!channels || channels.length === 0) {
      return;
    }

    for (let channel of channels) {
      if (!channel.refresh_token) continue;
      
      const authData = typeof channel.auth_data === 'string' ? JSON.parse(channel.auth_data) : (channel.auth_data || {});
      const appId = authData.appId;
      const secretKey = authData.secretKey;
      
      if (!appId || !secretKey) {
        console.log(`⚠️ Channel ${channel.id} is missing appId or secretKey in auth_data`);
        continue;
      }

      try {
        const response = await axios.post(
          'https://oauth.zaloapp.com/v4/oa/access_token',
          new URLSearchParams({
            refresh_token: channel.refresh_token,
            app_id: appId,
            grant_type: 'refresh_token'
          }).toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'secret_key': secretKey
            }
          }
        );

        const newAccessToken = response.data.access_token;
        const newRefreshToken = response.data.refresh_token;

        if (newAccessToken) {
          // Lưu cặp Token mới chuẩn vào db
          await supabase
            .from('channels')
            .update({
              access_token: newAccessToken,
              // Ghi đè luôn cả Refresh Token nếu Zalo cấp khóa tịnh tiến mới
              refresh_token: newRefreshToken || channel.refresh_token 
            })
            .eq('id', channel.id);
            
          console.log(`✅ [CRON] Refreshed Zalo Access Token successfully for channel: ${channel.name}`);
        } else {
          console.error(`❌ Failed to refresh Zalo Token for channel ${channel.name}:`, response.data);
        }
      } catch (err) {
        console.error(`❌ [CRON] HTTP Error refreshing Zalo Token for channel ${channel.name}:`, err.response?.data || err.message);
      }
    }
  } catch (err) {
    console.error('Failed to run Zalo Token Cron:', err);
  }
};
