import {
  PaperAirplaneIcon,
  UserPlusIcon,
  MegaphoneIcon,
  DocumentTextIcon,
  SparklesIcon,
  ChatBubbleOvalLeftEllipsisIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

const actions = [
  {
    title: "Send Broadcast",
    description: "Message multiple contacts",
    icon: MegaphoneIcon,
    color: "bg-primary/10 text-primary",
  },
  {
    title: "Add Contact",
    description: "Create new contact",
    icon: UserPlusIcon,
    color: "bg-success/10 text-success",
  },
  {
    title: "New Template",
    description: "Create message template",
    icon: DocumentTextIcon,
    color: "bg-purple-500/10 text-purple-500",
  },
  {
    title: "Quick Reply",
    description: "Send canned response",
    icon: PaperAirplaneIcon,
    color: "bg-blue-500/10 text-blue-500",
  },
  {
    title: "AI Assistant",
    description: "Get AI suggestions",
    icon: SparklesIcon,
    color: "bg-pink-500/10 text-pink-500",
  },
  {
    title: "Start Chat",
    description: "Initiate conversation",
    icon: ChatBubbleOvalLeftEllipsisIcon,
    color: "bg-orange-500/10 text-orange-500",
  },
];

export function QuickActions() {
  return (
    <div className="bg-card rounded-xl shadow-card border border-border p-6">
      <h3 className="font-semibold text-foreground mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {actions.map((action, index) => (
          <button
            key={action.title}
            className={cn(
              "flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-primary/30 hover:shadow-md transition-all duration-200 animate-scale-in",
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className={cn("p-3 rounded-xl", action.color)}>
              <action.icon className="w-5 h-5" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">{action.title}</p>
              <p className="text-xs text-muted-foreground">{action.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
