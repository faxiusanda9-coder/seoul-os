import type { ReactNode } from "react";

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  note,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  note?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {subtitle && <p className="section-subtitle">{subtitle}</p>}
        {note && <p className="section-note">{note}</p>}
      </div>
      {action && <div className="section-action">{action}</div>}
    </div>
  );
}
