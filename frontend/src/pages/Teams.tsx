import { useState } from 'react';
import { MainLayout } from "@/components/layout/MainLayout";
import {
  UserGroupIcon,
  PlusIcon,
  EnvelopeIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ClockIcon,
  StarIcon,
  EllipsisVerticalIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TeamSheet } from '@/components/teams/TeamSheet';
import { AddMemberSheet } from '@/components/teams/AddMemberSheet';
import { TeamCard } from '@/components/teams/TeamCard';
import { toast } from '@/hooks/use-toast';

interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar: string;
  status: string;
  conversations: { active: number; resolved: number };
  responseTime: string;
  rating: number;
}

interface Team {
  id: number;
  name: string;
  description: string;
  color: string;
  members: TeamMember[];
  createdAt: string;
}

const initialMembers: TeamMember[] = [
  {
    id: 1,
    name: "Sarah Johnson",
    email: "sarah@company.com",
    role: "Team Lead",
    avatar: "SJ",
    status: "online",
    conversations: { active: 8, resolved: 156 },
    responseTime: "2m 30s",
    rating: 4.9,
  },
  {
    id: 2,
    name: "Michael Chen",
    email: "michael@company.com",
    role: "Support Agent",
    avatar: "MC",
    status: "online",
    conversations: { active: 5, resolved: 234 },
    responseTime: "3m 15s",
    rating: 4.7,
  },
  {
    id: 3,
    name: "Emily Davis",
    email: "emily@company.com",
    role: "Support Agent",
    avatar: "ED",
    status: "away",
    conversations: { active: 3, resolved: 189 },
    responseTime: "4m 45s",
    rating: 4.8,
  },
  {
    id: 4,
    name: "James Wilson",
    email: "james@company.com",
    role: "Sales Rep",
    avatar: "JW",
    status: "online",
    conversations: { active: 12, resolved: 98 },
    responseTime: "5m 20s",
    rating: 4.6,
  },
  {
    id: 5,
    name: "Lisa Anderson",
    email: "lisa@company.com",
    role: "Support Agent",
    avatar: "LA",
    status: "offline",
    conversations: { active: 0, resolved: 312 },
    responseTime: "2m 55s",
    rating: 4.9,
  },
  {
    id: 6,
    name: "David Brown",
    email: "david@company.com",
    role: "Admin",
    avatar: "DB",
    status: "online",
    conversations: { active: 2, resolved: 45 },
    responseTime: "3m 40s",
    rating: 4.5,
  },
];

const initialTeams: Team[] = [
  {
    id: 1,
    name: "Sales Team",
    description: "Handle all sales-related conversations and lead generation",
    color: "bg-primary",
    members: [initialMembers[0], initialMembers[3]],
    createdAt: "2024-01-15",
  },
  {
    id: 2,
    name: "Customer Support",
    description: "Primary support team for customer inquiries and issues",
    color: "bg-crm-success",
    members: [initialMembers[1], initialMembers[2], initialMembers[4]],
    createdAt: "2024-01-10",
  },
  {
    id: 3,
    name: "Technical Support",
    description: "Handle technical issues and product-related questions",
    color: "bg-crm-warning",
    members: [initialMembers[5]],
    createdAt: "2024-02-01",
  },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case "online":
      return "bg-crm-success";
    case "away":
      return "bg-crm-warning";
    case "offline":
      return "bg-muted-foreground";
    default:
      return "bg-muted-foreground";
  }
};

const getRoleBadgeColor = (role: string) => {
  switch (role) {
    case "Admin":
      return "bg-primary/10 text-primary";
    case "Team Lead":
      return "bg-crm-warning/10 text-crm-warning";
    default:
      return "bg-muted text-muted-foreground";
  }
};

type ViewMode = 'teams' | 'members';

