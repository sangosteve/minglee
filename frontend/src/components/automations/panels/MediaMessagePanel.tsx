"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { X, ImageIcon, VideoIcon, MusicIcon, FileIcon, Upload, Trash2, Eye, EyeOff, Variable, ChevronDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import type { Node } from "@xyflow/react"
import { mediaApi, type MediaAttachment } from "@/lib/api/media"
import { useAuthStore } from "@/stores/auth.store"
import { extractVariables, resolveVariable } from "@/lib/system-variables"
import { useToast } from "@/hooks/use-toast"

interface MediaMessagePanelProps {
  node: Node
  onClose: () => void
  onUpdate: (nodeId: string, data: any) => void
}

const MEDIA_TYPES = [
  { value: 'image', label: 'Image', icon: ImageIcon },
  { value: 'video', label: 'Video', icon: VideoIcon },
  { value: 'audio', label: 'Audio', icon: MusicIcon },
  { value: 'document', label: 'Document', icon: FileIcon },
]

// Sample data for preview
const SAMPLE_CONTACT = {
  name: "John Doe",
  first_name: "John",
  last_name: "Doe", 
  phone: "+1234567890",
  email: "john@example.com",
  city: "New York",
  country: "USA",
  status: "Active",
  tags: ["VIP", "Customer"]
}

const SAMPLE_USER = {
  name: "Jane Smith",
  firstName: "Jane",
  lastName: "Smith",
  email: "jane@example.com",
  companyName: "Our Company"
}

// Helper to determine media type from resourceType
const getMediaTypeFromResourceType = (resourceType: string): 'image' | 'video' | 'audio' | 'document' => {
  if (resourceType === 'image') return 'image'
  if (resourceType === 'video') return 'video'
  if (resourceType === 'audio') return 'audio'
  return 'document'
}

// Helper to get resource type from file
const getResourceTypeFromFile = (file: File): string => {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  return 'raw'
}

