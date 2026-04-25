import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { createPortal } from 'react-dom';
import type { Locale } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { format, isValid, parse } from 'date-fns';
import 'react-day-picker/style.css';

interface DatePickerProps {
  selected: Date | null;
  onChange: (date: Date | null) => void;
  minDate?: Date;
  maxDate?: Date;
  placeholderText?: string;
  className?: string;
  wrapperClassName?: string;
  disabled?: boolean;
  required?: boolean;
  locale?: Locale;
  selectsStart?: boolean;
  selectsEnd?: boolean;
  startDate?: Date | null;
  endDate?: Date | null;
  dateFormat?: string;
  showIcon?: boolean;
  toggleCalendarOnIconClick?: boolean;
  popperClassName?: string;
  calendarClassName?: string;
  icon?: React.ReactNode;
  inputTestId?: string;
  buttonTestId?: string;
}

const DATE_FORMAT = 'dd/MM/yyyy';
const DAY_PICKER_GREEN_THEME = {
  '--rdp-accent-color': '#0f5132',
  '--rdp-accent-background-color': '#dcefe5',
  '--rdp-range_middle-background-color': '#dcefe5',
  '--rdp-range_middle-color': '#0f5132',
  '--rdp-selected-border': '2px solid #0f5132',
} as React.CSSProperties;

const clampDate = (date: Date, minDate?: Date, maxDate?: Date): Date => {
  let next = date;
  if (minDate && next < minDate) next = minDate;
  if (maxDate && next > maxDate) next = maxDate;
  return next;
};

const DatePicker: React.FC<DatePickerProps> = ({
  selected,
  onChange,
  minDate,
  maxDate,
  placeholderText = 'dd/mm/yyyy',
  className = '',
  wrapperClassName = '',
  disabled = false,
  required = false,
  locale = es,
  inputTestId,
  buttonTestId,
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<Date>(selected ?? new Date());
  const [inputValue, setInputValue] = useState<string>(selected ? format(selected, DATE_FORMAT, { locale }) : '');
  const inputValueRef = useRef<string>(inputValue);
  const commitTypedDateRef = useRef<(raw: string) => void>(() => undefined);
  const selectedTs = selected ? selected.getTime() : null;

  useEffect(() => {
    if (selectedTs === null) {
      setInputValue('');
      return;
    }
    const selectedDate = new Date(selectedTs);
    setInputValue(format(selectedDate, DATE_FORMAT, { locale }));
    setMonth(selectedDate);
  }, [selectedTs, locale]);

  useEffect(() => {
    inputValueRef.current = inputValue;
  }, [inputValue]);

  useEffect(() => {
    const onDocMouseDown = (ev: globalThis.MouseEvent): void => {
      const target = ev.target as Node | null;
      if (!target) return;
      const inInput = Boolean(rootRef.current?.contains(target));
      const inPopover = Boolean(popoverRef.current?.contains(target));
      if (!inInput && !inPopover) {
        if (open) {
          commitTypedDateRef.current(inputValueRef.current);
        }
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !rootRef.current) return;
    const updatePos = (): void => {
      if (!rootRef.current) return;
      const rect = rootRef.current.getBoundingClientRect();
      const margin = 8;
      const gap = 8;
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      const popoverW = popoverRef.current?.offsetWidth ?? 320;
      const popoverH = popoverRef.current?.offsetHeight ?? 360;

      const topBelow = rect.bottom + gap;
      const topAbove = rect.top - gap - popoverH;
      const top = topBelow + popoverH <= viewportH - margin
        ? topBelow
        : Math.max(margin, topAbove);

      const maxLeft = Math.max(margin, viewportW - popoverW - margin);
      const left = Math.min(Math.max(rect.left, margin), maxLeft);

      setPopoverPos({
        top,
        left,
      });
    };
    updatePos();
    const rafId = window.requestAnimationFrame(updatePos);
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [open]);

  const disabledDays = useMemo(() => {
    if (minDate && maxDate) return [{ before: minDate }, { after: maxDate }];
    if (minDate) return [{ before: minDate }];
    if (maxDate) return [{ after: maxDate }];
    return undefined;
  }, [minDate, maxDate]);

  const commitTypedDate = (raw: string): void => {
    const value = raw.trim();
    if (!value) {
      onChange(null);
      return;
    }
    const parsed = parse(value, DATE_FORMAT, new Date(), { locale });
    if (!isValid(parsed)) {
      setInputValue(selected ? format(selected, DATE_FORMAT, { locale }) : '');
      return;
    }
    const next = clampDate(parsed, minDate, maxDate);
    onChange(next);
    setMonth(next);
    setInputValue(format(next, DATE_FORMAT, { locale }));
  };
  commitTypedDateRef.current = commitTypedDate;

  return (
    <div ref={rootRef} className={`relative ${wrapperClassName}`}>
      <input
        data-testid={inputTestId}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={() => {
          if (open) return;
          commitTypedDate(inputValue);
        }}
        onFocus={() => !disabled && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commitTypedDate(inputValue);
            setOpen(false);
          }
          if (e.key === 'Escape') setOpen(false);
        }}
        placeholder={placeholderText}
        disabled={disabled}
        required={required}
        inputMode="numeric"
        className={className}
      />

      <button
        data-testid={buttonTestId}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-700 disabled:opacity-50 dark:text-gray-200"
        aria-label="Abrir calendario"
      >
        <CalendarDays size={16} />
      </button>

      {open && !disabled && popoverPos && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-[200] rounded-xl border border-gray-200 bg-white p-3 shadow-2xl"
          style={{ top: `${popoverPos.top}px`, left: `${popoverPos.left}px` }}
        >
          <DayPicker
            style={DAY_PICKER_GREEN_THEME}
            mode="single"
            month={month}
            onMonthChange={setMonth}
            selected={selected ?? undefined}
            onSelect={(date) => {
              onChange(date ?? null);
              if (date) setInputValue(format(date, DATE_FORMAT, { locale }));
              setOpen(false);
            }}
            locale={locale}
            disabled={disabledDays}
            showOutsideDays
            weekStartsOn={1}
            classNames={{
              button_previous: 'text-donezo-primary hover:bg-green-50 rounded-md p-1',
              button_next: 'text-donezo-primary hover:bg-green-50 rounded-md p-1',
              day_selected: 'bg-donezo-primary text-white hover:bg-donezo-primary',
            }}
          />
        </div>,
        document.body,
      )}
    </div>
  );
};

export default DatePicker;
