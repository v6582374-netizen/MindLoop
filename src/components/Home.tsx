import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import ReactMarkdown from "react-markdown";
import QuizCard from "./QuizCard";

interface QuizQuestion {
  id: number;
  type: "choice" | "qa";
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

type ReviewRange = "24h" | "3d" | "1w" | "all";

export default function Home() {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<"review" | "insights" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contentType, setContentType] = useState<"review" | "insights" | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [modelWarning, setModelWarning] = useState<string | null>(null);
  const [reviewRange, setReviewRange] = useState<ReviewRange>("24h");
  const [showReviewSettings, setShowReviewSettings] = useState(false);

  // 计算时间范围
  const calculateTimeRange = (range: ReviewRange): { startTime: number | null; endTime: number | null } => {
    const now = Math.floor(Date.now() / 1000); // 当前时间戳（秒）
    
    switch (range) {
      case "24h":
        return {
          startTime: now - 24 * 60 * 60, // 24 小时前
          endTime: now,
        };
      case "3d":
        return {
          startTime: now - 3 * 24 * 60 * 60, // 3 天前
          endTime: now,
        };
      case "1w":
        return {
          startTime: now - 7 * 24 * 60 * 60, // 1 周前
          endTime: now,
        };
      case "all":
        return {
          startTime: null, // null 表示不限制开始时间
          endTime: null,   // null 表示不限制结束时间
        };
      default:
        return {
          startTime: now - 24 * 60 * 60,
          endTime: now,
        };
    }
  };

  const handleGenerateReview = async () => {
    const apiKey = localStorage.getItem("openai_api_key") || "";
    const baseUrl = localStorage.getItem("openai_base_url") || "https://api.openai.com/v1";
    const savedModelName = localStorage.getItem("openai_model_name");
    const modelName = savedModelName || "gpt-3.5-turbo";

    if (!apiKey) {
      setError("请先在设置页面配置 API Key");
      return;
    }

    // 如果用户没有设置模型名称，使用默认值并提示
    if (!savedModelName) {
      console.warn("⚠️ [前端] 未检测到模型名称设置，使用默认值 gpt-3.5-turbo，建议前往设置页面配置");
      setModelWarning("正在使用默认模型 gpt-3.5-turbo，建议前往设置页面配置模型名称");
      setTimeout(() => setModelWarning(null), 5000); // 5秒后自动消失
    } else {
      setModelWarning(null);
    }

    // 计算时间范围
    const timeRange = calculateTimeRange(reviewRange);
    console.log("📅 [前端] 复习范围:", reviewRange, "时间范围:", timeRange);

    setLoading(true);
    setLoadingType("review");
    setError(null);
    setContent("");
    setContentType("review");
    setQuizQuestions([]);
    setCurrentQuestionIndex(0);

    try {
      console.log("🚀 [前端] 开始调用 generate_daily_review");
      console.log("📤 [前端] 传递的参数:", { 
        apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : "", 
        baseUrl, 
        modelName,
        startTime: timeRange.startTime,
        endTime: timeRange.endTime,
      });
      
      const result = await invoke<string>("generate_daily_review", {
        apiKey,
        baseUrl,
        modelName,
        startTime: timeRange.startTime,
        endTime: timeRange.endTime,
      });
      
      console.log("✅ [前端] invoke 调用成功，返回结果长度:", result.length);
      console.log("📄 [前端] 返回结果（前 500 字符）:", result.substring(0, 500));
      
      // 尝试解析为 JSON（题目数组）
      try {
        const questions: QuizQuestion[] = JSON.parse(result);
        console.log("✅ [前端] 成功解析题目数据:", questions);
        console.log("✅ [前端] 题目数量:", questions.length);
        setQuizQuestions(questions);
        setCurrentQuestionIndex(0);
        setContent(""); // 清空旧的 Markdown 内容
      } catch (parseError) {
        // 如果解析失败，可能是旧格式的文本，显示为 Markdown
        console.warn("⚠️ [前端] JSON 解析失败，显示为文本:", parseError);
        console.warn("⚠️ [前端] 解析错误详情:", parseError);
        if (parseError instanceof Error) {
          console.warn("⚠️ [前端] 错误名称:", parseError.name);
          console.warn("⚠️ [前端] 错误消息:", parseError.message);
          console.warn("⚠️ [前端] 错误堆栈:", parseError.stack);
        }
        setContent(result);
        setQuizQuestions([]);
      }
    } catch (err) {
      console.error("❌ [前端] ========== 错误详情 ==========");
      console.error("❌ [前端] 错误对象:", err);
      console.error("❌ [前端] 错误类型:", typeof err);
      console.error("❌ [前端] 错误是否为 Error 实例:", err instanceof Error);
      
      if (err instanceof Error) {
        console.error("❌ [前端] 错误名称:", err.name);
        console.error("❌ [前端] 错误消息:", err.message);
        console.error("❌ [前端] 错误堆栈:", err.stack);
      }
      
      // 尝试转换为字符串
      try {
        const errString = JSON.stringify(err, Object.getOwnPropertyNames(err));
        console.error("❌ [前端] 错误 JSON 字符串:", errString);
      } catch (stringifyError) {
        console.error("❌ [前端] 无法序列化错误对象:", stringifyError);
        console.error("❌ [前端] 错误 toString():", String(err));
      }
      
      console.error("❌ [前端] ========== 错误详情结束 ==========");
      
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      
      // 检查是否是常见的错误类型
      if (errorMessage.includes("API") || errorMessage.includes("api")) {
        setError("API 请求失败，请检查网络连接和 API Key 是否正确");
      } else if (errorMessage.includes("超时") || errorMessage.includes("timeout")) {
        setError("请求超时，请稍后重试");
      } else if (errorMessage.includes("没有未复习的笔记")) {
        setError("在选择的复习范围内没有未复习的笔记，请先使用快捷键保存一些笔记或调整复习范围");
      }
    } finally {
      setLoading(false);
      setLoadingType(null);
    }
  };

