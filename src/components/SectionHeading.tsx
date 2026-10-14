import type { ReactNode } from "react";

export function SectionHeading({
  eyebrow,
  title,
  note,
  action,
}: {
  eyebrow: string;
  title: string;
  note?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {note && <p className="section-note">{note}</p>}
      </div>
      {action && <div className="section-action">{action}</div>}
    </div>
  );
}
