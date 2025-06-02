import React, { useState, useEffect } from 'react';
import { Calendar, Clock, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { useDateStore } from '@/store/useDateStore';
import { useDarkModeStore } from '@/store/useDarkModeStore';
import { useOrderStore } from '@/store/useOrderStore';

interface DateConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DateConfigModal: React.FC<DateConfigModalProps> = ({ isOpen, onClose }) => {
  const { isDarkMode } = useDarkModeStore();
  const { clearStaleData } = useOrderStore();
  const {
    configuredDate,
    isDateConfigured,
    setConfiguredDate,
    clearConfiguredDate,
  } = useDateStore();

  // Ensure configuredDate is a Date object or use current date
  const getInitialDate = () => {
    if (!configuredDate) return new Date();

    if (configuredDate instanceof Date) {
      return configuredDate;
    }

    // If it's a string, convert to Date
    const dateFromString = new Date(configuredDate);
    return isNaN(dateFromString.getTime()) ? new Date() : dateFromString;
  };

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(getInitialDate());

  // Reset selectedDate when modal opens to ensure calendar shows the right month
  useEffect(() => {
    if (isOpen) {
      setSelectedDate(getInitialDate());
    }
  }, [isOpen, configuredDate]);

  const handleSave = () => {
    if (selectedDate) {
      setConfiguredDate(selectedDate);
    }
    onClose();
  };

  const handleReset = () => {
    console.log('Resetting date configuration to real-time...');
    // Clear stale data from order store first
    clearStaleData();
    // Then clear the date configuration (this will trigger refreshes)
    clearConfiguredDate();
    setSelectedDate(new Date());
    onClose(); // Close the modal after resetting
  };

  const handleCancel = () => {
    // Reset to the current configured date or today if none
    setSelectedDate(getInitialDate());
    onClose();
  };

  const realCurrentDate = new Date();

  // Ensure selectedDate is valid before using it
  const validSelectedDate = selectedDate && !isNaN(selectedDate.getTime()) ? selectedDate : new Date();
  const daysDifference = Math.round((validSelectedDate.getTime() - realCurrentDate.getTime()) / (1000 * 60 * 60 * 24));

  const getDifferenceText = () => {
    if (daysDifference === 0) {
      return 'Today (real time)';
    } else if (daysDifference > 0) {
      return `${daysDifference} day${daysDifference === 1 ? '' : 's'} in the future`;
    } else {
      return `${Math.abs(daysDifference)} day${Math.abs(daysDifference) === 1 ? '' : 's'} in the past`;
    }
  };

  // Ensure configuredDate is a Date object for display
  const displayConfiguredDate = () => {
    if (!configuredDate) return realCurrentDate;
    if (configuredDate instanceof Date) return configuredDate;
    const dateFromString = new Date(configuredDate);
    return isNaN(dateFromString.getTime()) ? realCurrentDate : dateFromString;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-md ${isDarkMode ? 'bg-gray-800 border-gray-700' : ''}`}>
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${isDarkMode ? 'text-white' : ''}`}>
            <Clock className="h-5 w-5" />
            Configure Application Date
          </DialogTitle>
          <DialogDescription className={isDarkMode ? 'text-gray-400' : ''}>
            Set a custom current date for the application. This will affect all date-related
            calculations including order creation and filtering.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Status */}
          <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Current Status:
              </span>
              <Badge variant={isDateConfigured ? 'default' : 'secondary'}>
                {isDateConfigured ? 'Custom Date' : 'Real Time'}
              </Badge>
            </div>
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Application date: {format(displayConfiguredDate(), 'PPPP')}
            </div>
            {isDateConfigured && (
              <div className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                Real date: {format(realCurrentDate, 'PPPP')}
              </div>
            )}
          </div>

          {/* Calendar */}
          <div className="flex justify-center">
            <CalendarComponent
              mode="single"
              selected={validSelectedDate}
              onSelect={setSelectedDate}
              defaultMonth={validSelectedDate}
              className={`border rounded-md ${isDarkMode ? 'border-gray-600' : ''}`}
            />
          </div>

          {/* Selected Date Info */}
          {validSelectedDate && (
            <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-blue-50'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-blue-500" />
                <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Selected Date
                </span>
              </div>
              <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {format(validSelectedDate, 'PPPP')}
              </div>
              <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {getDifferenceText()}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleReset}
              className={`flex-1 ${isDarkMode
                ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 hover:text-white'
                : ''
                }`}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Real Time
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              className={`${isDarkMode
                ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 hover:text-white'
                : ''
                }`}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className={isDarkMode
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : ''
              }
            >
              Save Date
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 