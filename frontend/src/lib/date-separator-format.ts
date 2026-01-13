// Add this to your existing imports
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
// Format date for separator (WhatsApp style)
export const formatDateForSeparator = (date: Date): string => {
  if (isToday(date)) {
    return "Today";
  } else if (isYesterday(date)) {
    return "Yesterday";
  } else {
    return format(date, 'EEEE, MMM d'); // e.g., "Monday, Mar 15"
  }
};

// Check if year is different for older messages
export const formatDateWithYearIfNeeded = (date: Date): string => {
  const currentYear = new Date().getFullYear();
  if (date.getFullYear() !== currentYear) {
    return format(date, 'EEEE, MMM d, yyyy'); // e.g., "Monday, Mar 15, 2023"
  }
  return formatDateForSeparator(date);
};