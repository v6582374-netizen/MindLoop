import { HTMLAttributes, forwardRef, useState, useRef, useEffect, useCallback } from "react";
import { cn } from "../../lib/utils";
import Input from "./Input";

export interface DateRange {
  start: Date | null;
  end: Date | null;
}

export interface DatePickerProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  value?: DateRange;
  onChange?: (range: DateRange) => void;
  disabled?: boolean;
}

const DatePicker = forwardRef<HTMLDivElement, DatePickerProps>(
  ({ className, value, onChange, disabled = false, ...props }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [internalRange, setInternalRange] = useState<DateRange>({ start: null, end: null });
    // 使用可变对象来存储 DOM 节点引用，避免只读问题
    const containerRefObj = useRef<{ element: HTMLDivElement | null }>({ element: null });
    
    const range = value || internalRange;
    
    const formatDate = (date: Date | null): string => {
      if (!date) return "";
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    
    const parseDate = (str: string): Date | null => {
      if (!str) return null;
      const date = new Date(str);
      return isNaN(date.getTime()) ? null : date;
    };
    
    const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newStart = parseDate(e.target.value);
      const newRange = { ...range, start: newStart };
      if (value === undefined) {
        setInternalRange(newRange);
      }
      onChange?.(newRange);
    };
    
    const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newEnd = parseDate(e.target.value);
      const newRange = { ...range, end: newEnd };
      if (value === undefined) {
        setInternalRange(newRange);
      }
      onChange?.(newRange);
    };
    
    // 合并 ref：同时设置 containerRef 和传入的 ref
    const setRefs = useCallback((node: HTMLDivElement | null) => {
      containerRefObj.current.element = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    }, [ref]);
    
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        const element = containerRefObj.current.element;
        if (element && !element.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      
      if (isOpen) {
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
          document.removeEventListener("mousedown", handleClickOutside);
        };
      }
    }, [isOpen]);
    
    return (
      <div ref={setRefs} className={cn("relative", className)} {...props}>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">开始日期</label>
            <Input
              type="date"
              value={formatDate(range.start)}
              onChange={handleStartDateChange}
              disabled={disabled}
              className="w-full"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">结束日期</label>
            <Input
              type="date"
              value={formatDate(range.end)}
              onChange={handleEndDateChange}
              disabled={disabled}
              min={range.start ? formatDate(range.start) : undefined}
              className="w-full"
            />
          </div>
        </div>
      </div>
    );
  }
);

DatePicker.displayName = "DatePicker";

export default DatePicker;

