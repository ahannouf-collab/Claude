import type { ReactNode } from "react";

export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="field-row">{children}</div>;
}

export function Field({
  label,
  required,
  readOnly,
  children,
}: {
  label: string;
  required?: boolean;
  readOnly?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`field${readOnly ? " readonly" : ""}`}>
      <label>
        {label} {required && <span className="req">*</span>}
      </label>
      {children}
    </div>
  );
}

export function Callout({ children, variant }: { children: ReactNode; variant?: "error" | "info" }) {
  return <div className={`callout${variant ? ` ${variant}` : ""}`}>{children}</div>;
}
