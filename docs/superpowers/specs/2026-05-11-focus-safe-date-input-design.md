# Design Spec: Focus-Safe Date Input

## Problem
In the transaction dialog, clicking or focusing the date field currently triggers a date picker that steals focus from the input. This prevents the user from immediately typing the date, which is an anti-pattern for keyboard-heavy workflows.

## Goals
- Open the date picker automatically when the date field is focused (via click or tab).
- Prevent the date picker from stealing focus, keeping the cursor in the text input.
- Allow simultaneous typing and visual date selection.
- Update the date picker's view in real-time as the user types.

## Proposed Changes

### 1. Webapp: `DateInput` Component (`webapp/src/components/ui/date-picker.tsx`)
- **Trigger on Focus**: Add an `onFocus` handler to the text input that calls `setOpen(true)`.
- **Prevent Focus Theft**: Add `onOpenAutoFocus={(e) => e.preventDefault()}` to the `PopoverContent` component. This is a Radix UI property that prevents focus from moving to the popover content when it opens.
- **Real-time Calendar Sync**: Update `handleInputChange` to attempt parsing the current input value as the user types. If a valid date or a valid partial date (e.g., matching a month/year) is found, update the `DayPicker`'s `month` and `selected` states.
- **Improved Parsing**: Refine the date parsing logic to be more forgiving and responsive during active typing.

### 2. Radix UI Popover Integration
- Ensure the `Popover` is configured to allow interaction with the anchor (the input) while open.
- Set `modal={false}` on the `Popover` if necessary to ensure it doesn't block interactions with other parts of the form, although `modal={true}` (the default) might be acceptable if we just want to prevent focus theft. Given the user wants to "be able to type", `modal={false}` is likely better or Radix defaults might already support this if we handle focus correctly. Actually, Radix Popover with `modal={true}` (default) usually traps focus. We should probably use `modal={false}`.

## Interaction Flow
1. User tabs into or clicks the Date field.
2. The Date field receives focus, and the `inputValue` is selected (if any).
3. The Popover opens immediately.
4. Focus remains in the `input`, and the cursor is visible.
5. User starts typing (e.g., "05").
6. `handleInputChange` updates the `inputValue` state.
7. (Optional but recommended) The calendar view updates to the current month if the typed text matches a date format.
8. User selects a date from the calendar or finishes typing.
9. If a date is selected from the calendar, the `input` value is updated and the Popover closes (standard behavior).
10. If the user tabs away, the Popover closes and the final value is validated.

## Success Criteria
- Focus never leaves the date input when the picker opens.
- User can type a full date without any focus interruptions.
- The calendar remains visible and interactive while typing.
