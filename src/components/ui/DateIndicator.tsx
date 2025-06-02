import React from 'react';
import { Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useDateStore } from '@/store/useDateStore';
import { useDarkModeStore } from '@/store/useDarkModeStore';

export const DateIndicator: React.FC = () => {
  const { isDateConfigured, configuredDate } = useDateStore();
  const { isDarkMode } = useDarkModeStore();

  if (!isDateConfigured || !configuredDate) {
    return null;
  }

  // Ensure configuredDate is a Date object
  const dateObj = configuredDate instanceof Date ? configuredDate : new Date(configuredDate);

  // Validate the date is valid
  if (isNaN(dateObj.getTime())) {
    console.warn('Invalid configured date detected, clearing configuration');
    const { clearConfiguredDate } = useDateStore.getState();
    clearConfiguredDate();
    return null;
  }

  const realDate = new Date();
  const daysDifference = Math.round((dateObj.getTime() - realDate.getTime()) / (1000 * 60 * 60 * 24));

  const getDifferenceText = () => {
    if (daysDifference === 0) {
      return 'Today';
    } else if (daysDifference > 0) {
      return `+${daysDifference} day${daysDifference === 1 ? '' : 's'}`;
    } else {
      return `${daysDifference} day${Math.abs(daysDifference) === 1 ? '' : 's'}`;
    }
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${isDarkMode
      ? 'bg-blue-900/30 border border-blue-500/30 text-blue-300'
      : 'bg-blue-50 border border-blue-200 text-blue-700'
      }`}>
      <Clock className="h-3 w-3" />
      <span className="font-medium">
        App Date: {format(dateObj, 'MMM dd, yyyy')}
      </span>
      {daysDifference !== 0 && (
        <Badge
          variant="secondary"
          className={`px-1 py-0 text-xs ${isDarkMode
            ? 'bg-blue-800/50 text-blue-200'
            : 'bg-blue-100 text-blue-600'
            }`}
        >
          {getDifferenceText()}
        </Badge>
      )}
    </div>
  );
}; 