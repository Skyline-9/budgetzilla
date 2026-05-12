/**
 * @vitest-environment jsdom
 */
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import { DateInput } from "./date-picker";
import * as React from "react";

afterEach(cleanup);

// Mock Radix UI Popover to simulate the problematic behavior
// In Radix, PopoverTrigger toggles the open state on click.
vi.mock("@/components/ui/popover", () => {
  return {
    Popover: ({ children, open, onOpenChange }: any) => (
      <div data-testid="popover" data-open={open}>
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            // Pass open state to children so trigger can see it
            return React.cloneElement(child as React.ReactElement<any>, { open, onOpenChange });
          }
          return child;
        })}
      </div>
    ),
    PopoverTrigger: ({ children, asChild, open, onOpenChange }: any) => {
      const handleClick = (e: React.MouseEvent) => {
        // This is what Radix Trigger does: it toggles the state
        onOpenChange?.(!open);
      };
      
      if (asChild) {
        return React.cloneElement(children, { 
          onClick: (e: React.MouseEvent) => {
            children.props.onClick?.(e);
            handleClick(e);
          }
        });
      }
      return <button onClick={handleClick}>{children}</button>;
    },
    PopoverContent: ({ children }: any) => (
      <div data-testid="popover-content">
        {children}
      </div>
    ),
    PopoverAnchor: ({ children, asChild }: any) => {
      if (asChild) {
        return children;
      }
      return <div>{children}</div>;
    },
  };
});

// Mock DayPicker
vi.mock("react-day-picker", () => ({
  DayPicker: () => <div data-testid="day-picker" />,
}));

// Mock Select
vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children }: any) => <button>{children}</button>,
  SelectValue: () => <span>Value</span>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
}));

describe("DateInput Reproduction", () => {
  it("REPRO: clicking the input causes the popover to open and then immediately close", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateInput onChange={onChange} />);
    
    const input = screen.getByPlaceholderText("mm/dd/yyyy");
    const popover = screen.getByTestId("popover");
    
    expect(popover.getAttribute("data-open")).toBe("false");
    
    // Clicking the input should open the popover and KEEP it open
    await user.click(input);
    
    // If the bug exists, this might be "false" because:
    // 1. onFocus -> setOpen(true)
    // 2. click bubbles to PopoverTrigger -> onOpenChange(!true) -> setOpen(false)
    expect(popover.getAttribute("data-open")).toBe("true");
  });

  it("REPRO: clicking the calendar button causes the popover to open and then immediately close", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<DateInput onChange={onChange} />);
    
    // Find the button (it has the icon and absolute class)
    const button = container.querySelector("button.absolute") as HTMLButtonElement;
    const popover = screen.getByTestId("popover");
    
    expect(popover.getAttribute("data-open")).toBe("false");
    
    await user.click(button);
    
    expect(popover.getAttribute("data-open")).toBe("true");
  });
});
