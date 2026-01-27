import * as React from "react";
import { format, parse, setMonth, setYear } from "date-fns";
import { DayPicker } from "react-day-picker";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/cn";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function generateYearRange(selected?: Date): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear - 10; y <= currentYear + 5; y++) {
    years.push(y);
  }
  return years;
}

export interface DatePickerProps {
  value?: string; // yyyy-MM-dd format
  onChange: (date: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

function parseDate(dateStr: string | undefined): Date | undefined {
  if (!dateStr) return undefined;
  // Safari compatibility: replace hyphens with slashes
  const safariSafe = dateStr.replace(/-/g, "/");
  const parsed = new Date(safariSafe);
  return isNaN(parsed.getTime()) ? undefined : parsed;
}

function formatToYmd(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

interface MonthYearNavProps {
  displayMonth: Date;
  onMonthChange: (month: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

function MonthYearNav({ displayMonth, onMonthChange, onPrevMonth, onNextMonth }: MonthYearNavProps) {
  const years = generateYearRange(displayMonth);
  
  const handleMonthSelect = (monthIndex: string) => {
    const newDate = setMonth(displayMonth, parseInt(monthIndex));
    onMonthChange(newDate);
  };
  
  const handleYearSelect = (year: string) => {
    const newDate = setYear(displayMonth, parseInt(year));
    onMonthChange(newDate);
  };
  
  return (
    <div className="flex items-center justify-between gap-1 px-1">
      <button
        type="button"
        onClick={onPrevMonth}
        className="h-9 w-9 inline-flex items-center justify-center rounded-md opacity-70 hover:opacity-100 hover:bg-accent"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-1">
        <Select value={String(displayMonth.getMonth())} onValueChange={handleMonthSelect}>
          <SelectTrigger className="h-8 w-[100px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((month, index) => (
              <SelectItem key={month} value={String(index)}>
                {month}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(displayMonth.getFullYear())} onValueChange={handleYearSelect}>
          <SelectTrigger className="h-8 w-[72px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <button
        type="button"
        onClick={onNextMonth}
        className="h-9 w-9 inline-flex items-center justify-center rounded-md opacity-70 hover:opacity-100 hover:bg-accent"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}

const calendarClassNames = {
  months: "flex flex-col",
  month: "space-y-2",
  month_caption: "hidden",
  caption_label: "hidden",
  nav: "hidden",
  button_previous: "hidden",
  button_next: "hidden",
  month_grid: "w-full border-collapse",
  weekdays: "flex",
  weekday: "text-muted-foreground rounded-md w-10 h-10 font-normal text-[0.8rem] flex items-center justify-center",
  week: "flex w-full mt-1",
  day: "h-10 w-10 text-center text-sm p-0 relative flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent",
  day_button: "h-10 w-10 p-0 font-normal rounded-md hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
  selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
  today: "bg-accent text-accent-foreground font-semibold",
  outside: "text-muted-foreground opacity-50",
  disabled: "text-muted-foreground opacity-50 cursor-not-allowed",
  hidden: "invisible",
};

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled = false,
  className,
  id,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [month, setMonth] = React.useState<Date>(parseDate(value) ?? new Date());
  const selected = parseDate(value);

  React.useEffect(() => {
    if (selected) {
      setMonth(selected);
    }
  }, [value]);

  const handlePrevMonth = () => {
    setMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange(formatToYmd(date));
    } else {
      onChange(undefined);
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selected ? format(selected, "MMM d, yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <MonthYearNav
          displayMonth={month}
          onMonthChange={setMonth}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
        />
        <DayPicker
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          month={month}
          onMonthChange={setMonth}
          showOutsideDays
          className="rdp-custom"
          classNames={calendarClassNames}
        />
      </PopoverContent>
    </Popover>
  );
}

export interface DateInputProps {
  value?: string;
  onChange: (date: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function DateInput({
  value,
  onChange,
  placeholder = "mm/dd/yyyy",
  disabled = false,
  className,
  id,
}: DateInputProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(value ?? "");
  const [month, setMonth] = React.useState<Date>(parseDate(value) ?? new Date());
  const selected = parseDate(value);

  React.useEffect(() => {
    setInputValue(value ?? "");
    if (selected) {
      setMonth(selected);
    }
  }, [value]);

  const handlePrevMonth = () => {
    setMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    
    // Try to parse as date
    const parsed = parse(val, "MM/dd/yyyy", new Date());
    if (!isNaN(parsed.getTime())) {
      onChange(formatToYmd(parsed));
    }
  };

  const handleInputBlur = () => {
    // On blur, try to parse various formats
    if (!inputValue) {
      onChange(undefined);
      return;
    }
    
    const formats = ["MM/dd/yyyy", "M/d/yyyy", "yyyy-MM-dd"];
    for (const fmt of formats) {
      const parsed = parse(inputValue, fmt, new Date());
      if (!isNaN(parsed.getTime())) {
        onChange(formatToYmd(parsed));
        setInputValue(format(parsed, "MM/dd/yyyy"));
        return;
      }
    }
  };

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      const ymd = formatToYmd(date);
      onChange(ymd);
      setInputValue(format(date, "MM/dd/yyyy"));
    } else {
      onChange(undefined);
      setInputValue("");
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <input
            id={id}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              "flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 pr-10 text-sm ring-offset-background",
              "file:border-0 file:bg-transparent file:text-sm file:font-medium",
              "placeholder:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-50",
              className
            )}
          />
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            <CalendarIcon className="h-4 w-4" />
          </button>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <MonthYearNav
          displayMonth={month}
          onMonthChange={setMonth}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
        />
        <DayPicker
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          month={month}
          onMonthChange={setMonth}
          showOutsideDays
          className="rdp-custom"
          classNames={calendarClassNames}
        />
      </PopoverContent>
    </Popover>
  );
}
