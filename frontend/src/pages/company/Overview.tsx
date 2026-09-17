import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Line, Pie } from 'react-chartjs-2';
import { FileText, Users, MessageSquare, ExternalLink, Bell, AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react';
import { Card } from '../../components/ui/Card';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export function Overview() {
  const { id: companyId } = useParams();

  const [stats, setStats] = useState({
    contentPlans: 0,
    publishedContents: 0,
    uniqueCustomers: 0,
    totalMessages: 0
  });

  const [monthlyData, setMonthlyData] = useState<{ labels: string[], counts: number[] }>({ labels: [], counts: [] });
  const [customerTags, setCustomerTags] = useState<{ nóng: number, tiềm_năng: number, bình_thường: number, spam: number, theo_dõi: number }>({ nóng: 0, tiềm_năng: 0, bình_thường: 0, spam: 0, theo_dõi: 0 });
  const [recentEvaluations, setRecentEvaluations] = useState<any[]>([]);
  const [staffEvaluations, setStaffEvaluations] = useState<any[]>([]);

  useEffect(() => {
    if (!companyId) return;
    fetchDashboardData();
  }, [companyId]);

  const fetchDashboardData = async () => {
    try {
      // 1. Kế hoạch nội dung
      const { count: cpCount } = await supabase.from('content_plans').select('*', { count: 'exact', head: true }).eq('company_id', companyId);
      
      // 2. Triển khai
      const { count: pbCount } = await supabase.from('published_contents').select('*', { count: 'exact', head: true }).eq('company_id', companyId);
      
      // 3. Tin nhắn (Get all for counts and graphs)
      const { data: messages } = await supabase.from('messages')
        .select('sender_id, created_at, customer_tag, ai_evaluation, sender_name, assigned_staff_name')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (messages) {
        // Stats
        const totalMsg = messages.length;
        const uniqueSendersSet = new Set(messages.map(m => m.sender_id));
        const uniqueCustomers = uniqueSendersSet.size;

        setStats({
          contentPlans: cpCount || 0,
          publishedContents: pbCount || 0,
          uniqueCustomers,
          totalMessages: totalMsg
        });

        // ======================================
        // Biểu đồ theo tháng (6 tháng gần nhất)
        // ======================================
        const now = new Date();
        const monthCounts = new Array(6).fill(0);
        const monthLabels = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          monthLabels.push(`T${d.getMonth() + 1}`);
        }

        messages.forEach(m => {
          const mDate = new Date(m.created_at);
          const diffMonths = (now.getFullYear() - mDate.getFullYear()) * 12 + (now.getMonth() - mDate.getMonth());
          if (diffMonths >= 0 && diffMonths < 6) {
            monthCounts[5 - diffMonths]++;
          }
        });
        setMonthlyData({ labels: monthLabels, counts: monthCounts });

        // ======================================
        // Phân loại khách hàng (Tính cho độc nhất mỗi sender_id)
        // ======================================
        const customerLatestTag = new Map();
        messages.forEach(m => {
          if (!customerLatestTag.has(m.sender_id)) {
            customerLatestTag.set(m.sender_id, (m.customer_tag || 'Bình thường').toLowerCase());
          }
        });

        const tagCounts = { nóng: 0, tiềm_năng: 0, bình_thường: 0, spam: 0, theo_dõi: 0 };
        for (const tag of customerLatestTag.values()) {
          if (tag.includes('nóng')) tagCounts.nóng++;
          else if (tag.includes('tiềm_năng') || tag.includes('tiềm năng')) tagCounts.tiềm_năng++;
          else if (tag.includes('spam')) tagCounts.spam++;
          else if (tag.includes('theo dõi') || tag.includes('theo_dõi')) tagCounts.theo_dõi++;
          else tagCounts.bình_thường++;
        }
        setCustomerTags(tagCounts);

        // ======================================
        // Báo cáo AI Gần đây và Đánh giá Nhân viên
        // ======================================
        const evaluatedChats = new Map();
        
        messages.forEach(m => {
          if (m.ai_evaluation && !evaluatedChats.has(m.sender_id)) {
            evaluatedChats.set(m.sender_id, {
               name: m.sender_name || m.sender_id,
               evaluation: m.ai_evaluation,
               time: new Date(m.created_at).getTime(),
               staff: m.assigned_staff_name || 'AI Bot'
            });
          }
        });
        const evalList = Array.from(evaluatedChats.values()).sort((a, b) => b.time - a.time).slice(0, 10);
        
        const staffScores = new Map();
        
        // Parse Tiền tố [Nghiêm trọng], [Cần cải thiện]...
        const parsedEvalList = evalList.map(item => {
           let type = 'Góp ý';
           let text = item.evaluation;
           
           const match = item.evaluation.match(/^\[(.*?)\]/);
           if (match) {
              type = match[1];
              text = item.evaluation.replace(match[0], '').trim();
           } else {
              // Dự phòng nếu AI quên
              if (text.toLowerCase().includes('nghiêm trọng')) type = 'Nghiêm trọng';
              else if (text.toLowerCase().includes('cải thiện')) type = 'Cần cải thiện';
              else if (text.toLowerCase().includes('tốt')) type = 'Tốt';
           }

           const nowTime = Date.now();
           const diffHours = Math.floor((nowTime - item.time) / (1000 * 60 * 60));
           const timeStr = diffHours > 24 ? `${Math.floor(diffHours/24)} ngày trước` : (diffHours > 0 ? `${diffHours} giờ trước` : 'Mới đây');

           // Compute score for staff
           if (item.staff !== 'AI Bot') {
             if (!staffScores.has(item.staff)) {
               staffScores.set(item.staff, { name: item.staff, totalScore: 0, count: 0 });
             }
             const s = staffScores.get(item.staff);
             let score = 70; // Góp ý
             if (type === 'Tốt') score = 100;
             else if (type === 'Cần cải thiện') score = 40;
             else if (type === 'Nghiêm trọng') score = 0;
             
             s.totalScore += score;
             s.count += 1;
           }

           return { ...item, type, text, timeStr };
        });

        // Calculate final staff ratings
        const staffs = Array.from(staffScores.values()).map(s => {
           const avg = Math.round(s.totalScore / s.count);
           let badge = 'Cần cải thiện';
           if (avg >= 80) badge = 'Tốt';
           else if (avg >= 60) badge = 'Khá';
           return { name: s.name, score: avg, badge, count: s.count };
        }).sort((a, b) => b.score - a.score);

        setRecentEvaluations(parsedEvalList);
        setStaffEvaluations(staffs);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const statCards = [
    { title: 'Bài đăng (Kế hoạch)', value: stats.contentPlans, icon: FileText },
    { title: 'Đã đăng (Triển khai)', value: stats.publishedContents, icon: ExternalLink },
    { title: 'Khách hàng', value: stats.uniqueCustomers, icon: Users },
    { title: 'Tin nhắn', value: stats.totalMessages, icon: MessageSquare },
  ];

  const lineChartData = {
    labels: monthlyData.labels.length > 0 ? monthlyData.labels : ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'],
    datasets: [
      {
        label: 'Tin nhắn',
        data: monthlyData.counts.length > 0 ? monthlyData.counts : [0,0,0,0,0,0],
        borderColor: '#10b981', 
        backgroundColor: '#10b981',
        tension: 0.4,
      },
    ],
  };

  const pieChartData = {
    labels: ['Nóng', 'Tiềm năng', 'Theo dõi', 'Bình thường', 'Spam'],
    datasets: [
      {
         data: [customerTags.nóng, customerTags.tiềm_năng, customerTags.theo_dõi, customerTags.bình_thường, customerTags.spam],
         backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#9ca3af', '#6b7280'],
         borderWidth: 0,
      },
    ],
  };

  const getBadgeStyle = (type: string) => {
     switch(type?.toLowerCase()) {
        case 'nghiêm trọng': return 'bg-red-100 text-red-600 dark:bg-red-900/30 font-bold';
        case 'cần cải thiện': return 'bg-orange-100 text-orange-600 dark:bg-orange-900/30';
        case 'góp ý': return 'bg-gray-100 text-gray-600 dark:bg-gray-800';
        case 'tốt': return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30';
        default: return 'bg-gray-100 text-gray-600 dark:bg-gray-800';
     }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Tổng quan</h2>
          <p className="text-sm text-gray-500">Dashboard quản lý CRM & Marketing thống kê dựa trên thời gian thực</p>
        </div>
      </div>

      {/* Basic Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {statCards.map((stat, idx) => (
          <Card key={idx} className="flex flex-col justify-between hover:shadow-md transition-shadow !p-3 md:!p-5">
            <div className="flex justify-between items-start mb-1 md:mb-2">
              <p className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">{stat.title}</p>
              <div className="p-1.5 md:p-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-brand-blue">
                <stat.icon className="w-4 h-4 md:w-5 md:h-5" />
              </div>
            </div>
            <div>
              <h3 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white">{stat.value.toLocaleString()}</h3>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line Chart Area */}
        <Card className="lg:col-span-2 flex flex-col h-[400px]">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Thống kê Tin nhắn 6 tháng qua</h3>
          <div className="flex-1 min-h-0">
            <Line data={lineChartData} options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
            }} />
          </div>
        </Card>

        {/* Pie Chart Area */}
        <Card className="flex flex-col h-[400px]">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Phân loại khách hàng</h3>
          <div className="flex-1 min-h-0 px-4">
            <Pie data={pieChartData} options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
            }} />
          </div>
          
          <div className="mt-6 space-y-3">
            {[ 
              { label: 'Nóng', val: customerTags.nóng, color: 'bg-red-500' },
              { label: 'Tiềm năng', val: customerTags.tiềm_năng, color: 'bg-amber-500' },
              { label: 'Theo dõi', val: customerTags.theo_dõi, color: 'bg-blue-500' },
              { label: 'Bình thường', val: customerTags.bình_thường, color: 'bg-gray-400' }
            ].map((i, idx) => (
              <div key={idx} className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <div className={"w-2.5 h-2.5 rounded-full " + i.color} />
                  <span className="text-gray-600 dark:text-gray-300">{i.label}</span>
                </div>
                <span className="font-medium text-gray-900 dark:text-white">{i.val.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Evaluator Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CQA Activity Log */}
        <Card className="p-0 overflow-hidden flex flex-col h-[560px]">
           <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex items-center gap-2">
              <Bell className="w-5 h-5 text-brand-blue" />
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Kiểm định chất lượng CSKH gần đây</h3>
           </div>
           <div className="divide-y divide-gray-100 dark:divide-gray-800 flex-1 overflow-y-auto custom-scrollbar">
              {recentEvaluations.length === 0 ? (
                 <div className="p-8 text-center text-gray-500 text-sm">Chưa có đánh giá tự động nào gần đây.</div>
              ) : (
                 recentEvaluations.map((item, idx) => (
                    <div key={idx} className="px-6 py-4 flex flex-col md:flex-row md:items-start gap-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                       
                       {/* Badge */}
                       <div className="flex-shrink-0 w-[120px] pt-0.5">
                          <span className={"px-2.5 py-1 text-[11px] font-medium rounded-full inline-block text-center w-full " + getBadgeStyle(item.type)}>
                             {item.type}
                          </span>
                       </div>
                       
                       {/* Content */}
                       <div className="flex-1 flex flex-col gap-1">
                          <div className="flex justify-between items-start gap-4">
                             <p className="text-sm text-gray-900 dark:text-gray-300 line-clamp-3">
                                {item.text}
                             </p>
                             <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0 mt-0.5">{item.timeStr}</span>
                          </div>
                          <p className="text-xs text-gray-500 font-medium mt-1">
                            Khách hàng: {item.name} 
                            {item.staff && item.staff !== 'AI Bot' && <span className="ml-2 pl-2 border-l border-gray-300 dark:border-gray-700">Nhân viên: {item.staff}</span>}
                          </p>
                       </div>

                    </div>
                 ))
              )}
           </div>
        </Card>

        {/* Staff Evaluation Log */}
        <Card className="p-0 overflow-hidden flex flex-col h-[560px]">
           <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-brand-blue" />
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Đánh giá Nhân viên Sale (Tự động)</h3>
              </div>
              <span className="text-xs font-medium bg-blue-50 text-brand-blue dark:bg-blue-900/30 px-2.5 py-1 rounded-full border border-blue-100 dark:border-blue-800/50">
                Thang điểm 100
              </span>
           </div>
           <div className="divide-y divide-gray-100 dark:divide-gray-800 flex-1 overflow-y-auto custom-scrollbar">
              {staffEvaluations.length === 0 ? (
                 <div className="p-12 text-center text-gray-500 text-sm flex flex-col justify-center items-center h-full gap-3">
                   <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                     <Users className="w-6 h-6 text-gray-300" />
                   </div>
                   Chưa có dữ liệu đánh giá cho nhân viên nào.
                 </div>
              ) : (
                 staffEvaluations.map((staff, idx) => (
                    <div key={idx} className="px-6 py-5 flex flex-row items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all cursor-default">
                       <div className="flex items-center gap-4">
                          <div className="relative">
                            <div className="w-12 h-12 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center font-bold text-lg ring-4 ring-white dark:ring-gray-900 shadow-sm">
                              {staff.name.charAt(0).toUpperCase()}
                            </div>
                            {idx === 0 && (
                              <div className="absolute -top-1 -right-1 text-xs px-1.5 py-0.5 bg-yellow-400 text-yellow-900 rounded-full font-bold shadow-sm whitespace-nowrap">
                                Top 1
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-base font-semibold text-gray-900 dark:text-white">{staff.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">Dựa trên {staff.count} hội thoại đánh giá khách hàng</p>
                          </div>
                       </div>
                       
                       <div className="flex flex-col items-end gap-1.5">
                          <span className={
                            "px-3 py-1 text-[11px] font-bold rounded-full text-center uppercase tracking-wider border " + 
                            (staff.badge === 'Tốt' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30' : 
                             staff.badge === 'Khá' ? 'bg-blue-50 text-brand-blue border-blue-200 dark:bg-blue-900/30' : 
                             'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/30')
                          }>
                             {staff.badge}
                          </span>
                          <div className="flex items-baseline gap-1 mt-1">
                            <span className={"text-xl font-black " + (staff.score >= 80 ? 'text-emerald-500' : staff.score >= 60 ? 'text-brand-blue' : 'text-orange-500')}>
                              {staff.score}
                            </span>
                            <span className="text-xs font-bold text-gray-400">/ 100 đ</span>
                          </div>
                       </div>
                    </div>
                 ))
              )}
           </div>
        </Card>
      </div>

    </div>
  );
}
