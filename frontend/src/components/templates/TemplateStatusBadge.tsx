// frontend/src/components/templates/TemplateStatusBadge.tsx
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, XCircle, Ban } from "lucide-react";

interface TemplateStatusBadgeProps {
  status: string;
}

export function TemplateStatusBadge({ status }: TemplateStatusBadgeProps) {
  const config: Record<string, { label: string; icon: any; className: string }> = {
    approved: {
      label: 'Approved',
      icon: CheckCircle,
      className: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100',
    },
    pending: {
      label: 'Pending',
      icon: Clock,
      className: 'bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100',
    },
    rejected: {
      label: 'Rejected',
      icon: XCircle,
      className: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-100',
    },
    disabled: {
      label: 'Disabled',
      icon: Ban,
      className: 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-100',
    },
  };

  const { label, icon: Icon, className } = config[status] || {
    label: status,
    icon: null,
    className: 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-100',
  };

  return (
    <Badge variant="outline" className={`gap-1 ${className}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {label}
    </Badge>
  );
}