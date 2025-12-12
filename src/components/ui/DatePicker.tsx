import { HTMLAttributes, forwardRef, useState, useRef, useEffect } from "react";
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
    const containerRef = useRef<HTMLDivElement>(null);
    
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
    
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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
      <div ref={containerRef} className={cn("relative", className)} {...props}>
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

