import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { RadioGroup, RadioGroupItem } from "../components/ui/RadioGroup";
import Slider from "../components/ui/Slider";
import DatePicker, { DateRange } from "../components/ui/DatePicker";
import Button from "../components/ui/Button";
import Progress from "../components/ui/Progress";

type ReviewMode = "smart" | "custom";
type ReviewState = "config" | "session" | "loading" | "completed";

interface QuizQuestion {
  id: number;
  type: "choice" | "qa";
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  noteIds?: number[]; // 题目对应的笔记ID列表（可选，用于记忆反馈）
}

export default function Review() {
  const navigate = useNavigate();
  const [state, setState] = useState<ReviewState>("config");
  const [mode, setMode] = useState<ReviewMode>("smart");
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [questionCount, setQuestionCount] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [userAnswer, setUserAnswer] = useState<string>("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const handleStartReview = async () => {
    // 获取 API 配置
    const apiKey = localStorage.getItem("openai_api_key") || "";
    const baseUrl = localStorage.getItem("openai_base_url") || "https://api.openai.com/v1";
    const modelName = localStorage.getItem("openai_model_name") || "gpt-4o";

    if (!apiKey) {
      setError("请先在设置页面配置 API Key");
      return;
    }

    setError(null);
    setState("loading");

    try {
      let startTime: number | null = null;
      let endTime: number | null = null;

      // 根据模式设置时间范围
      if (mode === "custom") {
        if (dateRange.start) {
          startTime = Math.floor(dateRange.start.getTime() / 1000);
        }
        if (dateRange.end) {
          endTime = Math.floor(dateRange.end.getTime() / 1000);
        }
      }
      // 如果是智能推荐模式，不传递时间范围（后端会优先查询到期的笔记）

      console.log("🚀 [复习页面] 开始调用 generate_daily_review");
      console.log("📤 [复习页面] 传递的参数:", {
        apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : "",
        baseUrl,
        modelName,
        startTime,
        endTime,
      });

      const result = await invoke<string>("generate_daily_review", {
        apiKey,
        baseUrl,
        modelName,
        startTime: startTime || null,
        endTime: endTime || null,
      });

      console.log("✅ [复习页面] invoke 调用成功，返回结果长度:", result.length);

      // 尝试解析为 JSON（题目数组）
      try {
        const questions: QuizQuestion[] = JSON.parse(result);
        console.log("✅ [复习页面] 成功解析题目数据:", questions);
        console.log("✅ [复习页面] 题目数量:", questions.length);
        
        // 根据用户设置的题目数量限制
        const limitedQuestions = questions.slice(0, questionCount);
        setQuizQuestions(limitedQuestions);
        setCurrentQuestionIndex(0);
        setSelectedAnswer(null);
        setUserAnswer("");
        setShowAnswer(false);
        setShowExplanation(false);
        setIsCorrect(null);
        setState("session");
      } catch (parseError) {
        console.error("❌ [复习页面] JSON 解析失败:", parseError);
        setError("生成题目失败：返回的数据格式不正确");
        setState("config");
      }
    } catch (err) {
      console.error("❌ [复习页面] 生成复习题目失败:", err);
      setError(err instanceof Error ? err.message : "生成复习题目失败");
      setState("config");
    }
  };

  const currentQuestion = quizQuestions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === quizQuestions.length - 1;

  const handleChoiceAnswer = (optionLabel: string) => {
    if (selectedAnswer !== null) return; // 已经答过了

    setSelectedAnswer(optionLabel);
    const correct = optionLabel.trim().toUpperCase() === currentQuestion.answer.trim().toUpperCase();
    setIsCorrect(correct);
    setShowExplanation(true);
  };

  const handleQASubmit = () => {
    if (!userAnswer.trim()) {
      return;
    }
    setShowAnswer(true);
    // 简答题不自动判断对错，只显示参考答案
    setShowExplanation(true);
  };

  const handleViewAnswer = () => {
    setShowAnswer(true);
    setShowExplanation(true);
  };

  const handleFeedback = async (quality: number) => {
    // 更新笔记的复习状态
    // 注意：由于题目是从多个笔记生成的，我们需要更新所有相关的笔记
    // 目前暂时使用题目的 id 作为 note_id（这是一个临时方案）
    // 理想情况下，后端应该返回每个题目对应的 note_ids 列表
    const noteIds = currentQuestion.noteIds || [currentQuestion.id];
    
    try {
      // 更新所有相关的笔记
      for (const noteId of noteIds) {
        await invoke("update_review_status", {
          noteId: noteId,
          quality: quality,
        });
      }
      console.log(`✅ [复习页面] 记忆反馈已更新: quality=${quality}`);
    } catch (err) {
      console.error("❌ [复习页面] 更新记忆反馈失败:", err);
      // 即使更新失败，也继续下一题
    }

    // 切换到下一题
    if (isLastQuestion) {
      setState("completed");
    } else {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(null);
      setUserAnswer("");
      setShowAnswer(false);
      setShowExplanation(false);
      setIsCorrect(null);
    }
  };

  const getOptionLabel = (index: number) => {
    return String.fromCharCode(65 + index); // A, B, C, D
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">智能复习室</h1>
        <p className="text-gray-600 mt-2">根据间隔重复算法复习你的笔记</p>
      </div>

      {state === "config" && (
        <Card>
          <CardHeader>
            <CardTitle>开始今日复习</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 复习模式选择 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                复习模式
              </label>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as ReviewMode)}>
                <RadioGroupItem value="smart" label="智能推荐" />
                <p className="text-xs text-gray-500 ml-6 mt-1">
                  基于 SRS 算法，优先复习到期的笔记
                </p>
                <RadioGroupItem value="custom" label="特定范围" />
                <p className="text-xs text-gray-500 ml-6 mt-1">
                  自定义时间段，选择指定日期范围内的笔记
                </p>
              </RadioGroup>
            </div>

            {/* 时间范围选择器（仅当选 custom 时显示） */}
            {mode === "custom" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  时间范围
                </label>
                <DatePicker
                  value={dateRange}
                  onChange={setDateRange}
                />
              </div>
            )}

            {/* 题目数量滑块 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                题目数量
              </label>
              <Slider
                min={3}
                max={20}
                step={1}
                value={questionCount}
                onChange={setQuestionCount}
              />
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                {error}
              </div>
            )}

            {/* 开始按钮 */}
            <Button
              onClick={handleStartReview}
              size="lg"
              className="w-full"
            >
              开始复习
            </Button>
          </CardContent>
        </Card>
      )}

      {state === "loading" && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
              <p className="text-gray-600">正在生成复习题目...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {state === "session" && currentQuestion && (
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <div className="flex items-center justify-between mb-4">
              <CardTitle>刷题中</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setState("config");
                  setQuizQuestions([]);
                  setCurrentQuestionIndex(0);
                }}
              >
                返回配置
              </Button>
            </div>
            {/* 进度条 */}
            <Progress
              value={currentQuestionIndex + 1}
              max={quizQuestions.length}
            />
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 题目类型标签 */}
            <div>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                currentQuestion.type === "choice" 
                  ? "bg-blue-100 text-blue-800" 
                  : "bg-purple-100 text-purple-800"
              }`}>
                {currentQuestion.type === "choice" ? "选择题" : "简答题"}
              </span>
            </div>

            {/* 问题区 - 支持 Markdown */}
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{currentQuestion.question}</ReactMarkdown>
            </div>

            {/* 选择题选项 */}
            {currentQuestion.type === "choice" && currentQuestion.options.length > 0 && (
              <div className="space-y-3">
                {currentQuestion.options.map((option, index) => {
                  const optionLabel = getOptionLabel(index);
                  const isSelected = selectedAnswer === optionLabel;
                  const isAnswer = optionLabel === currentQuestion.answer.trim().toUpperCase();
                  const showAsCorrect = showExplanation && isAnswer;
                  const showAsWrong = showExplanation && isSelected && !isAnswer;

                  return (
                    <button
                      key={index}
                      onClick={() => handleChoiceAnswer(optionLabel)}
                      disabled={selectedAnswer !== null}
                      className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                        showAsCorrect
                          ? "bg-green-100 border-green-500 text-green-800"
                          : showAsWrong
                          ? "bg-red-100 border-red-500 text-red-800"
                          : isSelected
                          ? "bg-indigo-100 border-indigo-500 text-indigo-800"
                          : "bg-gray-50 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50"
                      } ${selectedAnswer !== null ? "cursor-default" : "cursor-pointer"}`}
                    >
                      <div className="flex items-center">
                        <span className="font-bold mr-3 w-8 text-center">
                          {optionLabel}.
                        </span>
                        <span>{option}</span>
                        {showAsCorrect && (
                          <span className="ml-auto text-green-600 font-bold">✓ 正确答案</span>
                        )}
                        {showAsWrong && (
                          <span className="ml-auto text-red-600 font-bold">✗ 错误</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* 简答题输入区 */}
            {currentQuestion.type === "qa" && (
              <div className="space-y-3">
                <textarea
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="请输入您的答案..."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
                  rows={4}
                  disabled={showAnswer}
                />
                {!showAnswer && (
                  <Button
                    onClick={handleQASubmit}
                    disabled={!userAnswer.trim()}
                    className="w-full"
                  >
                    查看答案
                  </Button>
                )}
                {showAnswer && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">您的答案：</p>
                    <p className="text-gray-800 mb-3">{userAnswer || "（未填写）"}</p>
                    <p className="text-sm text-gray-600 mb-1">参考答案：</p>
                    <p className="text-gray-800">{currentQuestion.answer}</p>
                  </div>
                )}
              </div>
            )}

            {/* 解析区域 */}
            {showExplanation && (
              <div className={`p-4 rounded-lg border ${
                currentQuestion.type === "choice"
                  ? isCorrect
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                  : "bg-blue-50 border-blue-200"
              }`}>
                <div className="flex items-start mb-2">
                  {currentQuestion.type === "choice" && (
                    <span className={`text-2xl mr-2 ${isCorrect ? "text-green-600" : "text-red-600"}`}>
                      {isCorrect ? "✓" : "✗"}
                    </span>
                  )}
                  <div className="flex-1">
                    {currentQuestion.type === "choice" && (
                      <p className={`font-bold ${isCorrect ? "text-green-800" : "text-red-800"}`}>
                        {isCorrect ? "回答正确！" : "回答错误"}
                      </p>
                    )}
                    {currentQuestion.type === "qa" && (
                      <p className="font-bold text-blue-800">已查看答案</p>
                    )}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-1">解析：</p>
                  <div className="prose prose-sm max-w-none text-gray-600">
                    <ReactMarkdown>{currentQuestion.explanation}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )}

            {/* 记忆反馈按钮组 */}
            {showExplanation && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">记忆反馈：</p>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => handleFeedback(0)}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    重来
                  </Button>
                  <Button
                    onClick={() => handleFeedback(1)}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white"
                  >
                    困难
                  </Button>
                  <Button
                    onClick={() => handleFeedback(3)}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    良好
                  </Button>
                  <Button
                    onClick={() => handleFeedback(5)}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    简单
                  </Button>
                </div>
                <p className="text-xs text-gray-500 text-center">
                  选择你的记忆程度，系统会根据 SRS 算法调整下次复习时间
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {state === "completed" && (
        <Card className="max-w-2xl mx-auto">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-6">
              <div className="text-6xl">🎉</div>
              <h2 className="text-3xl font-bold text-gray-900">复习完成！</h2>
              <p className="text-gray-600 text-center">
                你已经完成了本次复习，共 {quizQuestions.length} 道题目
              </p>
              <div className="flex gap-4 mt-6">
                <Button
                  onClick={() => {
                    setState("config");
                    setQuizQuestions([]);
                    setCurrentQuestionIndex(0);
                  }}
                  variant="outline"
                >
                  再来一次
                </Button>
                <Button
                  onClick={() => navigate("/")}
                  size="lg"
                >
                  返回仪表盘
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
