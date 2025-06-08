import { useDateStore } from '@/store/useDateStore';

/**
 * Safely convert a value to a Date object
 */
const toSafeDate = (value: Date | string | null | undefined): Date => {
  if (!value) return new Date();

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? new Date() : value;
  }

  const dateFromString = new Date(value);
  return isNaN(dateFromString.getTime()) ? new Date() : dateFromString;
};

/**
 * Get the current date based on configuration
 * This function should be used instead of `new Date()` throughout the application
 */
export const getCurrentDate = (): Date => {
  // Check if we're in a React context
  try {
    const state = useDateStore.getState();
    const configuredDate = state.configuredDate;
    return toSafeDate(configuredDate);
  } catch {
    // Fallback for non-React contexts
    return new Date();
  }
};

/**
 * Hook version for React components
 */
export const useCurrentDate = (): Date => {
  const configuredDate = useDateStore(state => state.configuredDate);
  return toSafeDate(configuredDate);
};

/**
 * Get a date that's X days before the configured current date
 */
export const getDaysAgo = (days: number): Date => {
  const currentDate = getCurrentDate();
  const pastDate = new Date(currentDate);
  pastDate.setDate(pastDate.getDate() - days);
  return pastDate;
};

/**
 * Get a date that's X days after the configured current date
 */
export const getDaysFromNow = (days: number): Date => {
  const currentDate = getCurrentDate();
  const futureDate = new Date(currentDate);
  futureDate.setDate(futureDate.getDate() + days);
  return futureDate;
};

/**
 * Check if a date is expired based on the configured current date
 */
export const isDateExpired = (targetDate: string | Date, daysThreshold: number): boolean => {
  const currentDate = getCurrentDate();
  const targetDateTime = toSafeDate(targetDate);
  const diffTime = currentDate.getTime() - targetDateTime.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays > daysThreshold;
};

/**
 * Get the number of days between a target date and the configured current date
 */
export const getDaysSince = (targetDate: string | Date): number => {
  const currentDate = getCurrentDate();
  const targetDateTime = toSafeDate(targetDate);
  const diffTime = currentDate.getTime() - targetDateTime.getTime();
  return diffTime / (1000 * 60 * 60 * 24);
};

/**
 * Format a date string for API calls (YYYY-MM-DD)
 */
export const formatDateForAPI = (date: Date): string => {
  const safeDate = toSafeDate(date);
  // Use local date formatting to avoid timezone issues
  const year = safeDate.getFullYear();
  const month = String(safeDate.getMonth() + 1).padStart(2, '0');
  const day = String(safeDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get the date range for "last X days" based on configured current date
 */
export const getLastDaysRange = (days: number): { from: string; to: string } => {
  const currentDate = getCurrentDate();
  const fromDate = getDaysAgo(days);

  return {
    from: formatDateForAPI(fromDate),
    to: formatDateForAPI(currentDate),
  };
};

/**
 * Get a human-readable description for a date range
 */
export const getDateRangeDescription = (dateFrom: string, dateTo: string): string => {
  const fromDate = new Date(dateFrom);
  const toDate = new Date(dateTo);
  const currentDate = getCurrentDate();

  // Check if this matches our standard ranges
  const diffTime = toDate.getTime() - fromDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Check if 'to' date is approximately today
  const isToToday = Math.abs(toDate.getTime() - currentDate.getTime()) < (24 * 60 * 60 * 1000);

  if (isToToday) {
    if (diffDays <= 7) {
      return "Past 7 days";
    } else if (diffDays <= 30) {
      return "Past 30 days";
    } else if (diffDays <= 90) {
      return "Past 90 days";
    } else if (diffDays <= 180) {
      return "Past 6 months";
    } else if (diffDays <= 365) {
      return "Past year";
    }
  }

  return "Custom date range";
}; 