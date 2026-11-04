import { useCallback, useRef, useState } from "react";
import { Check } from "lucide-react";
import { rowHeights, type RowHeight } from "./TicketTable";
import { useDismiss } from "./lib/useDismiss";

/** The toolbar button that sets how tall the ticket rows are, Airtable-style. */
export default function RowHeightMenu({ value, onChange }: { value: RowHeight; onChange: (value: RowHeight) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  const Current = rowHeights.find((item) => item.key === value)?.icon ?? rowHeights[0].icon;
  return (
    <div className="row-height" ref={ref}>
      <button type="button" className="row-height-button" aria-label="Row height" title="Row height" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <Current size={15} />
      </button>
      {open && (
        <div className="popover-menu row-height-menu" role="menu">
          {rowHeights.map(({ key, label, icon: Icon }) => (
            <button key={key} type="button" role="menuitemradio" aria-checked={key === value} onClick={() => { onChange(key); close(); }}>
              <Icon size={15} />
              <span>{label}</span>
              {key === value && <Check size={14} className="popover-check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
