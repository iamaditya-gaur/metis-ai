"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type DateRangeValue = {
  startDate: string;
  endDate: string;
};

type PresetId = "last-7" | "last-14" | "last-30" | "last-month" | "custom";

const PRESETS: { id: PresetId; label: string }[] = [
  { id: "last-7", label: "Last 7 days" },
  { id: "last-14", label: "Last 14 days" },
  { id: "last-30", label: "Last 30 days" },
  { id: "last-month", label: "Last month" },
  { id: "custom", label: "Custom" },
];

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

type Props = {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
  /**
   * The latest date Meta has data for. Defaults to yesterday — Meta insights
   * typically lag the current day. Used to clamp the calendar and to anchor
   * the preset ranges to a fully-available window.
   */
  maxDate?: string;
  id?: string;
  ariaLabel?: string;
};

function toIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromIso(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function defaultMaxDate(): string {
  const today = new Date();
  today.setDate(today.getDate() - 1);
  return toIso(today);
}

function addDays(date: Date, n: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + n);
  return next;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function presetRange(id: PresetId, maxIso: string): DateRangeValue | null {
  const maxDate = fromIso(maxIso);

  if (id === "last-7") {
    return { startDate: toIso(addDays(maxDate, -6)), endDate: maxIso };
  }
  if (id === "last-14") {
    return { startDate: toIso(addDays(maxDate, -13)), endDate: maxIso };
  }
  if (id === "last-30") {
    return { startDate: toIso(addDays(maxDate, -29)), endDate: maxIso };
  }
  if (id === "last-month") {
    const firstOfThisMonth = startOfMonth(maxDate);
    const lastOfLastMonth = addDays(firstOfThisMonth, -1);
    const firstOfLastMonth = startOfMonth(lastOfLastMonth);
    return {
      startDate: toIso(firstOfLastMonth),
      endDate: toIso(lastOfLastMonth),
    };
  }
  return null;
}

function matchPreset(value: DateRangeValue, maxIso: string): PresetId {
  for (const preset of PRESETS) {
    if (preset.id === "custom") continue;
    const range = presetRange(preset.id, maxIso);
    if (range && range.startDate === value.startDate && range.endDate === value.endDate) {
      return preset.id;
    }
  }
  return "custom";
}

function formatRangeLabel(value: DateRangeValue): string {
  if (!value.startDate || !value.endDate) return "Pick a reporting window";
  const start = fromIso(value.startDate);
  const end = fromIso(value.endDate);
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();

  if (sameMonth) {
    return `${SHORT_MONTHS[start.getMonth()]} ${start.getDate()} – ${end.getDate()}, ${end.getFullYear()}`;
  }
  if (sameYear) {
    return `${SHORT_MONTHS[start.getMonth()]} ${start.getDate()} – ${SHORT_MONTHS[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${SHORT_MONTHS[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()} – ${SHORT_MONTHS[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
}

type DayCell = {
  date: Date;
  iso: string;
  inMonth: boolean;
  disabled: boolean;
};

function buildMonthGrid(viewMonth: Date, maxIso: string): DayCell[] {
  const max = fromIso(maxIso);
  const first = startOfMonth(viewMonth);
  const last = endOfMonth(viewMonth);
  const leadingBlanks = first.getDay();
  const cells: DayCell[] = [];

  for (let i = leadingBlanks - 1; i >= 0; i--) {
    const date = addDays(first, -i - 1);
    cells.push({ date, iso: toIso(date), inMonth: false, disabled: date > max });
  }
  for (let d = 1; d <= last.getDate(); d++) {
    const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d);
    cells.push({ date, iso: toIso(date), inMonth: true, disabled: date > max });
  }
  while (cells.length % 7 !== 0) {
    const date = addDays(cells[cells.length - 1].date, 1);
    cells.push({ date, iso: toIso(date), inMonth: false, disabled: date > max });
  }
  return cells;
}

export function DateRangePicker({
  value,
  onChange,
  maxDate,
  id,
  ariaLabel = "Reporting window",
}: Props) {
  const generatedId = useId();
  const triggerId = id ?? `${generatedId}-trigger`;
  const popoverId = `${generatedId}-popover`;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const maxIso = maxDate ?? defaultMaxDate();
  const activePreset = useMemo(() => matchPreset(value, maxIso), [value, maxIso]);

  const initialViewMonth = useMemo(() => {
    const anchor = value.endDate ? fromIso(value.endDate) : fromIso(maxIso);
    return startOfMonth(anchor);
  }, [value.endDate, maxIso]);

  const [viewMonth, setViewMonth] = useState<Date>(initialViewMonth);
  const [pendingStartIso, setPendingStartIso] = useState<string | null>(null);
  const [hoverIso, setHoverIso] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setViewMonth(initialViewMonth);
      setPendingStartIso(null);
      setHoverIso(null);
    }
  }, [isOpen, initialViewMonth]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  const handlePresetClick = (id: PresetId) => {
    if (id === "custom") {
      setPendingStartIso(null);
      setHoverIso(null);
      return;
    }
    const range = presetRange(id, maxIso);
    if (range) {
      onChange(range);
      setIsOpen(false);
    }
  };

  const handleDayClick = (cell: DayCell) => {
    if (cell.disabled) return;
    if (!pendingStartIso) {
      setPendingStartIso(cell.iso);
      setHoverIso(null);
      return;
    }
    const pendingDate = fromIso(pendingStartIso);
    if (cell.date < pendingDate) {
      onChange({ startDate: cell.iso, endDate: pendingStartIso });
    } else {
      onChange({ startDate: pendingStartIso, endDate: cell.iso });
    }
    setPendingStartIso(null);
    setHoverIso(null);
    setIsOpen(false);
  };

  const goPrevMonth = () => {
    setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  };
  const goNextMonth = () => {
    setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
  };

  const days = buildMonthGrid(viewMonth, maxIso);
  const selectionStart = pendingStartIso ?? value.startDate;
  const selectionEnd = pendingStartIso
    ? hoverIso && hoverIso !== pendingStartIso
      ? hoverIso
      : pendingStartIso
    : value.endDate;

  const lowIso =
    selectionStart && selectionEnd
      ? selectionStart <= selectionEnd
        ? selectionStart
        : selectionEnd
      : selectionStart;
  const highIso =
    selectionStart && selectionEnd
      ? selectionStart <= selectionEnd
        ? selectionEnd
        : selectionStart
      : selectionEnd;

  const monthLabel = `${SHORT_MONTHS[viewMonth.getMonth()]} ${viewMonth.getFullYear()}`;
  const nextMonthDisabled = startOfMonth(addDays(endOfMonth(viewMonth), 1)) > fromIso(maxIso);

  return (
    <div className="date-range-picker" ref={containerRef}>
      <button
        type="button"
        id={triggerId}
        className="date-range-picker-trigger"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={popoverId}
        aria-label={ariaLabel}
        data-open={isOpen ? "true" : undefined}
        onClick={() => setIsOpen((open) => !open)}
      >
        <CalendarGlyph />
        <span className="date-range-picker-trigger-label">{formatRangeLabel(value)}</span>
        <ChevronGlyph open={isOpen} />
      </button>

      {isOpen ? (
        <div
          id={popoverId}
          role="dialog"
          aria-label={ariaLabel}
          className="date-range-picker-popover"
        >
          <ul className="date-range-picker-presets" role="listbox" aria-label="Preset windows">
            {PRESETS.map((preset) => {
              const isActive = activePreset === preset.id;
              return (
                <li key={preset.id}>
                  <button
                    type="button"
                    className="date-range-picker-preset"
                    role="option"
                    aria-selected={isActive}
                    data-active={isActive ? "true" : undefined}
                    onClick={() => handlePresetClick(preset.id)}
                  >
                    {preset.label}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="date-range-picker-calendar">
            <div className="date-range-picker-calendar-head">
              <button
                type="button"
                className="date-range-picker-nav"
                aria-label="Previous month"
                onClick={goPrevMonth}
              >
                <ChevronGlyph open={false} direction="left" />
              </button>
              <span className="date-range-picker-calendar-title">{monthLabel}</span>
              <button
                type="button"
                className="date-range-picker-nav"
                aria-label="Next month"
                onClick={goNextMonth}
                disabled={nextMonthDisabled}
              >
                <ChevronGlyph open={false} direction="right" />
              </button>
            </div>

            <div className="date-range-picker-weekdays" aria-hidden="true">
              {WEEKDAYS.map((d, i) => (
                <span key={`${d}-${i}`}>{d}</span>
              ))}
            </div>

            <div className="date-range-picker-days" role="grid">
              {days.map((cell) => {
                const inRange =
                  lowIso && highIso && cell.iso >= lowIso && cell.iso <= highIso;
                const isRangeStart = lowIso && cell.iso === lowIso;
                const isRangeEnd = highIso && cell.iso === highIso;
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    role="gridcell"
                    className="date-range-picker-day"
                    data-in-month={cell.inMonth ? "true" : "false"}
                    data-in-range={inRange ? "true" : undefined}
                    data-range-edge={
                      isRangeStart && isRangeEnd
                        ? "single"
                        : isRangeStart
                          ? "start"
                          : isRangeEnd
                            ? "end"
                            : undefined
                    }
                    aria-pressed={inRange ? true : undefined}
                    disabled={cell.disabled}
                    onClick={() => handleDayClick(cell)}
                    onMouseEnter={() => {
                      if (pendingStartIso) setHoverIso(cell.iso);
                    }}
                  >
                    {cell.date.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="date-range-picker-footer">
              <span className="date-range-picker-summary">
                {pendingStartIso
                  ? "Pick the end date"
                  : `${formatRangeLabel(value)}`}
              </span>
              <button
                type="button"
                className="date-range-picker-close"
                onClick={() => setIsOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CalendarGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <line x1="3.5" y1="9.5" x2="20.5" y2="9.5" />
      <line x1="8" y1="3" x2="8" y2="6.5" />
      <line x1="16" y1="3" x2="16" y2="6.5" />
    </svg>
  );
}

function ChevronGlyph({
  open,
  direction = "down",
}: {
  open: boolean;
  direction?: "down" | "left" | "right";
}) {
  let rotation = 0;
  if (direction === "left") rotation = 90;
  else if (direction === "right") rotation = -90;
  else if (open) rotation = 180;
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.85}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={rotation ? { transform: `rotate(${rotation}deg)` } : undefined}
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
