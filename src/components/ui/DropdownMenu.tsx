import { ReactNode, useState, useRef, useEffect } from "react";
import { cn } from "../../lib/utils";

interface DropdownMenuProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
}

export default function DropdownMenu({
  trigger,
  children,
  align = "right",
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleCloseMenu = () => {
      setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("close-menu", handleCloseMenu);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("close-menu", handleCloseMenu);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>
      {isOpen && (
        <div
          className={cn(
            "absolute z-50 mt-1 min-w-[160px] rounded-md border border-gray-200 bg-white shadow-lg",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          <div className="py-1">{children}</div>
        </div>
      )}
    </div>
  );
}

interface DropdownMenuItemProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function DropdownMenuItem({
  children,
  onClick,
  className,
}: DropdownMenuItemProps) {
  const handleClick = () => {
    onClick?.();
    // 通知父组件关闭菜单（通过事件冒泡）
    const event = new Event("close-menu", { bubbles: true });
    document.dispatchEvent(event);
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "px-4 py-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors",
        className
      )}
    >
      {children}
    </div>
  );
}

