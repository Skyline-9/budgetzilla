/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { DateInput } from "./date-picker";
import * as React from "react";

afterEach(cleanup);

// Mock Radix UI Popover since it can be tricky in tests
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children, open }: any) => (
    <div data-testid="popover" data-open={open}>
      {children}
    </div>
  ),
  PopoverTrigger: ({ children }: any) => <div>{children}</div>,
  PopoverContent: ({ children, onOpenAutoFocus }: any) => (
    <div 
      data-testid="popover-content" 
      data-has-on-open-auto-focus={String(!!onOpenAutoFocus)}
    >
      {children}
    </div>
  ),
}));

// Mock Select to avoid noise
vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children }: any) => <button>{children}</button>,
  SelectValue: () => <span>Value</span>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
}));

// Mock DayPicker
vi.mock("react-day-picker", () => ({
  DayPicker: ({ month }: any) => (
    <div data-testid="day-picker" data-month={month?.toISOString()} />
  ),
}));

describe("DateInput", () => {
  it("opens the popover when the input is focused", () => {
    const onChange = vi.fn();
    render(<DateInput onChange={onChange} />);
    
    const input = screen.getByPlaceholderText("mm/dd/yyyy");
    const popover = screen.getByTestId("popover");
    
    expect(popover.getAttribute("data-open")).toBe("false");
    
    fireEvent.focus(input);
    
    expect(popover.getAttribute("data-open")).toBe("true");
  });

  it("prevents auto focus when the popover opens", () => {
    const onChange = vi.fn();
    render(<DateInput onChange={onChange} />);
    
    const input = screen.getByPlaceholderText("mm/dd/yyyy");
    fireEvent.focus(input);
    
    const popoverContent = screen.getByTestId("popover-content");
    expect(popoverContent.getAttribute("data-has-on-open-auto-focus")).toBe("true");
  });

  it("syncs the calendar view in real-time while typing a valid date", () => {
    const onChange = vi.fn();
    render(<DateInput onChange={onChange} />);
    
    const input = screen.getByPlaceholderText("mm/dd/yyyy");
    const dayPicker = screen.getByTestId("day-picker");
    
    // Initial month should be current month (approximately)
    const initialMonth = new Date(dayPicker.getAttribute("data-month")!);
    
    // Type a date in a different month/year
    fireEvent.change(input, { target: { value: "01/15/2020" } });
    
    const updatedMonth = new Date(dayPicker.getAttribute("data-month")!);
    expect(updatedMonth.getFullYear()).toBe(2020);
    expect(updatedMonth.getMonth()).toBe(0); // January
  });
});
