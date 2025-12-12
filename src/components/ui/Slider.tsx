import { HTMLAttributes, forwardRef, useState, useRef, useEffect, useCallback } from "react";
import { cn } from "../../lib/utils";

export interface SliderProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  min?: number;
  max?: number;
  step?: number;
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  disabled?: boolean;
}

const Slider = forwardRef<HTMLDivElement, SliderProps>(
  ({ className, min = 0, max = 100, step = 1, value: controlledValue, defaultValue = 0, onChange, disabled = false, ...props }, ref) => {
    const [internalValue, setInternalValue] = useState(defaultValue);
    const [isDragging, setIsDragging] = useState(false);
    const sliderRef = useRef<HTMLDivElement>(null);
    const onChangeRef = useRef(onChange);
    
    // 保持 onChange 引用最新
    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);
    
    const value = controlledValue !== undefined ? controlledValue : internalValue;
    
    const percentage = ((value - min) / (max - min)) * 100;
    
    const updateValue = useCallback((e: MouseEvent | React.MouseEvent<HTMLDivElement>) => {
      if (!sliderRef.current || disabled) return;
      
      const rect = sliderRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const newValue = Math.round((min + percentage * (max - min)) / step) * step;
      const clampedValue = Math.max(min, Math.min(max, newValue));
      
      if (controlledValue === undefined) {
        setInternalValue(clampedValue);
      }
      onChangeRef.current?.(clampedValue);
    }, [min, max, step, controlledValue, disabled]);
    
    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      setIsDragging(true);
      updateValue(e);
    }, [disabled, updateValue]);
    
    useEffect(() => {
      if (isDragging) {
        const handleMouseMove = (e: MouseEvent) => {
          updateValue(e);
        };
        
        const handleMouseUp = () => {
          setIsDragging(false);
        };
        
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        return () => {
          document.removeEventListener("mousemove", handleMouseMove);
          document.removeEventListener("mouseup", handleMouseUp);
        };
      }
    }, [isDragging, updateValue]);
    
    return (
      <div
        ref={ref}
        className={cn("w-full", className)}
        {...props}
      >
        <div
          ref={sliderRef}
          className={cn(
            "relative h-2 w-full rounded-full bg-gray-200 cursor-pointer",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          onMouseDown={handleMouseDown}
        >
          <div
            className="absolute h-full rounded-full bg-gray-900 transition-all"
            style={{ width: `${percentage}%` }}
          />
          <div
            className={cn(
              "absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-gray-900 shadow-sm transition-all hover:scale-110",
              disabled && "cursor-not-allowed"
            )}
            style={{ left: `calc(${percentage}% - 8px)` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-gray-500">
          <span>{min}</span>
          <span className="font-medium text-gray-900">{value}</span>
          <span>{max}</span>
        </div>
      </div>
    );
  }
);

Slider.displayName = "Slider";

export default Slider;

