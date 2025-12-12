import { HTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/utils";

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number; // 当前值
  max: number; // 最大值
  showLabel?: boolean; // 是否显示标签
}

const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, max, showLabel = true, ...props }, ref) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));
    
    return (
      <div ref={ref} className={cn("w-full", className)} {...props}>
        {showLabel && (
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              第 {value} / {max} 题
            </span>
            <span className="text-sm text-gray-500">
              {Math.round(percentage)}%
            </span>
          </div>
        )}
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gray-900 transition-all duration-300 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }
);

Progress.displayName = "Progress";

export default Progress;

