import * as React from "react";

type CardShellProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

export function CardShell({ title, subtitle, children, footer, className }: CardShellProps) {
  return (
    <div
      className={[
        "w-full rounded-[28px] border border-white/10",
        "bg-gradient-to-b from-white/[0.06] to-white/[0.03]",
        "shadow-[0_20px_60px_rgba(0,0,0,0.55)]",
        "backdrop-blur-xl",
        className || "",
      ].join(" ")}
    >
      <div className="p-7">
        <div className="mb-6">
          <h3 className="text-[22px] font-semibold tracking-tight text-white">{title}</h3>
          {subtitle ? <p className="mt-1 text-[13px] leading-relaxed text-white/55">{subtitle}</p> : null}
        </div>
        {children}
        {footer ? <div className="mt-7">{footer}</div> : null}
      </div>
    </div>
  );
}