  const handleGenerateInsights = async () => {
    const apiKey = localStorage.getItem("openai_api_key") || "";
    const baseUrl = localStorage.getItem("openai_base_url") || "https://api.openai.com/v1";
    const savedModelName = localStorage.getItem("openai_model_name");
    const modelName = savedModelName || "gpt-3.5-turbo";

    if (!apiKey) {
      setError("请先在设置页面配置 API Key");
      return;
    }

    // 如果用户没有设置模型名称，使用默认值并提示
    if (!savedModelName) {
      console.warn("⚠️ [前端] 未检测到模型名称设置，使用默认值 gpt-3.5-turbo，建议前往设置页面配置");
      setModelWarning("正在使用默认模型 gpt-3.5-turbo，建议前往设置页面配置模型名称");
      setTimeout(() => setModelWarning(null), 5000); // 5秒后自动消失
    } else {
      setModelWarning(null);
    }

    setLoading(true);
    setLoadingType("insights");
    setError(null);
    setContent("");
    setContentType("insights");
    setQuizQuestions([]);

    try {
      console.log("🚀 [前端] 开始调用 generate_insights");
      console.log("📤 [前端] 传递的参数:", { apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : "", baseUrl, modelName });
      
      const result = await invoke<string>("generate_insights", {
        apiKey,
        baseUrl,
        modelName,
      });
      
      console.log("✅ [前端] invoke 调用成功，返回结果长度:", result.length);
      console.log("📄 [前端] 返回结果（前 500 字符）:", result.substring(0, 500));
      setContent(result);
    } catch (err) {
      console.error("❌ [前端] ========== 错误详情 ==========");
      console.error("❌ [前端] 错误对象:", err);
      console.error("❌ [前端] 错误类型:", typeof err);
      console.error("❌ [前端] 错误是否为 Error 实例:", err instanceof Error);
      
      if (err instanceof Error) {
        console.error("❌ [前端] 错误名称:", err.name);
        console.error("❌ [前端] 错误消息:", err.message);
        console.error("❌ [前端] 错误堆栈:", err.stack);
      }
      
      // 尝试转换为字符串
      try {
        const errString = JSON.stringify(err, Object.getOwnPropertyNames(err));
        console.error("❌ [前端] 错误 JSON 字符串:", errString);
      } catch (stringifyError) {
        console.error("❌ [前端] 无法序列化错误对象:", stringifyError);
        console.error("❌ [前端] 错误 toString():", String(err));
      }
      
      console.error("❌ [前端] ========== 错误详情结束 ==========");
      
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      
      // 检查是否是常见的错误类型
      if (errorMessage.includes("API") || errorMessage.includes("api")) {
        setError("API 请求失败，请检查网络连接和 API Key 是否正确");
      } else if (errorMessage.includes("超时") || errorMessage.includes("timeout")) {
        setError("请求超时，请稍后重试");
      } else if (errorMessage.includes("没有未复习的笔记")) {
        setError("没有未复习的笔记，请先使用快捷键保存一些笔记");
      }
    } finally {
      setLoading(false);
      setLoadingType(null);
    }
  };