export default function MediaMessagePanel({ node, onClose, onUpdate }: MediaMessagePanelProps) {
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'audio' | 'document'>(node.data?.media?.type || 'image')
  const [mediaAttachmentId, setMediaAttachmentId] = useState<string | undefined>(node.data?.mediaAttachmentId)
  const [caption, setCaption] = useState(node.data?.caption || node.data?.media?.caption || "")
  const [filename, setFilename] = useState(node.data?.media?.filename || "")
  const [showPreview, setShowPreview] = useState(false)
  const [usedVariables, setUsedVariables] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [existingAttachments, setExistingAttachments] = useState<MediaAttachment[]>([])
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Get current user ID
  const getUserId = () => {
    const { user } = useAuthStore.getState()
    return user?.id || null
  }

  // Load user's existing media attachments
  const loadExistingAttachments = useCallback(async () => {
    try {
      setIsLoadingAttachments(true)
      const response = await mediaApi.getAttachments({
        page: 1,
        limit: 50,
        type: mediaType === 'audio' ? 'video' : mediaType // Cloudinary treats audio as video
      })
      
      if (response.success && response.data?.attachments) {
        setExistingAttachments(response.data.attachments)
      } else {
        console.warn('Failed to load attachments:', response)
      }
    } catch (error: any) {
      console.error('Error loading attachments:', error)
      toast({
        title: "Failed to load media files",
        description: error.message || "Please try again",
        variant: "destructive",
      })
    } finally {
      setIsLoadingAttachments(false)
    }
  }, [mediaType, toast])

  // Extract variables from caption
  useEffect(() => {
    const variables = extractVariables(caption)
    setUsedVariables(variables)
  }, [caption])

  // Update node data when configuration changes
  useEffect(() => {
    const mediaData = {
      type: mediaType,
      caption,
      filename,
      url: node.data?.media?.url,
      thumbnailUrl: node.data?.media?.thumbnailUrl,
    }

    onUpdate(node.id, {
      media: mediaData,
      mediaAttachmentId,
      caption,
    })
  }, [mediaType, caption, filename, mediaAttachmentId, node.id, onUpdate, node.data?.media])

  // Load existing attachments on mount and when media type changes
  useEffect(() => {
    loadExistingAttachments()
  }, [loadExistingAttachments])

  // Handle file upload
const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0]
  if (!file) return

  // Validate file size (50MB max)
  const maxSize = 50 * 1024 * 1024
  if (file.size > maxSize) {
    toast({
      title: "File too large",
      description: "Maximum file size is 50MB",
      variant: "destructive",
    })
    return
  }

  // Validate file type
  const allowedTypes = {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    video: ['video/mp4', 'video/avi', 'video/mov', 'video/wmv'],
    audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3'],
    document: ['application/pdf', 'application/msword', 'text/plain', 'application/zip']
  }

  const currentAllowedTypes = allowedTypes[mediaType] || [...allowedTypes.image, ...allowedTypes.video, ...allowedTypes.audio, ...allowedTypes.document]
  
  if (!currentAllowedTypes.includes(file.type)) {
    toast({
      title: "Invalid file type",
      description: `Please select a valid ${mediaType} file`,
      variant: "destructive",
    })
    return
  }

  // Clear previous media immediately
  setMediaAttachmentId(undefined)
  setFilename('')
  onUpdate(node.id, {
    media: {
      type: mediaType,
      caption,
    },
    caption,
  })

  try {
    setUploading(true)
    setUploadProgress(10) // Initial progress

    // Get user ID for folder
    const userId = getUserId()
    if (!userId) {
      throw new Error("User not authenticated")
    }

    // Use your media API to upload
    const folder = `automation_media/user_${userId}`
    setUploadProgress(30)
    
    const response = await mediaApi.uploadMultipleFiles([file], folder)
    setUploadProgress(70)

    if (response.success && response.data.uploads?.[0]?.success) {
      const upload = response.data.uploads[0]
      
      // Get the newly uploaded attachment details
      let newAttachment: MediaAttachment | undefined
      
      // Try to fetch the uploaded attachment from the server
      try {
        const attachmentsResponse = await mediaApi.getAttachments({ page: 1, limit: 1 })
        if (attachmentsResponse.success && attachmentsResponse.data?.attachments?.length > 0) {
          // Find the most recent attachment that matches our file
          const recentAttachment = attachmentsResponse.data.attachments[0]
          if (recentAttachment.originalFilename === file.name || 
              recentAttachment.filename === file.name) {
            newAttachment = recentAttachment
          }
        }
      } catch (error) {
        console.warn('Could not fetch attachment details:', error)
      }

      // If we couldn't get the attachment details, create a temporary object
      if (!newAttachment) {
        newAttachment = {
          id: upload.id || `temp_${Date.now()}`,
          publicId: upload.publicId,
          cloudinaryUrl: upload.url,
          secureUrl: upload.url,
          filename: file.name,
          originalFilename: file.name,
          mimeType: file.type,
          fileSize: file.size,
          format: file.name.split('.').pop() || '',
          assetType: getResourceTypeFromFile(file),
          resourceType: getResourceTypeFromFile(file),
          tags: ['automation', mediaType],
          userId: userId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as MediaAttachment
      }

      // Update state with new media
      setMediaAttachmentId(newAttachment.id)
      setFilename(file.name)
      
      // Update node with uploaded media - make sure to include ALL properties
      onUpdate(node.id, {
        media: {
          type: mediaType,
          url: newAttachment.secureUrl,
          thumbnailUrl: newAttachment.transformation?.thumbnail || newAttachment.secureUrl,
          filename: newAttachment.originalFilename,
          caption,
        },
        mediaAttachmentId: newAttachment.id,
        caption,
      })

      // Also update existingAttachments state to include the new file
      setExistingAttachments(prev => {
        // Remove any existing temp files
        const filtered = prev.filter(att => !att.id.startsWith('temp_'))
        return [newAttachment!, ...filtered]
      })
      
      toast({
        title: "Media uploaded",
        description: `${file.name} uploaded successfully`,
      })
      
    } else {
      throw new Error(response.data?.uploads?.[0]?.error || 'Upload failed')
    }
    
    setUploadProgress(100)
  } catch (error: any) {
    console.error('Upload error:', error)
    
    toast({
      title: "Upload failed",
      description: error.message || "Failed to upload file. Please try again.",
      variant: "destructive",
    })
    
    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  } finally {
    setTimeout(() => {
      setUploading(false)
      setUploadProgress(0)
    }, 500)
  }
}

