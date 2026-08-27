import React from "react";

export default function PageHeader({
  title,
  actions,
}: {
  title: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="topbar">
      <h1>{title}</h1>
      <div style={{ display: "flex", gap: 10 }}>{actions}</div>
    </div>
  );
}