  const handleMarkAsReviewed = async () => {
    setLoading(true);
    setError(null);

    try {
      const count = await invoke<number>("mark_notes_as_reviewed");
      alert(`已标记 ${count} 条笔记为已复习`);
      setContent("");
      setContentType(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "标记笔记失败");
      console.error("标记笔记失败:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* 复习范围设置面板 */}
      <div className="mb-6">
        <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
          {/* 折叠/展开按钮 */}
          <button
            onClick={() => setShowReviewSettings(!showReviewSettings)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">📅</span>
              <span className="font-medium text-gray-700">复习范围设置</span>
              <span className="text-sm text-gray-500 ml-2">
                {reviewRange === "24h" && "最近 24 小时"}
                {reviewRange === "3d" && "最近 3 天"}
                {reviewRange === "1w" && "最近 1 周"}
                {reviewRange === "all" && "所有未复习笔记"}
              </span>
            </div>
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform ${
                showReviewSettings ? "transform rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* 设置内容（可折叠） */}
          {showReviewSettings && (
            <div className="px-4 py-4 border-t border-gray-200 bg-gray-50">
              <div className="space-y-4">
                <div>
                  <label htmlFor="reviewRange" className="block text-sm font-medium text-gray-700 mb-2">
                    选择复习范围
                  </label>
                  <select
                    id="reviewRange"
                    value={reviewRange}
                    onChange={(e) => setReviewRange(e.target.value as ReviewRange)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all bg-white"
                  >
                    <option value="24h">最近 24 小时</option>
                    <option value="3d">最近 3 天</option>
                    <option value="1w">最近 1 周</option>
                    <option value="all">所有未复习笔记</option>
                  </select>
                  <p className="mt-2 text-xs text-gray-500">
                    {reviewRange === "24h" && "将基于最近 24 小时内创建的笔记生成复习题目"}
                    {reviewRange === "3d" && "将基于最近 3 天内创建的笔记生成复习题目"}
                    {reviewRange === "1w" && "将基于最近 1 周内创建的笔记生成复习题目"}
                    {reviewRange === "all" && "将基于所有未复习的笔记生成复习题目"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 按钮区域 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <button
          onClick={handleGenerateReview}
          disabled={loading}
          className={`px-8 py-12 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl shadow-lg transition-all ${
            loading && loadingType === "review"
              ? "opacity-60 cursor-not-allowed"
              : "hover:shadow-xl transform hover:scale-105"
          } disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none relative`}
        >
          <div className="text-center">
            {loading && loadingType === "review" ? (
              <>
                <div className="flex justify-center mb-3">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
                </div>
                <h3 className="text-2xl font-bold mb-2">正在思考中...</h3>
                <p className="text-indigo-100 text-sm">
                  AI 正在生成题目，请稍候
                </p>
              </>
            ) : (
              <>
                <div className="text-4xl mb-3">📝</div>
                <h3 className="text-2xl font-bold mb-2">生成今日试卷</h3>
                <p className="text-indigo-100 text-sm">
                  基于选定范围的笔记生成复习题目
                </p>
              </>
            )}
          </div>
        </button>

        <button
          onClick={handleGenerateInsights}
          disabled={loading}
          className={`px-8 py-12 bg-gradient-to-br from-blue-500 to-cyan-600 text-white rounded-xl shadow-lg transition-all ${
            loading && loadingType === "insights"
              ? "opacity-60 cursor-not-allowed"
              : "hover:shadow-xl transform hover:scale-105"
          } disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none relative`}
        >
          <div className="text-center">
            {loading && loadingType === "insights" ? (
              <>
                <div className="flex justify-center mb-3">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
                </div>
                <h3 className="text-2xl font-bold mb-2">正在思考中...</h3>
                <p className="text-blue-100 text-sm">
                  AI 正在分析笔记，请稍候
                </p>
              </>
            ) : (
              <>
                <div className="text-4xl mb-3">💡</div>
                <h3 className="text-2xl font-bold mb-2">获取思维启发</h3>
                <p className="text-blue-100 text-sm">
                  跨学科分析笔记间的联系
                </p>
              </>
            )}
          </div>
        </button>
      </div>

      {/* 模型警告提示 */}
      {modelWarning && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg p-4 mb-6 shadow-md">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm text-yellow-700">{modelWarning}</p>
            </div>
            <button
              onClick={() => setModelWarning(null)}
              className="ml-4 flex-shrink-0 text-yellow-400 hover:text-yellow-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-6 mb-6 shadow-md">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800 mb-1">出错了</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="ml-4 flex-shrink-0 text-red-400 hover:text-red-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* 题目卡片展示区域 */}
      {contentType === "review" && quizQuestions.length > 0 && !loading && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              📝 今日试卷
            </h2>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                第 {currentQuestionIndex + 1} / {quizQuestions.length} 题
              </span>
              {currentQuestionIndex === quizQuestions.length - 1 && (
                <button
                  onClick={handleMarkAsReviewed}
                  disabled={loading}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  完成复习
                </button>
              )}
            </div>
          </div>
          <QuizCard
            question={quizQuestions[currentQuestionIndex]}
            onNext={() => {
              if (currentQuestionIndex < quizQuestions.length - 1) {
                setCurrentQuestionIndex(currentQuestionIndex + 1);
              }
            }}
            isLast={currentQuestionIndex === quizQuestions.length - 1}
          />
        </div>
      )}

      {/* 思维启发或旧格式内容展示区域 */}
      {content && !loading && (contentType === "insights" || (contentType === "review" && quizQuestions.length === 0)) && (
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              {contentType === "review" ? "📝 今日试卷" : "💡 思维启发"}
            </h2>
            {contentType === "review" && (
              <button
                onClick={handleMarkAsReviewed}
                disabled={loading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                完成复习
              </button>
            )}
          </div>
          <div className="prose prose-indigo prose-lg max-w-none 
            prose-headings:font-bold prose-headings:text-gray-900
            prose-h1:text-3xl prose-h1:mb-4 prose-h1:mt-6
            prose-h2:text-2xl prose-h2:mb-3 prose-h2:mt-5
            prose-h3:text-xl prose-h3:mb-2 prose-h3:mt-4
            prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-4
            prose-strong:text-gray-900 prose-strong:font-semibold
            prose-ul:list-disc prose-ul:pl-6 prose-ul:mb-4
            prose-ol:list-decimal prose-ol:pl-6 prose-ol:mb-4
            prose-li:text-gray-700 prose-li:mb-2
            prose-blockquote:border-l-4 prose-blockquote:border-indigo-500 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-600
            prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
            prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto
            prose-a:text-indigo-600 prose-a:no-underline hover:prose-a:underline
            prose-img:rounded-lg prose-img:shadow-md">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* 空状态提示 */}
      {!content && !loading && !error && (
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <p className="text-gray-500 text-lg">
            点击上方按钮开始生成内容
          </p>
        </div>
      )}
    </div>
  );
}

