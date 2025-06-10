import { useState, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDarkModeStore } from "@/store/useDarkModeStore";
import { useOrderStore } from "@/store/useOrderStore";
import { useInventoryStore } from "@/store/useInventoryStore";
import { useDateFilterStore } from "@/store/useDateFilterStore";
import { getLastDaysRange } from "@/utils/dateUtils";

interface DateFilterOption {
  label: string;
  value: string;
  days: number | null; // null means "all time"
}

const dateFilterOptions: DateFilterOption[] = [
  { label: "All Time", value: "all", days: null },
  { label: "Past 7 Days", value: "7", days: 7 },
  { label: "Past 30 Days", value: "30", days: 30 },
  { label: "Past 90 Days", value: "90", days: 90 },
  { label: "Past 6 Months", value: "180", days: 180 },
  { label: "Past Year", value: "365", days: 365 },
];

interface DateFilterProps {
  activeTab: 'order-management' | 'insights';
}

export const DateFilter = ({ activeTab }: DateFilterProps) => {
  const { isDarkMode } = useDarkModeStore();

  // Use the shared date filter store
  const { dateFrom, dateTo, setPresetFilter } = useDateFilterStore();

  // Determine current date filter value based on shared state
  const getCurrentDateFilterValue = () => {
    if (!dateFrom || !dateTo) {
      return "all";
    }

    // Check which predefined option matches the current date range
    for (const option of dateFilterOptions) {
      if (option.days === null) continue;

      const range = getLastDaysRange(option.days);
      if (dateFrom === range.from && dateTo === range.to) {
        return option.value;
      }
    }

    return "custom"; // If it doesn't match any predefined option
  };

  const [selectedValue, setSelectedValue] = useState(getCurrentDateFilterValue());

  // Update selected value when shared date filter changes
  useEffect(() => {
    setSelectedValue(getCurrentDateFilterValue());
  }, [dateFrom, dateTo]);

  const handleDateFilterChange = (value: string) => {
    setSelectedValue(value);

    const selectedOption = dateFilterOptions.find(opt => opt.value === value);

    if (!selectedOption) return;

    // Update the shared date filter store
    setPresetFilter(selectedOption.days);
  };

  const getDisplayLabel = () => {
    const selectedOption = dateFilterOptions.find(opt => opt.value === selectedValue);
    return selectedOption?.label || "All Time";
  };

  return (
    <div className="flex-1 min-w-[200px]">
      <label className={`text-sm font-medium mb-2 block ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
        Date Range
      </label>
      <Select value={selectedValue} onValueChange={handleDateFilterChange}>
        <SelectTrigger className={isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}>
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            <SelectValue placeholder="Select date range" />
          </div>
        </SelectTrigger>
        <SelectContent className={isDarkMode ? 'bg-gray-700 border-gray-600' : ''}>
          {dateFilterOptions.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className={isDarkMode ? 'text-gray-300 hover:bg-gray-600 focus:bg-gray-600' : ''}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}; 