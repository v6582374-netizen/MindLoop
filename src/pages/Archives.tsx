import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogHeader, DialogContent } from "../components/ui/Dialog";
import { Calendar, Clock, ChevronRight, Trophy, Filter } from "lucide-react";
import { cn } from "../lib/utils";

interface QuizSession {
  id: number;
  created_at: number;
  score: number;
  total_questions: number;
  content_json: string;
}

interface QuizQuestion {
  id: number;
  type: "choice" | "qa";
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

interface GroupedSessions {
  date: string;
  displayDate: string;
  sessions: QuizSession[];
}

export default function Archives() {
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 日期筛选
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  
  // 详情弹窗
  const [selectedSession, setSelectedSession] = useState<QuizSession | null>(null);
  const [parsedQuestions, setParsedQuestions] = useState<QuizQuestion[]>([]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params: { startTime?: number; endTime?: number; limit?: number } = {
        limit: 100,
      };
      
      if (startDate) {
        params.startTime = Math.floor(new Date(startDate).getTime() / 1000);
      }
      if (endDate) {
        // 设置为当天结束
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        params.endTime = Math.floor(end.getTime() / 1000);
      }
      
      const result = await invoke<QuizSession[]>("get_quiz_sessions", params);
      setSessions(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载历史记录失败");
      console.error("加载历史记录失败:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  // 按日期分组
  const groupedSessions: GroupedSessions[] = (() => {
    const groups = new Map<string, QuizSession[]>();
    
    sessions.forEach(session => {
      const date = new Date(session.created_at * 1000);
      const dateKey = date.toISOString().split('T')[0];
      
      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(session);
    });
    
    return Array.from(groups.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, sessions]) => {
        const d = new Date(date);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        let displayDate: string;
        if (d.toDateString() === today.toDateString()) {
          displayDate = "今天";
        } else if (d.toDateString() === yesterday.toDateString()) {
          displayDate = "昨天";
        } else {
          displayDate = d.toLocaleDateString("zh-CN", {
            month: "long",
            day: "numeric",
            weekday: "short",
          });
        }
        
        return { date, displayDate, sessions };
      });
  })();

  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleViewSession = (session: QuizSession) => {
    setSelectedSession(session);
    try {
      const questions = JSON.parse(session.content_json) as QuizQuestion[];
      setParsedQuestions(questions);
    } catch {
      setParsedQuestions([]);
    }
  };

  const handleFilter = () => {
    loadSessions();
  };

  const handleClearFilter = () => {
    setStartDate("");
    setEndDate("");
    setTimeout(loadSessions, 0);
  };

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
            onClick={loadSessions}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">复习历史</h1>
        <p className="text-slate-500 mt-1">回顾你的学习轨迹</p>
      </div>

      {/* 日期筛选器 */}
      <div className="mb-6 p-4 bg-white rounded-xl border border-slate-200/60 shadow-soft">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-600">日期范围</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200/60 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            <span className="text-slate-400">至</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200/60 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleFilter}
              className="px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              筛选
            </button>
            {(startDate || endDate) && (
              <button
                onClick={handleClearFilter}
                className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                清除
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 时间轴 */}
      {groupedSessions.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500">暂无复习记录</p>
          <p className="text-slate-400 text-sm mt-1">完成复习后，记录会显示在这里</p>
        </div>
      ) : (
        <div className="relative">
          {/* 时间轴线 */}
          <div className="absolute left-[7px] top-0 bottom-0 w-0.5 bg-slate-200" />
          
          <div className="space-y-8">
            {groupedSessions.map((group) => (
              <div key={group.date} className="relative">
                {/* 日期节点 */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-4 h-4 rounded-full bg-indigo-500 border-4 border-white shadow-sm z-10" />
                  <h3 className="text-sm font-semibold text-slate-700">
                    {group.displayDate}
                  </h3>
                </div>
                
                {/* 当天的复习卡片 */}
                <div className="ml-8 space-y-3">
                  <AnimatePresence>
                    {group.sessions.map((session) => (
                      <motion.div
                        key={session.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="group p-4 bg-white rounded-xl border border-slate-200/60 shadow-soft hover:shadow-soft-md transition-all cursor-pointer"
                        onClick={() => handleViewSession(session)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                              <Trophy className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-700">
                                复习测验
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span className="text-xs text-slate-400">
                                  {formatTime(session.created_at)}
                                </span>
                                {session.total_questions > 0 && (
                                  <>
                                    <span className="text-slate-300">·</span>
                                    <span className="text-xs text-slate-400">
                                      {session.total_questions} 道题
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 详情弹窗 */}
      <Dialog 
        open={!!selectedSession} 
        onClose={() => setSelectedSession(null)}
      >
        <DialogHeader onClose={() => setSelectedSession(null)}>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-indigo-600" />
            复习详情
          </div>
        </DialogHeader>
        <DialogContent className="max-h-[60vh] overflow-y-auto">
          {parsedQuestions.length === 0 ? (
            <p className="text-slate-500 text-center py-8">无法解析题目内容</p>
          ) : (
            <div className="space-y-6">
              {parsedQuestions.map((q, index) => (
                <div key={q.id} className="p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium flex items-center justify-center">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 mb-2">
                        {q.question}
                      </p>
                      
                      {/* 选择题选项 */}
                      {q.type === "choice" && q.options.length > 0 && (
                        <div className="space-y-1.5 mb-3">
                          {q.options.map((opt, i) => {
                            const letter = String.fromCharCode(65 + i);
                            const isAnswer = q.answer === letter;
                            return (
                              <div
                                key={i}
                                className={cn(
                                  "px-3 py-1.5 rounded-md text-sm",
                                  isAnswer
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-white text-slate-600 border border-slate-200"
                                )}
                              >
                                <span className="font-medium">{letter}.</span> {opt}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      
                      {/* 简答题答案 */}
                      {q.type === "qa" && (
                        <div className="mb-3 p-3 bg-emerald-50 rounded-md border border-emerald-200">
                          <p className="text-xs text-emerald-600 font-medium mb-1">参考答案</p>
                          <p className="text-sm text-emerald-700">{q.answer}</p>
                        </div>
                      )}
                      
                      {/* 解析 */}
                      {q.explanation && (
                        <div className="p-3 bg-amber-50 rounded-md border border-amber-200">
                          <p className="text-xs text-amber-600 font-medium mb-1">解析</p>
                          <p className="text-sm text-amber-700">{q.explanation}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

