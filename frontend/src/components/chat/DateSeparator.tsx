import { formatDateWithYearIfNeeded } from "@/lib/date-separator-format";

const DateSeparator = ({ dateString }: { dateString: string }) => {
  const date = new Date(dateString);
  const formattedDate = formatDateWithYearIfNeeded(date);
  
  return (
    <div className="sticky top-2 z-10 flex justify-center mb-4">
      <div className="bg-secondary/90 backdrop-blur-sm text-xs text-muted-foreground px-3 py-1.5 rounded-full border border-border/50 shadow-sm animate-in fade-in-50 duration-300">
        {formattedDate}
      </div>
    </div>
  );
};

export default DateSeparator;