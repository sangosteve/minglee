import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  resolved: number;
  pending: number;
  avgResponse: string;
  status: "online" | "away" | "offline";
}

const teamMembers: TeamMember[] = [
  { id: "1", name: "Alice Cooper", role: "Support Lead", resolved: 45, pending: 3, avgResponse: "2m", status: "online" },
  { id: "2", name: "Bob Martinez", role: "Support Agent", resolved: 38, pending: 5, avgResponse: "4m", status: "online" },
  { id: "3", name: "Carol White", role: "Support Agent", resolved: 32, pending: 8, avgResponse: "6m", status: "away" },
  { id: "4", name: "David Kim", role: "Support Agent", resolved: 28, pending: 2, avgResponse: "3m", status: "online" },
];

const statusColors = {
  online: "bg-success",
  away: "bg-warning",
  offline: "bg-muted-foreground",
};

export function TeamPerformance() {
  return (
    <div className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-foreground">Team Performance</h3>
        <p className="text-sm text-muted-foreground">Today's activity</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Agent</th>
              <th className="text-center py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Resolved</th>
              <th className="text-center py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Pending</th>
              <th className="text-center py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Avg. Response</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {teamMembers.map((member, index) => (
              <tr
                key={member.id}
                className="hover:bg-secondary/30 transition-colors animate-slide-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-medium text-primary">
                          {member.name.split(" ").map((n) => n[0]).join("")}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card",
                          statusColors[member.status]
                        )}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.role}</p>
                    </div>
                  </div>
                </td>
                <td className="text-center py-3 px-4">
                  <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-full bg-success/10 text-success text-sm font-medium">
                    {member.resolved}
                  </span>
                </td>
                <td className="text-center py-3 px-4">
                  <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-full bg-warning/10 text-warning text-sm font-medium">
                    {member.pending}
                  </span>
                </td>
                <td className="text-center py-3 px-4">
                  <span className="text-sm font-medium text-foreground">{member.avgResponse}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
