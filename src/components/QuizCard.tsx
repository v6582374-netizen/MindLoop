import { useState } from "react";

interface QuizQuestion {
  id: number;
  type: "choice" | "qa";
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

interface QuizCardProps {
  question: QuizQuestion;
  onNext: () => void;
  isLast: boolean;
}

export default function QuizCard({ question, onNext, isLast }: QuizCardProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const handleAnswer = (answer: string) => {
    if (selectedAnswer !== null) return; // 已经答过了

    setSelectedAnswer(answer);
    
    // 判断答案是否正确
    let correct = false;
    if (question.type === "choice") {
      // 选择题：直接比较选项标签
      correct = answer.trim().toUpperCase() === question.answer.trim().toUpperCase();
    } else {
      // 简答题：比较答案文本（不区分大小写，去除首尾空格）
      const userAnswer = answer.trim().toLowerCase();
      const correctAnswer = question.answer.trim().toLowerCase();
      // 允许部分匹配或完全匹配
      correct = userAnswer === correctAnswer || correctAnswer.includes(userAnswer) || userAnswer.includes(correctAnswer);
    }
    
    setIsCorrect(correct);
    setShowExplanation(true);
  };

  const handleNext = () => {
    setSelectedAnswer(null);
    setShowExplanation(false);
    setIsCorrect(null);
    onNext();
  };

  const getOptionLabel = (index: number) => {
    return String.fromCharCode(65 + index); // A, B, C, D
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-8 max-w-3xl mx-auto">
      {/* 题目类型标签 */}
      <div className="mb-4">
        <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
          question.type === "choice" 
            ? "bg-blue-100 text-blue-800" 
            : "bg-purple-100 text-purple-800"
        }`}>
          {question.type === "choice" ? "选择题" : "简答题"}
        </span>
        <span className="ml-2 text-sm text-gray-500">题目 ID: {question.id}</span>
      </div>

      {/* 题目内容 */}
      <h3 className="text-xl font-bold text-gray-800 mb-6 leading-relaxed">
        {question.question}
      </h3>

      {/* 选择题选项 */}
      {question.type === "choice" && question.options.length > 0 && (
        <div className="space-y-3 mb-6">
          {question.options.map((option, index) => {
            const optionLabel = getOptionLabel(index);
            const isSelected = selectedAnswer === optionLabel;
            const isAnswer = optionLabel === question.answer.trim().toUpperCase();
            const showAsCorrect = showExplanation && isAnswer;
            const showAsWrong = showExplanation && isSelected && !isAnswer;

            return (
              <button
                key={index}
                onClick={() => handleAnswer(optionLabel)}
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

      {/* 简答题输入框 */}
      {question.type === "qa" && (
        <div className="mb-6">
          <textarea
            id={`qa-input-${question.id}`}
            placeholder="请输入您的答案..."
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
            rows={4}
            disabled={selectedAnswer !== null}
          />
          {selectedAnswer === null && (
            <button
              onClick={() => {
                const textarea = document.getElementById(`qa-input-${question.id}`) as HTMLTextAreaElement;
                if (textarea && textarea.value.trim()) {
                  handleAnswer(textarea.value.trim());
                } else {
                  alert("请输入答案");
                }
              }}
              className="mt-3 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              提交答案
            </button>
          )}
          {selectedAnswer !== null && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">您的答案：</p>
              <p className="text-gray-800">{selectedAnswer}</p>
            </div>
          )}
        </div>
      )}

      {/* 解析区域 */}
      {showExplanation && (
        <div className={`mt-6 p-4 rounded-lg ${
          isCorrect ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
        }`}>
          <div className="flex items-start mb-2">
            <span className={`text-2xl mr-2 ${isCorrect ? "text-green-600" : "text-red-600"}`}>
              {isCorrect ? "✓" : "✗"}
            </span>
            <div>
              <p className={`font-bold ${isCorrect ? "text-green-800" : "text-red-800"}`}>
                {isCorrect ? "回答正确！" : "回答错误"}
              </p>
              {!isCorrect && (
                <p className="text-sm text-gray-600 mt-1">
                  正确答案是: <span className="font-bold">{question.answer}</span>
                </p>
              )}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-1">解析：</p>
            <p className="text-gray-600 leading-relaxed">{question.explanation}</p>
          </div>
        </div>
      )}

      {/* 下一题按钮 */}
      {showExplanation && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleNext}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            {isLast ? "完成" : "下一题"}
          </button>
        </div>
      )}
    </div>
  );
}

