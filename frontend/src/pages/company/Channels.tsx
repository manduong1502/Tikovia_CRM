import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MessageSquare as Facebook, MessageCircle, Link, RefreshCw, Trash2 } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { AddChannelModal } from '../../components/channels/AddChannelModal';
import { supabase } from '../../lib/supabase';

interface Channel {
  id: string;
  provider: 'facebook' | 'zalo';
  name: string;
  status: string;
  created_at: string;
}

export function Channels() {
  const { id: companyId } = useParams();
  const navigate = useNavigate();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchChannels();
  }, [companyId, isModalOpen]);

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn ngắt kết nối kênh này? Toàn bộ dữ liệu tin nhắn sẽ bị xóa khỏi hệ thống.')) return;
    try {
      const { error } = await supabase.from('channels').delete().eq('id', id);
      if (error) throw error;
      setChannels(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error('Lỗi khi xóa kênh:', err);
      alert('Có lỗi xảy ra khi ngắt kết nối kênh');
    }
  };

  const fetchChannels = async () => {
    if (!companyId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .eq('company_id', companyId)
        .order('id', { ascending: false });
        
      if (data && !error) setChannels(data as Channel[]);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Kênh chat</h2>
          <p className="text-sm text-gray-500">Kết nối và quản lý các kênh hội thoại</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isLoading ? (
          <p className="text-gray-500 p-8 col-span-2 text-center">Đang tải danh sách kênh...</p>
        ) : (
          channels.map((channel) => (
            <Card key={channel.id} className="flex flex-col">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${channel.provider === 'facebook' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30' : 'bg-blue-50 text-blue-500 dark:bg-blue-900/30'}`}>
                    {channel.provider === 'facebook' ? <Facebook className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{channel.provider === 'facebook' ? 'Facebook Page' : 'Zalo Official Account'}</h3>
                    <p className="text-sm text-gray-500">{channel.name}</p>
                  </div>
                </div>
                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${channel.status === 'connected' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800/30' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  {channel.status === 'connected' && <RefreshCw className="w-3 h-3 mr-1" />} 
                  {channel.status === 'connected' ? 'Đã kết nối' : 'Lỗi kết nối'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Tin nhắn</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">--</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Chưa đọc</p>
                  <p className="font-semibold text-orange-600 dark:text-orange-500">--</p>
                </div>
              </div>
              
              <p className="text-xs text-gray-400 mb-4">Kết nối vào: {new Date(channel.created_at || Date.now()).toLocaleString('vi-VN')}</p>
              
              <div className="grid grid-cols-2 gap-3 mt-auto">
                <Button 
                  variant="outline" 
                  onClick={() => handleDelete(channel.id)}
                  className="w-full text-red-600 border-red-200 bg-red-50 hover:bg-red-100 hover:text-red-700 hover:border-red-300 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-400 dark:hover:bg-red-900/40 dark:hover:text-red-300"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Ngắt kết nối
                </Button>
                <Button 
                  variant="primary" 
                  onClick={() => navigate(`/company/${companyId}/messages`)}
                  className="w-full cursor-pointer hover:bg-blue-700"
                >
                  Xem hội thoại
                </Button>
              </div>
            </Card>
          ))
        )}

        {/* Add Channel Card */}
        <div 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center p-8 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50/50 dark:bg-gray-800/20 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer group"
        >
          <div className="text-center">
            <div className="mx-auto w-12 h-12 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-sm border border-gray-100 dark:border-gray-700 mb-4 group-hover:scale-110 transition-transform">
              <MessageCircle className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Thêm kênh mới</h3>
            <p className="text-sm text-gray-500 mb-6">Kết nối thêm Facebook hoặc Zalo</p>
            <Button variant="outline" className="mx-auto flex items-center gap-2 pointer-events-none">
              <Link className="w-4 h-4" /> Thêm kênh
            </Button>
          </div>
        </div>

      </div>

      <AddChannelModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        companyId={companyId || ''} 
      />
    </div>
  );
}