export default function Teams() {
  const [viewMode, setViewMode] = useState<ViewMode>('teams');
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [allMembers] = useState<TeamMember[]>(initialMembers);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sheet states
  const [teamSheetOpen, setTeamSheetOpen] = useState(false);
  const [teamSheetMode, setTeamSheetMode] = useState<'create' | 'edit'>('create');
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [addMemberSheetOpen, setAddMemberSheetOpen] = useState(false);
  const [teamDetailOpen, setTeamDetailOpen] = useState(false);

  const onlineMembers = allMembers.filter((m) => m.status === "online").length;
  const totalActive = allMembers.reduce((sum, m) => sum + m.conversations.active, 0);

  const handleCreateTeam = () => {
    setSelectedTeam(null);
    setTeamSheetMode('create');
    setTeamSheetOpen(true);
  };

  const handleEditTeam = (team: Team) => {
    setSelectedTeam(team);
    setTeamSheetMode('edit');
    setTeamSheetOpen(true);
  };

  const handleSaveTeam = (teamData: Partial<Team>) => {
    if (teamSheetMode === 'create') {
      const newTeam: Team = {
        id: Date.now(),
        name: teamData.name || '',
        description: teamData.description || '',
        color: teamData.color || 'bg-primary',
        members: teamData.members || [],
        createdAt: new Date().toISOString().split('T')[0],
      };
      setTeams([...teams, newTeam]);
      toast({ title: 'Team created', description: `${newTeam.name} has been created successfully.` });
    } else if (selectedTeam) {
      setTeams(teams.map((t) => 
        t.id === selectedTeam.id 
          ? { ...t, ...teamData }
          : t
      ));
      toast({ title: 'Team updated', description: 'Team has been updated successfully.' });
    }
  };

  const handleDeleteTeam = (teamId: number) => {
    setTeams(teams.filter((t) => t.id !== teamId));
    toast({ title: 'Team deleted', description: 'Team has been deleted successfully.' });
  };

  const handleAddMemberToTeam = (team: Team) => {
    setSelectedTeam(team);
    setTeamSheetMode('edit');
    setTeamSheetOpen(true);
  };

  const handleViewTeamDetails = (team: Team) => {
    setSelectedTeam(team);
    setTeamDetailOpen(true);
  };

  const handleInviteMember = (memberData: {
    name: string;
    email: string;
    role: string;
    teamId: number | null;
  }) => {
    toast({ 
      title: 'Invitation sent', 
      description: `An invitation has been sent to ${memberData.email}.` 
    });
  };

  const filteredTeams = teams.filter((team) =>
    team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    team.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMembers = allMembers.filter((member) =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Teams</h1>
            <p className="text-muted-foreground mt-1">
              Manage your teams and team members
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setAddMemberSheetOpen(true)}>
              <PlusIcon className="w-4 h-4 mr-2" />
              Invite Member
            </Button>
            <Button onClick={handleCreateTeam}>
              <PlusIcon className="w-4 h-4 mr-2" />
              Create Team
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card-gradient rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <UserGroupIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{teams.length}</p>
                <p className="text-sm text-muted-foreground">Total Teams</p>
              </div>
            </div>
          </div>
          <div className="card-gradient rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-crm-success/10">
                <CheckCircleIcon className="w-5 h-5 text-crm-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{allMembers.length}</p>
                <p className="text-sm text-muted-foreground">Team Members</p>
              </div>
            </div>
          </div>
          <div className="card-gradient rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-crm-warning/10">
                <ClockIcon className="w-5 h-5 text-crm-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{onlineMembers}</p>
                <p className="text-sm text-muted-foreground">Online Now</p>
              </div>
            </div>
          </div>
          <div className="card-gradient rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <StarIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalActive}</p>
                <p className="text-sm text-muted-foreground">Active Chats</p>
              </div>
            </div>
          </div>
        </div>

        {/* View Toggle & Search */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setViewMode('teams')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'teams'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Teams
            </button>
            <button
              onClick={() => setViewMode('members')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'members'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All Members
            </button>
          </div>

          <div className="relative flex-1 max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={viewMode === 'teams' ? 'Search teams...' : 'Search members...'}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

        {/* Content */}
        {viewMode === 'teams' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTeams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                onEdit={handleEditTeam}
                onDelete={handleDeleteTeam}
                onAddMember={handleAddMemberToTeam}
                onViewDetails={handleViewTeamDetails}
              />
            ))}
            
            {/* Add Team Card */}
            <button
              onClick={handleCreateTeam}
              className="min-h-[180px] rounded-xl border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-colors"
            >
              <PlusIcon className="w-8 h-8" />
              <span className="font-medium">Create New Team</span>
            </button>
          </div>
        ) : (
          <div className="card-gradient rounded-xl p-6">
            <div className="space-y-4">
              {filteredMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-background/50 hover:bg-background/80 transition-colors border border-border/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-semibold text-primary">
                          {member.avatar}
                        </span>
                      </div>
                      <span
                        className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-background ${getStatusColor(
                          member.status
                        )}`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground">{member.name}</h3>
                        <Badge className={getRoleBadgeColor(member.role)}>
                          {member.role}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <EnvelopeIcon className="w-3.5 h-3.5" />
                          {member.email}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="text-center">
                      <p className="text-sm font-semibold text-foreground">
                        {member.conversations.active}
                      </p>
                      <p className="text-xs text-muted-foreground">Active</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-foreground">
                        {member.conversations.resolved}
                      </p>
                      <p className="text-xs text-muted-foreground">Resolved</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-foreground">
                        {member.responseTime}
                      </p>
                      <p className="text-xs text-muted-foreground">Avg Time</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-foreground flex items-center gap-1">
                        <StarIcon className="w-4 h-4 text-crm-warning fill-crm-warning" />
                        {member.rating}
                      </p>
                      <p className="text-xs text-muted-foreground">Rating</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <EllipsisVerticalIcon className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View Profile</DropdownMenuItem>
                        <DropdownMenuItem>Edit Permissions</DropdownMenuItem>
                        <DropdownMenuItem>View Activity</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          Remove Member
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Team Detail Sheet */}
      {selectedTeam && teamDetailOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setTeamDetailOpen(false)} />
          <div className="relative w-full max-w-lg h-full bg-background border-l border-border overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${selectedTeam.color} flex items-center justify-center`}>
                    <UserGroupIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">{selectedTeam.name}</h2>
                    <p className="text-sm text-muted-foreground">{selectedTeam.members.length} members</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setTeamDetailOpen(false)}>
                  <XMarkIcon className="w-5 h-5" />
                </Button>
              </div>

              {selectedTeam.description && (
                <p className="text-muted-foreground mb-6">{selectedTeam.description}</p>
              )}

              <div className="flex gap-2 mb-6">
                <Button onClick={() => { setTeamDetailOpen(false); handleEditTeam(selectedTeam); }}>
                  Edit Team
                </Button>
                <Button variant="outline" onClick={() => { setTeamDetailOpen(false); handleAddMemberToTeam(selectedTeam); }}>
                  Add Members
                </Button>
              </div>

              <div>
                <h3 className="font-medium text-foreground mb-4">Team Members</h3>
                <div className="space-y-3">
                  {selectedTeam.members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-semibold text-primary">{member.avatar}</span>
                          </div>
                          <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background ${getStatusColor(member.status)}`} />
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">{member.name}</p>
                          <p className="text-xs text-muted-foreground">{member.role}</p>
                        </div>
                      </div>
                      <Badge className={getRoleBadgeColor(member.role)}>{member.role}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sheets */}
      <TeamSheet
        open={teamSheetOpen}
        onOpenChange={setTeamSheetOpen}
        team={selectedTeam}
        mode={teamSheetMode}
        availableMembers={allMembers}
        onSave={handleSaveTeam}
        onDelete={handleDeleteTeam}
      />

      <AddMemberSheet
        open={addMemberSheetOpen}
        onOpenChange={setAddMemberSheetOpen}
        teams={teams}
        onSave={handleInviteMember}
      />
    </>
  );
}
