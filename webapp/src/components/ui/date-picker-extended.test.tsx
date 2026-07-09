/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { DateInput } from "./date-picker";
import * as React from "react";

afterEach(cleanup);

// Mock Radix UI Popover
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children, open }: any) => (
    <div data-testid="popover" data-open={open}>
      {children}
    </div>
  ),
  PopoverTrigger: ({ children }: any) => <div>{children}</div>,
  PopoverAnchor: ({ children }: any) => <>{children}</>,
  PopoverContent: ({ children, onOpenAutoFocus }: any) => (
    <div data-testid="popover-content" data-has-on-open-auto-focus={String(!!onOpenAutoFocus)}>
      {children}
    </div>
  ),
}));

// Mock Select
vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children }: any) => <button>{children}</button>,
  SelectValue: () => <span>Value</span>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
}));

// Mock DayPicker
vi.mock("react-day-picker", () => ({
  DayPicker: ({ month, selected }: any) => (
    <div 
      data-testid="day-picker" 
      data-month={month?.toISOString()} 
      data-selected={selected?.toISOString()}
    />
  ),
}));

describe("DateInput Robustness", () => {
  it("updates calendar view for partial date but doesn't sync selection", () => {
    const onChange = vi.fn();
    render(<DateInput onChange={onChange} />);
    const input = screen.getByPlaceholderText("mm/dd/yyyy");
    
    // Type partial date
    fireEvent.change(input, { target: { value: "12/31/202" } });
    
    const dayPicker = screen.getByTestId("day-picker");
    const monthVal = dayPicker.getAttribute("data-month");
    expect(monthVal).not.toBeNull();
    const date = new Date(monthVal!);
    // 202 is parsed as year 0202
    expect(date.getFullYear()).toBe(202);
    expect(date.getMonth()).toBe(11); // December
    
    // Selection should NOT be synced yet (onChange not called with ymd)
    expect(onChange).not.toHaveBeenCalled();
    expect(dayPicker.getAttribute("data-selected")).toBeNull();
  });

  it("doesn't sync selection for invalid dates like 02/30/2024", () => {
    const onChange = vi.fn();
    render(<DateInput onChange={onChange} />);
    const input = screen.getByPlaceholderText("mm/dd/yyyy");
    
    fireEvent.change(input, { target: { value: "02/30/2024" } });
    
    const dayPicker = screen.getByTestId("day-picker");
    expect(dayPicker.getAttribute("data-selected")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("handles ISO-like format yyyy-MM-dd", () => {
    const TestWrapper = () => {
      const [value, setValue] = React.useState<string | undefined>(undefined);
      return <DateInput value={value} onChange={setValue} />;
    };
    render(<TestWrapper />);
    const input = screen.getByPlaceholderText("mm/dd/yyyy");
    
    fireEvent.change(input, { target: { value: "2025-05-20" } });
    
    const dayPicker = screen.getByTestId("day-picker");
    const selectedVal = dayPicker.getAttribute("data-selected");
    expect(selectedVal).not.toBeNull();
    const date = new Date(selectedVal!);
    expect(date.getFullYear()).toBe(2025);
    expect(date.getMonth()).toBe(4); // May
    expect(date.getDate()).toBe(20);
  });

  it("syncs and formats on blur for long format", () => {
    const onChange = vi.fn();
    render(<DateInput onChange={onChange} />);
    const input = screen.getByPlaceholderText("mm/dd/yyyy") as HTMLInputElement;
    
    fireEvent.change(input, { target: { value: "Dec 31, 2024" } });
    fireEvent.blur(input);
    
    expect(onChange).toHaveBeenCalledWith("2024-12-31");
    expect(input.value).toBe("12/31/2024");
  });
});
