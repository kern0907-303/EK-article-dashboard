"use client";

import React from "react";
import { Loader2 } from "lucide-react";

/**
 * 全站統一按鈕。
 * 樣式只有 5 種（variant）、2 種尺寸（size），新的按鈕一律用這個，不要再自己調 px / 字級 / 圓角。
 * - primary   主要動作（每個區塊最多一個，例如「發布」）
 * - secondary 次要動作（例如「生成配圖」「排程」）
 * - ghost     輕量動作（例如「複製」「流量分析」）
 * - success   已完成狀態
 * - danger    失敗或危險動作
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "success" | "danger";
export type ButtonSize = "md" | "sm";

const BASE =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-bold border transition-colors duration-200 cursor-pointer select-none " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const SIZES: Record<ButtonSize, string> = {
  md: "h-9 px-3 text-xs",
  sm: "h-7 px-2.5 text-[11px]",
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-blue-600 hover:bg-blue-500 text-white border-blue-500/40",
  secondary: "bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700",
  ghost: "bg-transparent hover:bg-slate-800/70 text-slate-400 hover:text-slate-100 border-transparent",
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  danger: "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 為 true 時顯示轉圈並停用按鈕 */
  loading?: boolean;
  /** 放在文字前面的圖示 */
  icon?: React.ReactNode;
  /** 選取中的狀態（用於分段切換，例如「預覽 / 編輯」） */
  active?: boolean;
}

export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", extra = ""): string {
  return `${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${extra}`.trim();
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading = false, icon, active, className = "", children, disabled, type = "button", ...rest },
  ref
) {
  const activeClass = active ? "!bg-slate-800 !text-slate-100 !border-slate-700" : "";
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={buttonClass(variant, size, `${activeClass} ${className}`)}
      {...rest}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : icon ? <span className="shrink-0 flex items-center">{icon}</span> : null}
      {children}
    </button>
  );
});

export default Button;
