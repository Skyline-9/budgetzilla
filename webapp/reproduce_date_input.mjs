import { parse, format } from "date-fns";

const formats = ["MM/dd/yyyy", "M/d/yyyy", "MM-dd-yyyy", "M-d-yyyy", "yyyy-MM-dd"];

function formatToYmd(date) {
  return format(date, "yyyy-MM-dd");
}

function handleInputChangeSim(val) {
  let parsedDate;
  let isCompleteResult = false;
  let syncedYmd;

  // Try to parse partial date to update calendar view
  for (const fmt of formats) {
    const d = parse(val, fmt, new Date());
    if (!isNaN(d.getTime())) {
      parsedDate = d;
      
      // If it looks like a complete date, sync the selection too
      // We use a regex to ensure we have a full date (year is 4 digits)
      const isComplete = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(val) || /^\d{4}-\d{2}-\d{2}$/.test(val);
      isCompleteResult = isComplete;
      if (isComplete) {
        syncedYmd = formatToYmd(d);
      }
      break;
    }
  }
  return { parsedDate, isCompleteResult, syncedYmd };
}

const testCases = [
  "12/31/202",   // Partial
  "12/31/2024",  // Complete MM/dd/yyyy
  "1/1/2024",    // Complete M/d/yyyy
  "2024-12-31",  // Complete yyyy-MM-dd
  "12-31-2024",  // Complete MM-dd-yyyy
  "13/31/2024",  // Invalid month (date-fns handles leniently by default? Let's see)
  "02/30/2024",  // Invalid day (Feb 30)
  "02/29/2024",  // Leap year
  "02/29/2023",  // Non-leap year
];

console.log("Testing handleInputChange simulation:");
testCases.forEach(tc => {
  const result = handleInputChangeSim(tc);
  console.log(`Input: "${tc}" -> Parsed: ${result.parsedDate ? format(result.parsedDate, "yyyy-MM-dd") : "Invalid"}, Complete: ${result.isCompleteResult}, Synced: ${result.syncedYmd}`);
});

function handleInputBlurSim(inputValue) {
    if (!inputValue.trim()) {
      return { syncedYmd: undefined, formattedInput: "" };
    }

    // Try various parsing strategies
    const formatsBlur = ["MM/dd/yyyy", "M/d/yyyy", "MM-dd-yyyy", "M-d-yyyy", "yyyy-MM-dd", "MMM d, yyyy"];
    
    let parsed;
    for (const fmt of formatsBlur) {
      const d = parse(inputValue, fmt, new Date());
      if (!isNaN(d.getTime())) {
        parsed = d;
        break;
      }
    }

    // Fallback to native Date parser if formats fail
    if (!parsed || isNaN(parsed.getTime())) {
      const native = new Date(inputValue.replace(/-/g, "/"));
      if (!isNaN(native.getTime())) {
        parsed = native;
      }
    }

    if (parsed && !isNaN(parsed.getTime())) {
      return { syncedYmd: formatToYmd(parsed), formattedInput: format(parsed, "MM/dd/yyyy") };
    } else {
      return { syncedYmd: "STAY_SAME", formattedInput: "STAY_SAME" };
    }
}

console.log("\nTesting handleInputBlur simulation:");
const blurTestCases = [
    "Dec 31, 2024",
    "2024/12/31",
    "invalid",
    "12312024",
    "  "
];

blurTestCases.forEach(tc => {
    const result = handleInputBlurSim(tc);
    console.log(`Input: "${tc}" -> Synced: ${result.syncedYmd}, Formatted: ${result.formattedInput}`);
});
