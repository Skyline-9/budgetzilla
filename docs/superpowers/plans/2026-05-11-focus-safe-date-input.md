# Focus-Safe Date Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modify the transaction date field to open the calendar on focus without stealing focus from the input, allowing simultaneous typing and date selection.

**Architecture:**
- Use Radix UI `Popover` with `onOpenAutoFocus` to prevent focus theft.
- Update `DateInput` to trigger popover on focus.
- Sync `DayPicker` with input value in real-time.

**Tech Stack:** React, Radix UI, react-day-picker, date-fns.

---

### Task 1: Prevent Focus Theft in Popover

**Files:**
- Modify: `webapp/src/components/ui/date-picker.tsx`

- [ ] **Step 1: Modify `DateInput` to open on focus**

Update the `input` element in the `DateInput` component to trigger `setOpen(true)` on focus.

```tsx
// webapp/src/components/ui/date-picker.tsx

// ... inside DateInput component ...
<input
  id={id}
  type="text"
  value={inputValue}
  onChange={handleInputChange}
  onFocus={() => {
    handleInputFocus();
    setOpen(true);
  }}
  onBlur={handleInputBlur}
  // ...
/>
```

- [ ] **Step 2: Prevent Popover from stealing focus**

Add `onOpenAutoFocus={(e) => e.preventDefault()}` to `PopoverContent` in the `DateInput` component.

```tsx
// webapp/src/components/ui/date-picker.tsx

// ... inside DateInput component ...
<PopoverContent 
  className="w-auto p-3" 
  align="start"
  onOpenAutoFocus={(e) => e.preventDefault()}
>
  {/* ... */}
</PopoverContent>
```

- [ ] **Step 3: Commit changes**

```bash
git add webapp/src/components/ui/date-picker.tsx
git commit -m "feat: open date picker on focus and prevent focus theft"
```

---

### Task 2: Real-time Calendar Sync

**Files:**
- Modify: `webapp/src/components/ui/date-picker.tsx`

- [ ] **Step 1: Update `handleInputChange` to sync calendar**

Modify `handleInputChange` to attempt parsing the date string and updating the `month` and `selected` states if it's a valid date.

```tsx
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
        // We don't call onChange here to avoid premature validation/updates
        // but we update the calendar view
        break;
      }
    }
  };
```

- [ ] **Step 2: Commit changes**

```bash
git add webapp/src/components/ui/date-picker.tsx
git commit -m "feat: sync date picker view in real-time while typing"
```

---

### Task 3: Verification

- [ ] **Step 1: Run the application**

Run: `npm run dev:mock` in the `webapp` directory.

- [ ] **Step 2: Verify behavior**

1. Open the "Add Transaction" dialog.
2. Tab into the "Date" field.
3. Verify that the calendar opens automatically.
4. Verify that the cursor remains in the "Date" field and you can type immediately.
5. Type a date (e.g., "01/01/2025") and verify that the calendar updates to show January 2025.
6. Verify that you can still click a date in the calendar to select it.

