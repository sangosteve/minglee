import {
  UserGroupIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  TrashIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TeamMember {
  id: number;
  name: string;
  avatar: string;
}

interface Team {
  id: number;
  name: string;
  description: string;
  color: string;
  members: TeamMember[];
  createdAt: string;
}

interface TeamCardProps {
  team: Team;
  onEdit: (team: Team) => void;
  onDelete: (teamId: number) => void;
  onAddMember: (team: Team) => void;
  onViewDetails: (team: Team) => void;
}

export const TeamCard = ({
  team,
  onEdit,
  onDelete,
  onAddMember,
  onViewDetails,
}: TeamCardProps) => {
  const displayedMembers = team.members.slice(0, 4);
  const remainingCount = team.members.length - displayedMembers.length;

  return (
    <div
      className="card-gradient rounded-xl p-5 hover:shadow-lg transition-all cursor-pointer group border border-border/50"
      onClick={() => onViewDetails(team)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg ${team.color} flex items-center justify-center`}>
            <UserGroupIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
              {team.name}
            </h3>
            <p className="text-sm text-muted-foreground">
              {team.members.length} member{team.members.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
              <EllipsisVerticalIcon className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(team); }}>
              <PencilIcon className="w-4 h-4 mr-2" />
              Edit Team
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAddMember(team); }}>
              <UserPlusIcon className="w-4 h-4 mr-2" />
              Add Members
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm('Are you sure you want to delete this team?')) {
                  onDelete(team.id);
                }
              }}
            >
              <TrashIcon className="w-4 h-4 mr-2" />
              Delete Team
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Description */}
      {team.description && (
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {team.description}
        </p>
      )}

      {/* Members */}
      <div className="flex items-center justify-between">
        <div className="flex -space-x-2">
          {displayedMembers.map((member) => (
            <div
              key={member.id}
              className="w-8 h-8 rounded-full bg-primary/10 border-2 border-background flex items-center justify-center"
              title={member.name}
            >
              <span className="text-xs font-semibold text-primary">
                {member.avatar}
              </span>
            </div>
          ))}
          {remainingCount > 0 && (
            <div className="w-8 h-8 rounded-full bg-muted border-2 border-background flex items-center justify-center">
              <span className="text-xs font-medium text-muted-foreground">
                +{remainingCount}
              </span>
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-primary hover:text-primary"
          onClick={(e) => {
            e.stopPropagation();
            onAddMember(team);
          }}
        >
          <UserPlusIcon className="w-3.5 h-3.5 mr-1" />
          Add
        </Button>
      </div>
    </div>
  );
};
