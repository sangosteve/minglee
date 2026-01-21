import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import QuickRepliesDropdown  from "./QuickRepliesDropdown";
import { EmojiPicker } from "./EmojiPicker";
import {
  PaperAirplaneIcon,
  PaperClipIcon,
  FaceSmileIcon,
  BoltIcon,
  SparklesIcon,
  PhoneIcon,
  PhotoIcon,
  FilmIcon,
  MusicalNoteIcon,
  DocumentIcon,
  ArchiveBoxIcon,
} from "@heroicons/react/24/outline";
import { FileText } from "lucide-react";

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onEmojiSelect: (emoji: string) => void;
  onFileSelect: (accept: string) => void;
  onTemplateSelect: () => void;
  disabled?: boolean;
  isSending?: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  quickReplies?: any[];
  quickRepliesLoading?: boolean;
  conversationId?: string;
  contact?: any;
  user?: any;
  conversation?: any;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  value,
  onChange,
  onSend,
  onEmojiSelect,
  onFileSelect,
  onTemplateSelect,
  disabled = false,
  isSending = false,
  fileInputRef,
  quickReplies = [],
  quickRepliesLoading = false,
  conversationId,
  contact,
  user,
  conversation,
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="border-t border-border">
      <div className="p-4">
        <div className="border border-border rounded-xl bg-background">
          {/* Top Row - Channel selector and AI button */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-background hover:bg-secondary transition-colors">
                  <div className="w-4 h-4 rounded-full bg-[#25D366] flex items-center justify-center">
                    <PhoneIcon className="w-2.5 h-2.5 text-white" />
                  </div>
                  <span className="text-sm font-medium">WhatsApp</span>
                  <span className="text-sm text-muted-foreground">(12)</span>
                  <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 bg-popover border border-border">
                <DropdownMenuItem className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-[#25D366] flex items-center justify-center">
                    <PhoneIcon className="w-2.5 h-2.5 text-white" />
                  </div>
                  <span>WhatsApp</span>
                  <span className="text-muted-foreground ml-auto">(12)</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-[#7360F2] flex items-center justify-center">
                    <PhoneIcon className="w-2.5 h-2.5 text-white" />
                  </div>
                  <span>Instagram</span>
                  <span className="text-muted-foreground ml-auto">(5)</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-[#0088CC] flex items-center justify-center">
                    <PhoneIcon className="w-2.5 h-2.5 text-white" />
                  </div>
                  <span>Facebook</span>
                  <span className="text-muted-foreground ml-auto">(3)</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                >
                  <SparklesIcon className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>AI Assistant</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Text Input Area */}
          <div className="px-3 py-3">
            <Textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Use '/' for snippets, '$' for variables, ':' for emoji"
              rows={1}
              className="w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 resize-none border-0 p-0 min-h-[20px]"
              disabled={disabled}
            />
          </div>

          {/* Bottom Row - Action icons and send button */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-border">
            <div className="flex items-center gap-1">
              {/* Template Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                    onClick={onTemplateSelect}
                  >
                    <FileText className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Send Template</p>
                </TooltipContent>
              </Tooltip>

              {/* Quick Replies Button */}
              <QuickRepliesDropdown
                quickReplies={quickReplies}
                isLoading={quickRepliesLoading}
                onInsertIntoInput={(message, mediaAttachments = []) => {
                  // Handle quick reply insertion
                }}
                conversationId={conversationId}
                contact={contact}
                user={user}
                conversation={conversation}
                trigger={
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors">
                        <BoltIcon className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Quick Replies</p>
                    </TooltipContent>
                  </Tooltip>
                }
              />

              <div className="w-px h-5 bg-border mx-1" />

              {/* Emoji Picker */}
              <div className="relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    >
                      <FaceSmileIcon className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Emoji</p>
                  </TooltipContent>
                </Tooltip>
                {showEmojiPicker && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowEmojiPicker(false)}
                    />
                    <EmojiPicker
                      onEmojiSelect={(emoji) => {
                        onEmojiSelect(emoji);
                        setShowEmojiPicker(false);
                      }}
                      onClose={() => setShowEmojiPicker(false)}
                    />
                  </>
                )}
              </div>

              {/* Variable Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                    onClick={() => {
                      const variables = ['{{contact.name}}', '{{contact.phone}}', '{{user.name}}'];
                      const variable = variables[Math.floor(Math.random() * variables.length)];
                      onChange(value + variable);
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
                    </svg>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Insert Variable</p>
                </TooltipContent>
              </Tooltip>

              {/* Attachment Menu */}
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                      >
                        <PaperClipIcon className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Attach files</p>
                  </TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="start" className="w-48 bg-popover border border-border">
                  <DropdownMenuItem
                    onClick={() => onFileSelect("image/*")}
                    className="cursor-pointer hover:bg-secondary flex items-center gap-2"
                  >
                    <PhotoIcon className="w-4 h-4" />
                    Photos
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onFileSelect("video/*")}
                    className="cursor-pointer hover:bg-secondary flex items-center gap-2"
                  >
                    <FilmIcon className="w-4 h-4" />
                    Videos
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onFileSelect("audio/*")}
                    className="cursor-pointer hover:bg-secondary flex items-center gap-2"
                  >
                    <MusicalNoteIcon className="w-4 h-4" />
                    Audio
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onFileSelect(".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv")}
                    className="cursor-pointer hover:bg-secondary flex items-center gap-2"
                  >
                    <DocumentIcon className="w-4 h-4" />
                    Documents
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onFileSelect(".zip,.rar,.7z,.tar,.gz")}
                    className="cursor-pointer hover:bg-secondary flex items-center gap-2"
                  >
                    <ArchiveBoxIcon className="w-4 h-4" />
                    Compressed
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Additional Icons */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Voice Message</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                    </svg>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Save as Snippet</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Send Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={onSend}
                  disabled={(!value.trim()) || isSending}
                  className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <PaperAirplaneIcon className="w-4 h-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Send message</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
};