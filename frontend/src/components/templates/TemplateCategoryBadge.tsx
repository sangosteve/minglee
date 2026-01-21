// frontend/src/components/templates/TemplateCategoryBadge.tsx
import { Badge } from "@/components/ui/badge";

interface TemplateCategoryBadgeProps {
  category?: string;
}

export function TemplateCategoryBadge({ category }: TemplateCategoryBadgeProps) {
  if (!category) return null;

  const config = {
    UTILITY: {
      label: 'Utility',
      className: 'bg-blue-100 text-blue-700 border-blue-200',
    },
    MARKETING: {
      label: 'Marketing',
      className: 'bg-purple-100 text-purple-700 border-purple-200',
    },
    AUTHENTICATION: {
      label: 'Authentication',
      className: 'bg-orange-100 text-orange-700 border-orange-200',
    },
  };

  const { label, className } = config[category as keyof typeof config] || {
    label: category,
    className: 'bg-gray-100 text-gray-700 border-gray-200',
  };

  return (
    <Badge variant="outline" className={`capitalize ${className}`}>
      {label}
    </Badge>
  );
}