const handleSelectExistingAttachment = (attachment: MediaAttachment) => {
  const type = getMediaTypeFromResourceType(attachment.resourceType)
  
  // Clear previous selection
  setMediaAttachmentId(attachment.id)
  setMediaType(type)
  setFilename(attachment.originalFilename || attachment.filename)
  
  // Force update the node data
  onUpdate(node.id, {
    media: {
      type,
      url: attachment.secureUrl,
      thumbnailUrl: attachment.transformation?.thumbnail || attachment.secureUrl,
      filename: attachment.originalFilename || attachment.filename,
      caption,
    },
    mediaAttachmentId: attachment.id,
    caption,
  })
  
  console.log('Selected attachment:', {
    id: attachment.id,
    type,
    filename: attachment.originalFilename,
    url: attachment.secureUrl
  })
}

const clearMedia = () => {
  if (isDeleting || uploading) return
  
  // Clear all media-related state
  setMediaAttachmentId(undefined)
  setFilename('')
  
  // Force a complete reset of node data
  onUpdate(node.id, {
    media: {
      type: mediaType,
      caption: "",
    },
    mediaAttachmentId: undefined,
    caption: "",
  })

  // Clear caption too
  setCaption("")

  // If we have a media attachment ID, try to delete it from the list
  if (mediaAttachmentId && mediaAttachmentId.startsWith('temp_')) {
    // This was a temporary upload during this session, remove from list
    setExistingAttachments(prev => 
      prev.filter(att => att.id !== mediaAttachmentId)
    )
  }
}

  const deleteAttachment = async (attachmentId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    
    if (!confirm('Are you sure you want to delete this media file?')) {
      return
    }

    try {
      setIsDeleting(true)
      const response = await mediaApi.deleteAttachment(attachmentId)
      
      if (response.success) {
        toast({
          title: "File deleted",
          description: "Media file deleted successfully",
        })
        
        // Remove from local state
        setExistingAttachments(prev => prev.filter(att => att.id !== attachmentId))
        
        // If this was the selected attachment, clear it
        if (mediaAttachmentId === attachmentId) {
          clearMedia()
        }
      } else {
        throw new Error(response.message || 'Delete failed')
      }
    } catch (error: any) {
      console.error('Delete error:', error)
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete file",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  // Preview with sample data
  const getPreview = () => {
    return resolveVariable(caption, {
      contact: SAMPLE_CONTACT,
      user: SAMPLE_USER,
      conversation: { id: "conv_123", status: "active", unreadCount: 0 }
    })
  }

  const insertVariable = (variableKey: string) => {
    const variable = `{{${variableKey}}}`
    setCaption(prev => prev + variable)
  }

  // Filter attachments by current media type
  const filteredAttachments = existingAttachments.filter(attachment => {
    const attachmentType = getMediaTypeFromResourceType(attachment.resourceType)
    return attachmentType === mediaType
  })

  // Get selected attachment
  const selectedAttachment = existingAttachments.find(att => att.id === mediaAttachmentId)

  return (
    <div className="w-96 bg-card border-l border-border flex flex-col shadow-lg h-full">
      {/* Header - Fixed */}
      <div className="p-4 border-b border-border flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-purple-100 rounded flex items-center justify-center dark:bg-purple-900/20">
            {mediaType === 'image' && <ImageIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />}
            {mediaType === 'video' && <VideoIcon className="h-4 w-4 text-red-600 dark:text-red-400" />}
            {mediaType === 'audio' && <MusicIcon className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />}
            {mediaType === 'document' && <FileIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />}
          </div>
          <h2 className="font-semibold text-foreground">SEND MEDIA</h2>
          {usedVariables.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {usedVariables.length} variable{usedVariables.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 hover:bg-accent"
            onClick={() => setShowPreview(!showPreview)}
            disabled={uploading}
          >
            {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 hover:bg-accent" 
            onClick={onClose}
            disabled={uploading}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content - Scrollable */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Media Type Selection */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">
              Media Type
            </Label>
            <Select 
              value={mediaType} 
              onValueChange={(value: any) => {
                setMediaType(value)
                // Clear selection if type changes
                if (selectedAttachment && getMediaTypeFromResourceType(selectedAttachment.resourceType) !== value) {
                  clearMedia()
                }
              }}
              disabled={uploading}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select media type" />
              </SelectTrigger>
              <SelectContent>
                {MEDIA_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <type.icon className="h-4 w-4" />
                      <span>{type.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* File Upload/Selection */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">
              Media File
            </Label>
            
            <Tabs defaultValue="upload" disabled={uploading}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload">Upload New</TabsTrigger>
                <TabsTrigger value="existing">Use Existing</TabsTrigger>
              </TabsList>
              
              <TabsContent value="upload" className="space-y-3">
                <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    id="media-upload"
                    className="hidden"
                    onChange={handleFileUpload}
                    accept={
                      mediaType === 'image' ? 'image/*' :
                      mediaType === 'video' ? 'video/*' :
                      mediaType === 'audio' ? 'audio/*' :
                      '*/*'
                    }
                    disabled={uploading}
                  />
                  <label htmlFor="media-upload" className="cursor-pointer">
                    {uploading ? (
                      <div className="space-y-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Uploading {filename}...</p>
                          <Progress value={uploadProgress} className="h-2" />
                          <p className="text-xs text-muted-foreground">{uploadProgress}%</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="h-8 w-8 text-muted-foreground mx-auto" />
                        <p className="text-sm text-muted-foreground">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Max file size: 50MB
                        </p>
                      </div>
                    )}
                  </label>
                </div>
                
                {filename && !uploading && (
                  <div className="flex items-center justify-between bg-muted rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      {mediaType === 'image' && <ImageIcon className="h-4 w-4 text-purple-500" />}
                      {mediaType === 'video' && <VideoIcon className="h-4 w-4 text-red-500" />}
                      {mediaType === 'audio' && <MusicIcon className="h-4 w-4 text-yellow-500" />}
                      {mediaType === 'document' && <FileIcon className="h-4 w-4 text-gray-500" />}
                      <span className="text-sm truncate">{filename}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={clearMedia}
                      className="h-8 w-8 text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                      disabled={isDeleting}
                    >
                      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="existing" className="space-y-3">
                {isLoadingAttachments ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Loading media files...</p>
                  </div>
                ) : filteredAttachments.length > 0 ? (
                  <ScrollArea className="h-48">
                    <div className="space-y-2 pr-2">
                      {filteredAttachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          onClick={() => !isDeleting && handleSelectExistingAttachment(attachment)}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            mediaAttachmentId === attachment.id 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:bg-accent'
                          } ${isDeleting ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {attachment.resourceType === 'image' && attachment.secureUrl ? (
                            <img 
                              src={attachment.transformation?.thumbnail || attachment.secureUrl} 
                              alt={attachment.originalFilename}
                              className="w-12 h-12 rounded object-cover flex-shrink-0"
                              onError={(e) => {
                                // Fallback if image fails to load
                                const target = e.target as HTMLImageElement
                                target.style.display = 'none'
                                target.parentElement!.innerHTML = '<div class="w-12 h-12 rounded bg-muted flex items-center justify-center"><ImageIcon class="h-6 w-6 text-muted-foreground" /></div>'
                              }}
                            />
                          ) : (
                            <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                              {attachment.resourceType === 'video' && <VideoIcon className="h-6 w-6 text-muted-foreground" />}
                              {attachment.resourceType === 'audio' && <MusicIcon className="h-6 w-6 text-muted-foreground" />}
                              {attachment.resourceType === 'raw' && <FileIcon className="h-6 w-6 text-muted-foreground" />}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {attachment.originalFilename}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(attachment.createdAt).toLocaleDateString()} • 
                              {(attachment.fileSize / 1024).toFixed(1)} KB
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => deleteAttachment(attachment.id, e)}
                            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            disabled={isDeleting}
                          >
                            {isDeleting && mediaAttachmentId === attachment.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">No {mediaType} files found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Upload files in the "Upload New" tab
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Caption Editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium text-foreground">
                Caption {mediaType === 'audio' && '(Optional)'}
              </Label>
              <span className="text-xs text-muted-foreground">
                {caption.length}/3000
              </span>
            </div>
            
            {showPreview ? (
              <div className="border border-border rounded-lg p-3 bg-muted min-h-[60px]">
                <p className="text-sm whitespace-pre-wrap text-foreground">{getPreview()}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Preview with sample data
                </p>
              </div>
            ) : (
              <Textarea
                placeholder={`Add a caption for your ${mediaType}... Use {{variables}} for personalization`}
                value={caption}
                onChange={(e) => {
                  if (e.target.value.length <= 3000) {
                    setCaption(e.target.value)
                  }
                }}
                className="min-h-[60px] resize-none bg-background"
                disabled={mediaType === 'audio' || uploading}
              />
            )}
            
            {mediaType === 'audio' && (
              <p className="text-xs text-muted-foreground mt-1">
                Note: WhatsApp audio messages don't support captions
              </p>
            )}
          </div>

          {/* Used Variables */}
          {usedVariables.length > 0 && (
            <div>
              <Label className="text-sm font-medium text-foreground mb-2 block">
                Variables Used
              </Label>
              <div className="flex flex-wrap gap-2">
                {usedVariables.map(variableKey => (
                  <Badge 
                    key={variableKey} 
                    variant="outline" 
                    className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
                  >
                    <Variable className="h-3 w-3 mr-1" />
                    {`{{${variableKey}}}`}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Variable Picker */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">
              Insert Variables
            </Label>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full justify-between bg-background border-border"
                  disabled={uploading || mediaType === 'audio'}
                >
                  <div className="flex items-center gap-2">
                    <Variable className="h-4 w-4" />
                    <span>Select a variable...</span>
                  </div>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 max-h-64 overflow-y-auto bg-card border-border">
                <DropdownMenuLabel className="text-foreground">Available Variables</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                <DropdownMenuItem
                  onClick={() => insertVariable('contact.name')}
                  className="flex items-center gap-2 cursor-pointer text-foreground hover:bg-accent"
                >
                  <Variable className="h-3 w-3 text-blue-500" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {"{{contact.name}}"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Contact's full name
                    </span>
                  </div>
                </DropdownMenuItem>
                
                <DropdownMenuItem
                  onClick={() => insertVariable('contact.first_name')}
                  className="flex items-center gap-2 cursor-pointer text-foreground hover:bg-accent"
                >
                  <Variable className="h-3 w-3 text-blue-500" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {"{{contact.first_name}}"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Contact's first name
                    </span>
                  </div>
                </DropdownMenuItem>
                
                <DropdownMenuItem
                  onClick={() => insertVariable('contact.phone')}
                  className="flex items-center gap-2 cursor-pointer text-foreground hover:bg-accent"
                >
                  <Variable className="h-3 w-3 text-blue-500" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {"{{contact.phone}}"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Contact's phone number
                    </span>
                  </div>
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem
                  onClick={() => insertVariable('user.name')}
                  className="flex items-center gap-2 cursor-pointer text-foreground hover:bg-accent"
                >
                  <Variable className="h-3 w-3 text-blue-500" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {"{{user.name}}"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Your name
                    </span>
                  </div>
                </DropdownMenuItem>
                
                <DropdownMenuItem
                  onClick={() => insertVariable('user.companyName')}
                  className="flex items-center gap-2 cursor-pointer text-foreground hover:bg-accent"
                >
                  <Variable className="h-3 w-3 text-blue-500" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {"{{user.companyName}}"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Your company name
                    </span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </ScrollArea>

      {/* Footer - Fixed */}
      <div className="p-4 border-t border-border flex-shrink-0">
        <div className="flex items-center justify-between text-xs">
          <div className="text-muted-foreground">
            Node: {node.id.substring(0, 8)}...
          </div>
          <div className={`flex items-center gap-1 font-medium ${
            mediaAttachmentId ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
          }`}>
            {uploading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Uploading...</span>
              </>
            ) : mediaAttachmentId ? (
              <>
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span>Ready to send</span>
              </>
            ) : (
              <>
                <div className="h-2 w-2 rounded-full bg-amber-500" />
                <span>Needs media</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}