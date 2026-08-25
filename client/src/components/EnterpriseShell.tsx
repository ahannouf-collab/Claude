import type { ReactNode } from "react";

export interface ToolbarButtonDef {
  key: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "danger";
  title?: string;
}

export interface EnterpriseShellProps {
  functionId: string;
  screenTitle: string;
  toolbar: ToolbarButtonDef[];
  tabs: { key: string; label: string }[];
  activeTab: string;
  onTabChange: (key: string) => void;
  footer: {
    recordStatus?: string;
    statusVariant?: "DRAFT" | "SUBMITTED" | "AUTHORIZED" | "view";
    maker?: string;
    checker?: string;
    version?: number | string;
    lastAction?: string;
  };
  children: ReactNode;
  user: string;
}

export function EnterpriseShell(props: EnterpriseShellProps) {
  const { functionId, screenTitle, toolbar, tabs, activeTab, onTabChange, footer, children, user } = props;
  const today = new Date().toLocaleDateString("fr-FR");

  return (
    <div className="eb-window">
      <div className="eb-brandbar">
        <div>
          <span className="oracle-logo">ORACLE</span>
          <span className="fcubs-name">FLEXCUBE Universal Banking</span>
        </div>
        <div className="meta">
          <span>Branch 001</span>
          <span>System Date {today}</span>
          <span>User {user}</span>
          <span>Function ID {functionId}</span>
        </div>
      </div>
      <div className="eb-menubar">
        <span>Menu</span>
        <span>Favorites</span>
        <span>Workflow</span>
        <span>Tasks</span>
        <span>Preferences</span>
        <span>Help</span>
        <span>Sign Off</span>
      </div>
      <div className="eb-toolbar">
        {toolbar.map((b) => (
          <button
            key={b.key}
            className={b.variant ?? ""}
            disabled={b.disabled}
            onClick={b.onClick}
            title={b.title}
          >
            {b.label}
          </button>
        ))}
      </div>
      <div className="eb-titlebar">
        <span>{screenTitle}</span>
        <span>{functionId}</span>
      </div>
      <div className="eb-tabs">
        {tabs.map((t) => (
          <button key={t.key} className={t.key === activeTab ? "active" : ""} onClick={() => onTabChange(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="eb-content">{children}</div>
      <div className="eb-footer">
        <div>
          {footer.recordStatus && (
            <>
              Record Status:{" "}
              <span className={`status-pill status-${footer.statusVariant ?? "view"}`}>{footer.recordStatus}</span>
            </>
          )}
        </div>
        <div>
          Maker: {footer.maker ?? "-"} | Checker: {footer.checker ?? "-"} | Version: {footer.version ?? "-"} | Last
          Action: {footer.lastAction ?? "-"}
        </div>
      </div>
    </div>
  );
}
