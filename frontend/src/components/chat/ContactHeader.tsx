import React from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AssignmentDropdown } from "./AssignmentDropdown";
import { cn } from "@/lib/utils";
import { getInitials, getStatusIndicator, getContactStatus } from "./message-utils";
import {
  PhoneIcon,
  VideoCameraIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/24/outline";

interface ContactHeaderProps {
  contact: any;
  conversation: any;
}

export const ContactHeader: React.FC<ContactHeaderProps> = ({
  contact,
  conversation,
}) => {
  const contactStatus = getContactStatus(contact?.status);

  return (
    <div className="h-16 px-6 flex items-center justify-between border-b border-border">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-medium text-primary">
              {getInitials(contact?.name)}
            </span>
          </div>
          <span
            className={cn(
              "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-card",
              getStatusIndicator(contactStatus)
            )}
          />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">
            {contact?.name || contact?.phone || "Unknown"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {contact?.phone || "No phone"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <AssignmentDropdown
          conversationId={conversation.id}
          currentAssignment={conversation.assignedToUserId}
          onAssignmentChange={() => {
            // Invalidate queries to refresh data
          }}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon">
              <PhoneIcon className="w-5 h-5 text-muted-foreground" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Call</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon">
              <VideoCameraIcon className="w-5 h-5 text-muted-foreground" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Video call</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon">
              <EllipsisVerticalIcon className="w-5 h-5 text-muted-foreground" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>More options</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};