import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { createPortal } from 'react-dom';
import type { Locale } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { format } from 'date-fns';
import 'react-day-picker/style.css';

interface DateRangePickerProps {
  from: Date | null;
  to: Date | null;
  onChange: (range: { from: Date | null; to: Date | null }) => void;
  minDate?: Date;
  maxDate?: Date;
  placeholderText?: string;
  className?: string;
  wrapperClassName?: string;
  disabled?: boolean;
  locale?: Locale;
}

const DATE_FORMAT = 'dd/MM/yyyy';
const DAY_PICKER_GREEN_THEME = {
  '--rdp-accent-color': '#0f5132',
  '--rdp-accent-background-color': '#dcefe5',
  '--rdp-range_middle-background-color': '#dcefe5',
  '--rdp-range_middle-color': '#0f5132',
  '--rdp-selected-border': '2px solid #0f5132',
} as React.CSSProperties;

const formatRangeLabel = (from: Date | null, to: Date | null, locale: Locale): string => {
  if (!from && !to) return '';
  if (from && to) return `${format(from, DATE_FORMAT, { locale })} - ${format(to, DATE_FORMAT, { locale })}`;
  if (from) return `${format(from, DATE_FORMAT, { locale })} - ...`;
  return '';
};

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  from,
  to,
  onChange,
  minDate,
  maxDate,
  placeholderText = 'Rango (dd/mm/yyyy - dd/mm/yyyy)',
  className = '',
  wrapperClassName = '',
  disabled = false,
  locale = es,
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<Date>(from ?? new Date());
  const fromTs = from ? from.getTime() : null;

  useEffect(() => {
    if (fromTs !== null) setMonth(new Date(fromTs));
  }, [fromTs]);

  useEffect(() => {
    const onDocMouseDown = (ev: globalThis.MouseEvent): void => {
      const target = ev.target as Node | null;
      if (!target) return;
      const inInput = Boolean(rootRef.current?.contains(target));
      const inPopover = Boolean(popoverRef.current?.contains(target));
      if (!inInput && !inPopover) setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  useEffect(() => {
    if (!open || !rootRef.current) return;
    const updatePos = (): void => {
      if (!rootRef.current) return;
      const rect = rootRef.current.getBoundingClientRect();
      setPopoverPos({
        top: rect.bottom + 8,
        left: rect.left,
      });
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [open]);

  const selected = useMemo<DateRange | undefined>(() => {
    if (!from && !to) return undefined;
    return {
      from: from ?? undefined,
      to: to ?? undefined,
    };
  }, [from, to]);

  const disabledDays = useMemo(() => {
    if (minDate && maxDate) return [{ before: minDate }, { after: maxDate }];
    if (minDate) return [{ before: minDate }];
    if (maxDate) return [{ after: maxDate }];
    return undefined;
  }, [minDate, maxDate]);

  return (
    <div ref={rootRef} className={`relative ${wrapperClassName}`}>
      <input
        type="text"
        readOnly
        value={formatRangeLabel(from, to, locale)}
        onFocus={() => !disabled && setOpen(true)}
        onClick={() => !disabled && setOpen(true)}
        placeholder={placeholderText}
        disabled={disabled}
        className={className}
      />

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-700 disabled:opacity-50 dark:text-gray-200"
        aria-label="Abrir calendario de rango"
      >
        <CalendarRange size={16} />
      </button>

      {open && !disabled && popoverPos && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-[200] rounded-xl border border-gray-200 bg-white p-3 shadow-2xl"
          style={{ top: `${popoverPos.top}px`, left: `${popoverPos.left}px` }}
        >
          <DayPicker
            style={DAY_PICKER_GREEN_THEME}
            mode="range"
            month={month}
            onMonthChange={setMonth}
            selected={selected}
            onSelect={(range) => {
              const hadOpenRange = Boolean(from && !to);
              onChange({
                from: range?.from ?? null,
                to: range?.to ?? null,
              });
              if (hadOpenRange && range?.from && range?.to) setOpen(false);
            }}
            locale={locale}
            disabled={disabledDays}
            showOutsideDays
            weekStartsOn={1}
            classNames={{
              button_previous: 'text-donezo-primary hover:bg-green-50 rounded-md p-1',
              button_next: 'text-donezo-primary hover:bg-green-50 rounded-md p-1',
              day_selected: 'bg-donezo-primary text-white hover:bg-donezo-primary',
              day_range_start: 'bg-donezo-primary text-white rounded-l-full',
              day_range_end: 'bg-donezo-primary text-white rounded-r-full',
              day_range_middle: 'bg-green-100 text-green-900',
            }}
          />
        </div>,
        document.body,
      )}
    </div>
  );
};

export default DateRangePicker;
