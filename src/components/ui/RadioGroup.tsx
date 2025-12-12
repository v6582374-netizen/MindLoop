import { HTMLAttributes, createContext, useContext, forwardRef } from "react";
import { cn } from "../../lib/utils";

interface RadioGroupContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const RadioGroupContext = createContext<RadioGroupContextValue | undefined>(undefined);

export interface RadioGroupProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  onValueChange: (value: string) => void;
}

const RadioGroup = forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, value, onValueChange, ...props }, ref) => {
    return (
      <RadioGroupContext.Provider value={{ value, onValueChange }}>
        <div
          ref={ref}
          className={cn("space-y-2", className)}
          role="radiogroup"
          {...props}
        />
      </RadioGroupContext.Provider>
    );
  }
);

RadioGroup.displayName = "RadioGroup";

export interface RadioGroupItemProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  label: string;
}

const RadioGroupItem = forwardRef<HTMLDivElement, RadioGroupItemProps>(
  ({ className, value: itemValue, label, ...props }, ref) => {
    const context = useContext(RadioGroupContext);
    if (!context) {
      throw new Error("RadioGroupItem must be used within RadioGroup");
    }

    const { value, onValueChange } = context;
    const isSelected = value === itemValue;

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center space-x-2 cursor-pointer",
          className
        )}
        onClick={() => onValueChange(itemValue)}
        {...props}
      >
        <div
          className={cn(
            "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors",
            isSelected
              ? "border-gray-900 bg-gray-900"
              : "border-gray-300 bg-white hover:border-gray-400"
          )}
        >
          {isSelected && (
            <div className="w-2 h-2 rounded-full bg-white" />
          )}
        </div>
        <label className="text-sm font-medium text-gray-700 cursor-pointer">
          {label}
        </label>
      </div>
    );
  }
);

RadioGroupItem.displayName = "RadioGroupItem";

export { RadioGroup, RadioGroupItem };

