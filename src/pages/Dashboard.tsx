import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { cn } from "../lib/utils";

interface DashboardStats {
  total_notes: number;
  due_reviews: number;
  today_reviewed: number;
  avg_ease_factor: number;
}

interface HeatmapData {
  date: string;
  count: number;
}

// 简单的热力图组件
function Heatmap({ data }: { data: HeatmapData[] }) {
  // 生成过去365天的日期数组
  const generateDateRange = () => {
    const dates: string[] = [];
    const today = new Date();
    for (let i = 364; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split("T")[0]);
    }
    return dates;
  };

  const dateRange = generateDateRange();
  
  // 创建数据映射
  const dataMap = new Map<string, number>();
  data.forEach((item) => {
    dataMap.set(item.date, item.count);
  });

  // 计算最大值（用于颜色强度）
  const maxCount = Math.max(...Array.from(dataMap.values()), 1);

  // 获取颜色强度（0-4）
  const getIntensity = (count: number): number => {
    if (count === 0) return 0;
    if (count <= maxCount * 0.25) return 1;
    if (count <= maxCount * 0.5) return 2;
    if (count <= maxCount * 0.75) return 3;
    return 4;
  };

  // 获取颜色
  const getColor = (intensity: number): string => {
    const colors = [
      "bg-gray-100", // 0
      "bg-green-200", // 1
      "bg-green-400", // 2
      "bg-green-600", // 3
      "bg-green-800", // 4
    ];
    return colors[intensity] || colors[0];
  };

  // 按周分组（52周 + 1-2天）
  // GitHub 风格：每周从周日开始，按列显示
  const weeks: string[][] = [];
  let currentWeek: string[] = [];
  
  dateRange.forEach((date, index) => {
    const day = new Date(date + "T00:00:00").getDay(); // 使用本地时间
    currentWeek.push(date);
    
    // 如果是周六（一周的最后一天），开始新的一周
    if (day === 6 || index === dateRange.length - 1) {
      weeks.push([...currentWeek]);
      currentWeek = [];
    }
  });
  
  // 确保第一周从周日开始（如果第一天不是周日，前面补空）
  if (weeks.length > 0 && weeks[0].length > 0) {
    const firstDate = new Date(weeks[0][0] + "T00:00:00");
    const firstDay = firstDate.getDay();
    if (firstDay !== 0) {
      // 前面补空
      const emptyDays = Array.from({ length: firstDay }, () => "");
      weeks[0] = [...emptyDays, ...weeks[0]];
    }
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1 min-w-max">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-1">
            {week.map((date, dayIndex) => {
              if (!date) {
                // 空日期（第一周前面补的空）
                return <div key={`empty-${dayIndex}`} className="w-3 h-3" />;
              }
              const count = dataMap.get(date) || 0;
              const intensity = getIntensity(count);
              return (
                <div
                  key={date}
                  className={cn(
                    "w-3 h-3 rounded-sm cursor-pointer hover:ring-2 hover:ring-gray-400 transition-all",
                    getColor(intensity)
                  )}
                  title={`${date}: ${count} 次活动`}
                />
              );
            })}
            {/* 填充到7天（如果不足） */}
            {week.length < 7 && (
              <>
                {Array.from({ length: 7 - week.length }).map((_, i) => (
                  <div key={`empty-end-${i}`} className="w-3 h-3" />
                ))}
              </>
            )}
          </div>
        ))}
      </div>
      {/* 图例 */}
      <div className="flex items-center gap-2 mt-4 text-xs text-gray-600">
        <span>较少</span>
        <div className="flex gap-1">
          <div className="w-3 h-3 rounded-sm bg-gray-100" />
          <div className="w-3 h-3 rounded-sm bg-green-200" />
          <div className="w-3 h-3 rounded-sm bg-green-400" />
          <div className="w-3 h-3 rounded-sm bg-green-600" />
          <div className="w-3 h-3 rounded-sm bg-green-800" />
        </div>
        <span>较多</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 并行加载统计数据 and 热力图数据
      const [statsResult, heatmapResult] = await Promise.all([
        invoke<DashboardStats>("get_dashboard_stats"),
        invoke<HeatmapData[]>("get_heatmap_data"),
      ]);

      setStats(statsResult);
      setHeatmapData(heatmapResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载数据失败");
      console.error("加载仪表盘数据失败:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  // 计算记忆健康度百分比（ease_factor 范围通常是 1.3-2.5，我们将其映射到 0-100%）
  // 假设 2.5 是满分，1.3 是最低分
  const minEaseFactor = 1.3;
  const maxEaseFactor = 2.5;
  const healthPercentage = Math.min(
    100,
    Math.max(
      0,
      ((stats.avg_ease_factor - minEaseFactor) / (maxEaseFactor - minEaseFactor)) * 100
    )
  );

  return (
    <div className="p-8 space-y-8">
      {/* 标题 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">仪表盘</h1>
        <p className="text-gray-600 mt-2">数据概览和复习统计</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              总笔记数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-gray-900">
              {stats.total_notes.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-2">所有笔记总数</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              待复习项
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-gray-900">
              {stats.due_reviews.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-2">需要复习的笔记</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              今日已复习
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-gray-900">
              {stats.today_reviewed.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-2">今天完成的复习</p>
          </CardContent>
        </Card>
      </div>

      {/* 复习热力图 */}
      <Card>
        <CardHeader>
          <CardTitle>复习活跃度</CardTitle>
          <p className="text-sm text-gray-600 mt-1">
            过去 365 天的笔记创建和复习活动
          </p>
        </CardHeader>
        <CardContent>
          <Heatmap data={heatmapData} />
        </CardContent>
      </Card>

      {/* 记忆健康度 */}
      <Card>
        <CardHeader>
          <CardTitle>记忆健康度</CardTitle>
          <p className="text-sm text-gray-600 mt-1">
            基于平均记忆容易度 (ease_factor)
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-gray-900">
                {stats.avg_ease_factor.toFixed(2)}
              </span>
              <span className="text-sm text-gray-600">
                {healthPercentage.toFixed(0)}%
              </span>
            </div>
            {/* 进度条 */}
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-500",
                  healthPercentage >= 80
                    ? "bg-green-600"
                    : healthPercentage >= 60
                    ? "bg-yellow-500"
                    : healthPercentage >= 40
                    ? "bg-orange-500"
                    : "bg-red-500"
                )}
                style={{ width: `${healthPercentage}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">
              平均 ease_factor: {stats.avg_ease_factor.toFixed(2)} (范围: 1.3 - 2.5)
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
