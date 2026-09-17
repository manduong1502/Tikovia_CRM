import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Search, Send, Bot, Sparkles, Flame, Zap, Ban, AtSign, ExternalLink, MessageSquare, ShieldCheck, ChevronLeft } from 'lucide-react';
import { Card, cn } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const FacebookIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const renderMessageText = (text: string) => {
  if (!text) return null;
  const regex = /\[Ảnh(?: đính kèm)?: (.*?)\]/g;
  
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex, match.index)}</span>);
    }
    let url = match[1];
    let displayUrl = url;
    
    // Auto convert Google Drive links for image preview
    const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
      displayUrl = `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`;
    }

    parts.push(
      <div key={`img-${match.index}`} className="mt-2 mb-2 rounded-lg overflow-hidden border border-black/10 dark:border-white/10 max-w-[250px]">
        <img src={displayUrl} alt="Đính kèm" className="w-full h-auto object-cover cursor-pointer hover:opacity-90 transition-opacity bg-gray-100" onClick={() => window.open(url, '_blank')} />
      </div>
    );
    lastIndex = regex.lastIndex;
  }
  
  if (lastIndex < text.length) {
    parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex)}</span>);
  }

  return parts.length > 0 ? parts : text;
};

export function MyMessages() {
  const { id: companyId } = useParams();
  const { user } = useAuth();

  const [messages, setMessages] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [activeSender, setActiveSender] = useState<string | null>(null);
  const [inputMsg, setInputMsg] = useState('');
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [currentShiftName, setCurrentShiftName] = useState(localStorage.getItem('shiftName') || '');

  const [activeTab, setActiveTab] = useState<'chat' | 'evaluate'>('chat');
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  // Filters
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterChannel, setFilterChannel] = useState('all');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterTag, setFilterTag] = useState('all');

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!companyId) return;

    // Fetch channels
    supabase.from('channels').select('*').eq('company_id', companyId)
      .then(({ data }) => setChannels(data || []));

    // Fetch messages
    supabase.from('messages').select('*').eq('company_id', companyId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setMessages(data || []);
        if (data && data.length > 0) {
          // Select first sender initially
          const firstSender = data[data.length - 1].sender_id;
          if (!activeSender) setActiveSender(firstSender);
        }
      });

    // Fetch staff
    supabase.from('tikovia_users').select('id, name, email').eq('company_id', companyId)
      .then(({ data }) => setStaffMembers(data || []));

    // Subscribe to realtime messages
    const realtimeChannel = supabase.channel('realtime-msgs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `company_id=eq.${companyId}` }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(realtimeChannel);
    };
  }, [companyId]);

  const handleSend = async () => {
    if (!inputMsg.trim() || !activeSender || !companyId) return;

    const activeConv = convMap.get(activeSender);
    if (!activeConv) return;

    // Lấy thông tin kênh để biết đang gửi từ platform nào (facebook hay zalo)
    const activeChannel = channels.find(c => c.id === activeConv.channel_id);
    const platform = activeChannel?.provider || 'zalo';

    // Ưu tiên: Tên người trực ca đang chọn -> Tên người gán cho đoạn chat -> Tên user login -> Mặc định
    const staffName = currentShiftName || activeConv.assignee || user?.name || user?.email || 'Sale Staff';
    const payload = {
      company_id: companyId,
      channel_id: activeConv.channel_id,
      conversation_id: activeSender,
      sender_id: activeSender,
      message: inputMsg,
      is_from_bot: true,
      source: platform,
      staff_name: staffName,
      sender_name: staffName,
      assigned_staff_name: staffName
    };

    setInputMsg('');
    try {
      const { data, error } = await supabase.from('messages').insert([payload]).select().single();
      if (error) console.error("Error sending message to DB:", error);

      // Call Backend Webhook to send to FB Graph
      // Call Backend Webhook to send to FB or Zalo Graph
      if (platform === 'facebook' || platform === 'zalo') {
        await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://crm.tikovia.vn/api'}/webhooks/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company_id: companyId,
            channel_id: activeConv.channel_id,
            sender_id: activeSender,
            message: inputMsg,
            source: platform,
            staff_name: staffName
          })
        });
      }
    } catch (e) {
      console.error("Fetch send error:", e);
    }
  };

  const handleAssignChange = async (staffName: string) => {
    // Lưu tạm thời cho Sale đang trực ca
    setCurrentShiftName(staffName);
    localStorage.setItem('shiftName', staffName);

    // Vẫn cập nhật DB cho đoạn hội thoại nếu muốn
    if (!activeSender || !companyId || !staffName) return;
    try {
      await supabase.from('messages').update({ assigned_staff_name: staffName }).eq('sender_id', activeSender).eq('company_id', companyId);
      setMessages(prev => prev.map(m => m.sender_id === activeSender ? { ...m, assigned_staff_name: staffName } : m));
    } catch (e) {
      console.error(e);
    }
  };

  const handleTagChange = async (newTag: string) => {
    if (!activeSender || !companyId) return;
    try {
      // Cập nhật toàn bộ các log chat của sender_id này thành tag mới
      await supabase.from('messages').update({ customer_tag: newTag }).eq('sender_id', activeSender).eq('company_id', companyId);

      // Cập nhật UI ngay lập tức
      setMessages(prev => prev.map(m => m.sender_id === activeSender ? { ...m, customer_tag: newTag } : m));
    } catch (e) {
      console.error(e);
    }
  };

  // Scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeSender]);

  // Group messages
  const convMap = new Map();
  messages.forEach(m => {
    if (!convMap.has(m.sender_id)) {
      convMap.set(m.sender_id, {
        id: m.sender_id,
        sender_id: m.sender_id,
        channel_id: m.channel_id,
        messages: [],
        lastMsg: null,
        tag: 'Bình thường', // Default
        ai_evaluation: null,
        assignee: ''
      });
    }
    const conv = convMap.get(m.sender_id);
    conv.messages.push(m);
    conv.lastMsg = m;
    // Chốt lấy dữ liệu tag và ai_evaluation chuẩn từ record message mới nhất có data
    if (m.customer_tag) conv.tag = m.customer_tag;
    if (m.ai_evaluation) conv.ai_evaluation = m.ai_evaluation;
    if (m.assigned_staff_name) conv.assignee = m.assigned_staff_name;
  });

  const allConversations = Array.from(convMap.values()).map(conv => {
    const ch = channels.find(c => c.id === conv.channel_id);
    const dbName = conv.messages.find((m: any) => m.sender_name)?.sender_name;
    const dbAvatar = conv.messages.find((m: any) => m.sender_avatar)?.sender_avatar;

    return {
      ...conv,
      channelName: ch?.name || 'Unknown Channel',
      platform: ch?.provider || 'zalo',
      name: dbName || `Khách hàng ${conv.sender_id.slice(-4).toUpperCase()}`,
      avatar: dbAvatar || null,
      initial: dbName ? dbName.charAt(0).toUpperCase() : 'KH',
      msg: conv.lastMsg.message,
      time: new Date(conv.lastMsg.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    };
  }).sort((a, b) => new Date(b.lastMsg.created_at).getTime() - new Date(a.lastMsg.created_at).getTime());

  // Apply filters including "my messages only" filter
  const filteredConversations = allConversations.filter(c => {
    // Only show messages assigned to current user
    const currentUserName = user?.name || user?.email;
    if (c.assignee !== currentUserName) return false;

    if (filterPlatform !== 'all' && c.platform !== filterPlatform) return false;
    if (filterChannel !== 'all' && c.channel_id !== filterChannel) return false;
    if (filterSearch && !c.msg.toLowerCase().includes(filterSearch.toLowerCase()) && !c.name.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    if (filterTag !== 'all' && filterTag !== 'Bình thường' && c.tag !== filterTag) return false;
    return true;
  });

  // Active Conversation
  const activeConv = filteredConversations.find(c => c.sender_id === activeSender) || filteredConversations[0];

  // Stats
  const statNong = allConversations.filter(c => c.tag === 'Nóng').length;
  const statTiemNang = allConversations.filter(c => c.tag === 'Tiềm năng').length;
  const statSpam = allConversations.filter(c => c.tag === 'Spam').length;

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col space-y-4">

      {/* Top Filter Bar */}
      <div className="flex md:items-center flex-col md:flex-row gap-3 p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm shrink-0 overflow-x-auto whitespace-nowrap scrollbar-hide">
        <div className="flex items-center gap-2 mr-2">
          <h2 className="text-[17px] font-bold text-gray-900 dark:text-white leading-none tracking-tight">Tin nhắn</h2>
          <span className="text-gray-400 font-medium text-[15px] pt-px">({filteredConversations.length})</span>
        </div>
        <select
          value={filterPlatform}
          onChange={e => setFilterPlatform(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-gray-50 dark:bg-gray-800 min-w-[120px] focus:outline-none focus:ring-1 focus:ring-brand-blue dark:text-white"
        >
          <option value="all">Loại kênh</option>
          <option value="zalo">Zalo OA</option>
          <option value="facebook">Facebook</option>
        </select>
        
        <div className="flex items-center gap-2 flex-1 w-full md:w-auto">
          <select
            value={filterChannel}
            onChange={e => setFilterChannel(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-gray-50 dark:bg-gray-800 min-w-[140px] focus:outline-none focus:ring-1 focus:ring-brand-blue dark:text-white"
          >
            <option value="all">Chọn kênh</option>
            {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <div className="flex-1 relative min-w-[150px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm..."
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-transparent dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-blue"
            />
          </div>

          <select
            value={filterTag}
            onChange={e => setFilterTag(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-gray-50 dark:bg-gray-800 min-w-[120px] focus:outline-none focus:ring-1 focus:ring-brand-blue dark:text-white"
          >
            <option value="all">Đánh giá</option>
            <option value="Nóng">Nóng</option>
            <option value="Tiềm năng">Tiềm năng</option>
            <option value="Spam">Spam</option>
          </select>

          <Button variant="outline" className="hidden md:flex px-3 py-2 border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 shrink-0">
            <ExternalLink className="w-4 h-4 text-blue-500" />
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
        <Card className="p-4 flex flex-col justify-between border-l-4 border-l-gray-300">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Tổng tin nhắn</span>
          </div>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">{allConversations.length}</span>
        </Card>
        <Card className="p-4 flex flex-col justify-between border-l-4 border-l-red-400">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Nóng</span>
            <Flame className="w-4 h-4 text-red-500" />
          </div>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">{statNong}</span>
        </Card>
        <Card className="p-4 flex flex-col justify-between border-l-4 border-l-amber-400">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Tiềm năng</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">{statTiemNang}</span>
        </Card>
        <Card className="p-4 flex flex-col justify-between border-l-4 border-l-gray-400">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Spam</span>
            <Ban className="w-4 h-4 text-gray-400" />
          </div>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">{statSpam}</span>
        </Card>
      </div>

      <Card className="flex-1 flex overflow-hidden p-0 h-full relative">
        {/* Left Sidebar: Inbox List */}
        <div className={cn(
          "border-r border-gray-200 dark:border-gray-800 flex-col bg-white dark:bg-gray-900 w-full md:w-[32%] md:min-w-[300px]",
          mobileView === 'chat' ? 'hidden md:flex' : 'flex'
        )}>
          <div className="flex-1 overflow-y-auto w-full">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">Không có dữ liệu </div>
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => {
                    setActiveSender(conv.id);
                    setMobileView('chat');
                  }}
                  className={cn(
                    "p-4 border-b border-gray-50 dark:border-gray-800/50 cursor-pointer hover:bg-brand-blue/5 dark:hover:bg-brand-blue/10 transition-colors",
                    (activeConv?.id === conv.id) && "bg-brand-blue/5 dark:bg-brand-blue/10 border-l-2 border-l-brand-blue"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 text-brand-blue flex items-center justify-center font-semibold text-xs shrink-0 overflow-hidden">
                      {conv.avatar ? <img src={conv.avatar} alt={conv.name} className="w-full h-full object-cover" /> : conv.initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-medium text-gray-900 dark:text-white truncate">{conv.name}</h4>
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1",
                          conv.tag === 'Nóng' && "bg-red-50 text-red-600 dark:bg-red-900/30",
                          conv.tag === 'Tiềm năng' && "bg-amber-50 text-amber-600 dark:bg-amber-900/30",
                          conv.tag === 'Spam' && "bg-gray-100 text-gray-500 dark:bg-gray-800"
                        )}>
                          {conv.tag === 'Nóng' && <Flame className="w-3 h-3" />}
                          {conv.tag === 'Tiềm năng' && <Zap className="w-3 h-3" />}
                          {conv.tag === 'Spam' && <Ban className="w-3 h-3" />}
                          {conv.tag !== 'Bình thường' && conv.tag}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-1">{conv.msg}</p>
                      <p className="text-[10px] text-gray-400 flex items-center gap-1">
                        <AtSign className="w-3 h-3" /> {conv.time} • <span className="truncate">{conv.channelName}</span>
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Sidebar: Chat Area */}
        <div className={cn(
          "flex-1 bg-gray-50/50 dark:bg-gray-900/50 w-full flex-col absolute inset-0 md:relative z-10 md:z-0",
          mobileView === 'list' ? 'hidden md:flex' : 'flex'
        )}>

          {activeConv ? (
            <>
              {/* Main header inside right panel */}
              <div className="h-16 shrink-0 border-b border-gray-200 dark:border-gray-800 px-3 md:px-6 flex items-center justify-between bg-white dark:bg-gray-900 shadow-sm md:shadow-none z-20 sticky top-0">
                <div className="flex items-center gap-2 md:gap-3">
                  <button 
                    className="md:hidden p-1.5 -ml-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg shrink-0"
                    onClick={() => setMobileView('list')}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 text-brand-blue flex items-center justify-center font-semibold text-sm shrink-0 overflow-hidden">
                    {activeConv.avatar ? <img src={activeConv.avatar} alt={activeConv.name} className="w-full h-full object-cover" /> : activeConv.initial}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{activeConv.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-brand-blue flex items-center gap-1">
                        {activeConv.platform === 'facebook' ? <FacebookIcon width={12} height={12} /> : <div className="w-3 h-3 rounded bg-blue-500 text-white flex items-center justify-center text-[10px] leading-none font-bold">Z</div>}
                        {activeConv.channelName}
                      </span>

                      <select
                        value={activeConv.tag}
                        onChange={(e) => handleTagChange(e.target.value)}
                        className={cn(
                          "ml-2 text-[11px] px-2 py-0.5 rounded font-medium border cursor-pointer focus:outline-none",
                          activeConv.tag === 'Nóng' && "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:border-red-900/50",
                          activeConv.tag === 'Tiềm năng' && "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:border-amber-900/50",
                          activeConv.tag === 'Spam' && "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:border-gray-700",
                          activeConv.tag === 'Bình thường' && "bg-white text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700"
                        )}
                      >
                        <option value="Bình thường">Bình thường</option>
                        <option value="Tiềm năng">⚡ Tiềm năng</option>
                        <option value="Nóng">🔥 Nóng</option>
                        <option value="Spam">🚫 Spam</option>
                      </select>

                    </div>
                  </div>
                </div>
              </div>

              {/* Content Area Rendering Based on Tabs */}
              {activeTab === 'chat' ? (
                <>
                  <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
                    {activeConv.messages.map((msg: any, i: number) => {
                      const isBot = msg.is_from_bot || false; // Or user vs customer
                      return (
                        <div key={i} className={`flex ${isBot ? 'justify-end' : 'justify-start'}`}>
                          <div className={cn(
                            "rounded-2xl px-4 py-3 max-w-[80%] shadow-sm",
                            isBot
                              ? "bg-brand-blue text-white rounded-tr-sm"
                              : "bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-tl-sm text-gray-800 dark:text-gray-200"
                          )}>
                            <div className="text-sm whitespace-pre-wrap flex flex-col gap-1">
                              <div>{renderMessageText(msg.message)}</div>
                              {isBot && msg.staff_name && (
                                <div className="text-[10px] text-blue-200 uppercase font-semibold text-right mt-1">— {msg.staff_name}</div>
                              )}
                            </div>
                            <p className={cn(
                              "text-[10px] mt-1 text-right opacity-70",
                              isBot ? "text-blue-100" : "text-gray-400"
                            )}>
                              {new Date(msg.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shrink-0">

                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-0 flex items-center h-[46px]">
                        <textarea
                          placeholder={`Gửi tới ${activeConv.name}...`}
                          value={inputMsg}
                          onChange={(e) => setInputMsg(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSend();
                            }
                          }}
                          rows={1}
                          className="w-full bg-transparent border-none p-0 focus:ring-0 outline-none focus:outline-none resize-none h-[20px] leading-[20px] text-sm dark:text-white scrollbar-hide"
                        />
                      </div>
                      <Button onClick={handleSend} className="h-[46px] w-[46px] rounded-xl shrink-0 p-0 flex items-center justify-center">
                        <Send className="w-5 h-5 -ml-1 translate-y-px" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 p-6 overflow-y-auto bg-gray-50 dark:bg-gray-900/50">
                  <div className="max-w-3xl mx-auto space-y-6">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-purple-500" /> Báo cáo Đánh giá Tự động
                    </h2>

                    {activeConv.ai_evaluation ? (
                      <Card className="p-6 border-l-4 border-l-purple-500 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                          <Bot className="w-24 h-24" />
                        </div>
                        <div className="font-bold text-gray-900 dark:text-white mb-4">Kết quả phân tích từ AI</div>
                        <div className="text-[15px] leading-relaxed text-gray-700 dark:text-gray-300 bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl whitespace-pre-wrap whitespace-normal break-words border border-purple-100 dark:border-purple-800">
                          {activeConv.ai_evaluation}
                        </div>
                        <div className="mt-4 flex justify-between items-center text-sm text-gray-500">
                          <span className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-purple-400" /> Auto-Evaluated Batch System
                          </span>
                          <span>Powered by Tikovia CQA Engine</span>
                        </div>
                      </Card>
                    ) : (
                      <div className="text-center p-12 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                        <Bot className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-gray-900 dark:text-white font-medium mb-2">Chưa có đánh giá</h3>
                        <p className="text-gray-500 text-sm max-w-md mx-auto">
                          Hệ thống AI tự động phân tích theo lô. Bạn cần đợi nhân viên hoặc khách ngưng chat khoảng 15 phút để hệ thống tiến hành đánh giá tự động nhé!
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                <Bot className="w-8 h-8 text-gray-300 dark:text-gray-600" />
              </div>
              <p>Chưa có hội thoại nào được chọn.<br />Hãy gửi tin nhắn đầu tiên từ Zalo OA để xem dữ liệu Live Realtime.</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
