# Real-time Calendar Selection Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the spec gap where the calendar selection highlight does not update in real-time while typing a valid date in the `DateInput` component.

**Architecture:** Update `DateInput.handleInputChange` to call `onChange` when a complete and valid date is parsed. Update tests to verify both calendar view (month) and selection highlight (selected date) update in real-time.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, date-fns, react-day-picker.

---

### Task 1: Update Tests for Real-time Selection Sync

**Files:**
- Modify: `webapp/src/components/ui/date-picker.test.tsx`

- [ ] **Step 1: Update DayPicker mock to include selected date**

```typescript
// webapp/src/components/ui/date-picker.test.tsx

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
```

- [ ] **Step 2: Update the real-time sync test to verify selection and onChange**

```typescript
// webapp/src/components/ui/date-picker.test.tsx

  it("syncs the calendar view and selection in real-time while typing a valid date", () => {
    const onChange = vi.fn();
    render(<DateInput onChange={onChange} />);

    const input = screen.getByPlaceholderText("mm/dd/yyyy");
    const dayPicker = screen.getByTestId("day-picker");

    // Type a date in a different month/year
    fireEvent.change(input, { target: { value: "01/15/2020" } });

    // Verify month view updated
    const updatedMonth = new Date(dayPicker.getAttribute("data-month")!);
    expect(updatedMonth.getFullYear()).toBe(2020);
    expect(updatedMonth.getMonth()).toBe(0); // January

    // Verify selection updated (THIS WILL FAIL INITIALLY)
    const selectedDate = dayPicker.getAttribute("data-selected");
    expect(selectedDate).toBeDefined();
    const parsedSelected = new Date(selectedDate!);
    expect(parsedSelected.getFullYear()).toBe(2020);
    expect(parsedSelected.getMonth()).toBe(0);
    expect(parsedSelected.getDate()).toBe(15);

    // Verify onChange was called
    expect(onChange).toHaveBeenCalledWith("2020-01-15");
  });
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test webapp/src/components/ui/date-picker.test.tsx`
Expected: FAIL (selected date will be null/undefined and onChange won't be called)

### Task 2: Implement Real-time Selection Sync

**Files:**
- Modify: `webapp/src/components/ui/date-picker.tsx`

- [ ] **Step 1: Update handleInputChange to call onChange for complete dates**

```typescript
// webapp/src/components/ui/date-picker.tsx

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);

    // Try to parse partial date to update calendar view
    const formats = ["MM/dd/yyyy", "M/d/yyyy", "MM-dd-yyyy", "M-d-yyyy", "yyyy-MM-dd"];
    for (const fmt of formats) {
      const d = parse(val, fmt, new Date());
      if (!isNaN(d.getTime())) {
        setMonth(d);
        
        // If it looks like a complete date, sync the selection too
        // We use a regex to ensure we have a full date (year is 4 digits)
        const isComplete = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(val) || /^\d{4}-\d{2}-\d{2}$/.test(val);
        if (isComplete) {
          onChange(formatToYmd(d));
        }
        break;
      }
    }
  };
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm test webapp/src/components/ui/date-picker.test.tsx`
Expected: PASS

- [ ] **Step 3: Commit the fix**

```bash
git add webapp/src/components/ui/date-picker.test.tsx webapp/src/components/ui/date-picker.tsx
git commit -m "fix: sync calendar selection highlight in real-time while typing"
```
