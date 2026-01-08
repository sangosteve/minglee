// frontend/src/components/automations/nodes/ListMessageNode.tsx
import type React from "react"
import { memo, useState, useRef, useLayoutEffect, useMemo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { List, MoreHorizontal, Copy, CopyPlus, Replace, Hash, Trash2, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface ListMessageNodeData {
  header?: string
  body: string
  footer?: string
  buttonText: string
  sections: Array<{
    id: string
    title: string
    rows: Array<{
      id: string
      title: string
      description?: string
    }>
  }>
  onDelete?: (id: string) => void
  onSelect?: (id: string) => void
  onUpdate?: (id: string, data: any) => void
  label?: string
}

function ListMessageNode({ data, id, selected }: NodeProps<ListMessageNodeData>) {
  const [showMenu, setShowMenu] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [showAllSections, setShowAllSections] = useState(false)
  const [handlePositions, setHandlePositions] = useState<number[]>([])
  const nodeRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<(HTMLDivElement | null)[]>([])

  // Calculate only visible rows from expanded sections
  const visibleRows = useMemo(() => {
    if (!data.sections) return []
    
    const rows: Array<{
      id: string
      title: string
      description?: string
      sectionId: string
      sectionTitle: string
      globalIndex: number
    }> = []
    
    let globalIndex = 0
    
    data.sections.forEach((section, sectionIndex) => {
      const isExpanded = expandedSections[section.id] ?? (sectionIndex === 0)
      if (isExpanded) {
        section.rows?.forEach(row => {
          rows.push({
            ...row,
            sectionId: section.id,
            sectionTitle: section.title,
            globalIndex
          })
          globalIndex++
        })
      } else {
        globalIndex += section.rows?.length || 0
      }
    })
    
    return rows
  }, [data.sections, expandedSections])

  // Initialize expanded sections - expand first section by default
  useLayoutEffect(() => {
    const initialExpanded: Record<string, boolean> = {}
    data.sections?.forEach((section, index) => {
      initialExpanded[section.id] = index === 0
    })
    setExpandedSections(initialExpanded)
  }, [data.sections])

  // Calculate handle positions using useLayoutEffect
  useLayoutEffect(() => {
    if (!nodeRef.current) return

    const node = nodeRef.current
    const nodeHeight = node.offsetHeight

    const positions: number[] = []
    rowRefs.current.forEach((rowElement) => {
      if (rowElement && node) {
        const rowTop = rowElement.offsetTop
        const rowHeight = rowElement.offsetHeight
        const rowCenter = rowTop + rowHeight / 2
        const relativePosition = (rowCenter / nodeHeight) * 100
        positions.push(relativePosition)
      }
    })

    setHandlePositions(positions)
  }, [visibleRows, data.sections, expandedSections, showAllSections, data.header, data.body, data.footer, data.buttonText])

  const toggleSection = (sectionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }))
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    console.log("[ListMessage] Copy block:", id)
  }

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation()
    console.log("[ListMessage] Duplicate block:", id)
  }

  const handleReplace = (e: React.MouseEvent) => {
    e.stopPropagation()
    console.log("[ListMessage] Replace block:", id)
  }

  const handleCopyId = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(id)
    console.log("[ListMessage] Copied block id:", id)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (data.onDelete) {
      data.onDelete(id)
    }
  }

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (data.onSelect) {
      data.onSelect(id)
    }
  }

  // Updated truncation function with better character limits
  const getTruncatedText = (text: string, maxLength: number = 100) => {
    if (!text) return ""
    return text.length <= maxLength ? text : text.substring(0, maxLength) + '...'
  }

  const displayBody = data.body || "Click to configure list message..."
  const totalRows = data.sections?.reduce((acc, section) => acc + (section.rows?.length || 0), 0) || 0
  const totalSections = data.sections?.length || 0

  // Determine which sections to display
  const displaySections = showAllSections ? data.sections : data.sections?.slice(0, 2)

  // Get section index for a row
  const getSectionIndex = (sectionId: string) => {
    return data.sections.findIndex(s => s.id === sectionId)
  }

  // Get global row index
  const getGlobalRowIndex = (sectionId: string, rowIndex: number) => {
    const sectionIndex = getSectionIndex(sectionId)
    const rowsBefore = data.sections
      .slice(0, sectionIndex)
      .reduce((acc, s) => acc + s.rows.length, 0)
    return rowsBefore + rowIndex
  }

  return (
    <div
      ref={nodeRef}
      className={cn(
        "bg-card rounded-lg border-2 border-border shadow-sm hover:shadow-md transition-shadow min-w-[320px] max-w-[480px] group relative cursor-pointer",
        selected && "border-blue-500 border-2"
      )}
      onClick={handleSelect}
      style={{ minHeight: totalRows > 0 ? 'auto' : '180px' }}
    >
      <div className="px-4 py-3 flex items-center gap-2 border-b border-border">
        <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center dark:bg-blue-900/20">
          <List className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-foreground truncate">
            {data.label || "List Message"}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {totalRows > 0 ? `${totalSections} sections, ${totalRows} options` : "Not configured"}
          </div>
        </div>
        
        <DropdownMenu open={showMenu} onOpenChange={setShowMenu}>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-card border-border">
            <DropdownMenuItem onClick={handleSelect} className="gap-2 text-foreground">
              Configure list
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopy} className="gap-2 text-foreground">
              <Copy className="h-4 w-4" />
              Copy block
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDuplicate} className="gap-2 text-foreground">
              <CopyPlus className="h-4 w-4" />
              Duplicate block
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleReplace} className="gap-2 text-foreground">
              <Replace className="h-4 w-4" />
              Replace block
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopyId} className="gap-2 text-foreground">
              <Hash className="h-4 w-4" />
              Copy block ID
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={handleDelete} 
              className="gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Delete block
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <div className="px-4 py-3">
        {totalRows > 0 ? (
          <>
            {data.header && (
              <div className="text-xs font-semibold text-muted-foreground mb-1">
                {getTruncatedText(data.header, 80)}
              </div>
            )}
            
            <div className="text-sm text-muted-foreground break-words whitespace-pre-wrap line-clamp-2 mb-2">
              {getTruncatedText(displayBody, 120)}
            </div>
            
            {data.footer && (
              <div className="text-xs text-muted-foreground mb-2">
                {getTruncatedText(data.footer, 80)}
              </div>
            )}

            {data.buttonText && (
              <div className="mb-3">
                <div className="text-xs text-muted-foreground mb-1">Button:</div>
                <div className="text-xs font-medium text-blue-600 bg-blue-100 border border-blue-200 rounded px-2 py-1 inline-block dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800">
                  {getTruncatedText(data.buttonText, 30)}
                </div>
              </div>
            )}
            
            <div className="space-y-2 mt-2 max-h-[300px] overflow-y-auto pr-1">
              {displaySections?.map((section) => {
                const isExpanded = expandedSections[section.id] ?? (getSectionIndex(section.id) === 0)
                const displayRows = isExpanded ? section.rows : section.rows.slice(0, 1)
                
                return (
                  <div key={section.id} className="border border-border rounded p-2">
                    <div 
                      className="flex items-center justify-between cursor-pointer mb-1"
                      onClick={(e) => toggleSection(section.id, e)}
                    >
                      <div className="text-xs font-medium text-foreground truncate flex-1">
                        {getTruncatedText(section.title, 50)}
                        <span className="text-muted-foreground ml-2 text-xs">
                          ({section.rows.length} {section.rows.length === 1 ? 'option' : 'options'})
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 ml-2"
                        onClick={(e) => toggleSection(section.id, e)}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    
                    {section.rows.length > 0 && (
                      <div className="space-y-1.5 mt-1">
                        {displayRows.map((row, rowIndex) => {
                          const globalRowIndex = getGlobalRowIndex(section.id, rowIndex)
                          
                          return (
                            <div 
                              key={row.id}
                              ref={(el) => {
                                if (isExpanded) {
                                  const visibleIndex = visibleRows.findIndex(r => r.id === row.id)
                                  if (visibleIndex !== -1) {
                                    rowRefs.current[visibleIndex] = el
                                  }
                                }
                              }}
                              className="flex items-start gap-2 text-xs bg-muted/50 border border-border rounded p-2 relative group/row"
                              data-row-id={row.id}
                              data-row-index={globalRowIndex}
                            >
                              <span className="text-muted-foreground font-mono text-xs mt-0.5 flex-shrink-0">
                                #{globalRowIndex + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="text-foreground font-medium break-words">
                                  {getTruncatedText(row.title, 60)}
                                </div>
                                {row.description && (
                                  <div className="text-muted-foreground text-xs mt-0.5 break-words">
                                    {getTruncatedText(row.description, 80)}
                                  </div>
                                )}
                              </div>
                              {isExpanded && (
                                <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                  <div className="text-[10px] text-green-600 font-medium px-1.5 py-0.5 bg-green-100 rounded border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
                                    Handle
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                        
                        {!isExpanded && section.rows.length > 1 && (
                          <div 
                            className="text-xs text-muted-foreground text-center py-1 cursor-pointer hover:text-foreground"
                            onClick={(e) => toggleSection(section.id, e)}
                          >
                            + {section.rows.length - 1} more option{section.rows.length - 1 > 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
              
              {!showAllSections && totalSections > 2 && (
                <div className="pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowAllSections(true)
                    }}
                  >
                    Show all {totalSections} sections
                  </Button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-6">
            <List className="h-8 w-8 mx-auto mb-2 text-blue-400" />
            <div>Click to configure WhatsApp list message</div>
          </div>
        )}
        
        <div className="flex justify-between items-center mt-3 pt-3 border-t border-border/50">
          <span className="text-xs text-muted-foreground">
            {totalRows > 0 ? `${totalSections} sections, ${totalRows} options` : "Not configured"}
          </span>
          <span className="text-xs text-blue-600 font-medium dark:text-blue-400">
            WhatsApp List
          </span>
        </div>
      </div>

      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-card !shadow-sm"
        style={{ top: '50%' }}
      />

      {/* Output handles - One for each visible row */}
      {visibleRows.map((row, index) => {
        const topPosition = handlePositions[index] !== undefined ? handlePositions[index] : 50
        
        return (
          <Handle
            key={`row-${row.id}`}
            type="source"
            position={Position.Right}
            id={`row-${row.id}`}
            className="!w-3 !h-3 !bg-green-500 !border-2 !border-card !shadow-sm z-10"
            style={{ 
              top: `${topPosition}%`,
              right: '-6px'
            }}
          />
        )
      })}
    </div>
  )
}

export default memo(ListMessageNode)