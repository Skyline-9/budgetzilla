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
  DayPicker: () => <div data-testid="day-picker" />,
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
});
