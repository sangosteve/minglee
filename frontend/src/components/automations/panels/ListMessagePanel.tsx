// frontend/src/components/automations/panels/ListMessagePanel.tsx
import { useState, useEffect } from "react"
import { X, Plus, Trash2, List, ChevronUp, ChevronDown, Variable } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import type { Node } from "@xyflow/react"

interface ListMessageData {
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
}

interface ListMessagePanelProps {
  node: Node<ListMessageData>
  onClose: () => void
  onUpdate: (nodeId: string, data: any) => void
}

export default function ListMessagePanel({ node, onClose, onUpdate }: ListMessagePanelProps) {
  const [label, setLabel] = useState(node.data?.label || "")
  const [header, setHeader] = useState(node.data?.header || "")
  const [body, setBody] = useState(node.data?.body || "")
  const [footer, setFooter] = useState(node.data?.footer || "")
  const [buttonText, setButtonText] = useState(node.data?.buttonText || "Options")
  const [sections, setSections] = useState<Array<{
    id: string
    title: string
    rows: Array<{
      id: string
      title: string
      description?: string
    }>
  }>>(node.data?.sections || [])

  useEffect(() => {
    onUpdate(node.id, {
      label: label || `List Message`,
      header,
      body,
      footer,
      buttonText,
      sections
    })
  }, [label, header, body, footer, buttonText, sections, node.id, onUpdate])

  const addSection = () => {
    if (sections.length >= 10) {
      alert("WhatsApp allows maximum 10 sections")
      return
    }
    
    const newSection = {
      id: `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: `Section ${sections.length + 1}`,
      rows: []
    }
    
    setSections(prev => [...prev, newSection])
  }

  const updateSectionTitle = (sectionId: string, title: string) => {
    setSections(prev => 
      prev.map(section => 
        section.id === sectionId ? { ...section, title } : section
      )
    )
  }

  const removeSection = (sectionId: string) => {
    setSections(prev => prev.filter(section => section.id !== sectionId))
  }

  const addRow = (sectionId: string) => {
    const section = sections.find(s => s.id === sectionId)
    if (!section) return

    const totalRows = sections.reduce((total, sec) => total + sec.rows.length, 0)
    if (totalRows >= 10) {
      alert("WhatsApp allows maximum 10 rows across all sections")
      return
    }

    const newRow = {
      id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: `Option ${section.rows.length + 1}`,
      description: ""
    }
    
    setSections(prev => 
      prev.map(section => 
        section.id === sectionId 
          ? { ...section, rows: [...section.rows, newRow] }
          : section
      )
    )
  }

  const updateRow = (sectionId: string, rowId: string, field: string, value: string) => {
    setSections(prev => 
      prev.map(section => 
        section.id === sectionId 
          ? {
              ...section,
              rows: section.rows.map(row =>
                row.id === rowId ? { ...row, [field]: value } : row
              )
            }
          : section
      )
    )
  }

  const removeRow = (sectionId: string, rowId: string) => {
    setSections(prev => 
      prev.map(section => 
        section.id === sectionId 
          ? { ...section, rows: section.rows.filter(row => row.id !== rowId) }
          : section
      )
    )
  }

  const moveSection = (fromIndex: number, toIndex: number) => {
    const newSections = [...sections]
    const [movedSection] = newSections.splice(fromIndex, 1)
    newSections.splice(toIndex, 0, movedSection)
    setSections(newSections)
  }

  const moveRow = (sectionId: string, fromIndex: number, toIndex: number) => {
    setSections(prev => 
      prev.map(section => {
        if (section.id !== sectionId) return section
        
        const newRows = [...section.rows]
        const [movedRow] = newRows.splice(fromIndex, 1)
        newRows.splice(toIndex, 0, movedRow)
        
        return { ...section, rows: newRows }
      })
    )
  }

  const totalRows = sections.reduce((total, section) => total + section.rows.length, 0)

  return (
    <div className="w-96 bg-card border-l border-border flex flex-col shadow-lg">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center dark:bg-blue-900/20">
            <List className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="font-semibold text-foreground">WHATSAPP LIST MESSAGE</h2>
          <Badge variant="secondary" className="ml-2">
            {sections.length}/10 sections, {totalRows}/10 rows
          </Badge>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 hover:bg-accent" 
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">
              Node Label
            </Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Enter a name for this list message..."
              className="bg-background border-border"
            />
          </div>

          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">
              Header (Optional)
            </Label>
            <Input
              placeholder="List header..."
              value={header}
              onChange={(e) => setHeader(e.target.value)}
              maxLength={60}
              className="bg-background border-border"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Optional header text (max 60 characters)
            </p>
          </div>

          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">
              Body Text <span className="text-destructive">*</span>
            </Label>
            <Textarea
              placeholder="Enter your message here..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-[80px] resize-none bg-background border-border"
              required
              maxLength={1024}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Main message content (max 1024 characters)
            </p>
          </div>

          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">
              Footer (Optional)
            </Label>
            <Input
              placeholder="Footer text..."
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
              maxLength={60}
              className="bg-background border-border"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Optional footer text (max 60 characters)
            </p>
          </div>

          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">
              Button Text <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="Button text..."
              value={buttonText}
              onChange={(e) => setButtonText(e.target.value)}
              maxLength={20}
              required
              className="bg-background border-border"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Button label that reveals the list (max 20 characters)
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium text-foreground">
                Sections & Options <span className="text-destructive">*</span>
              </Label>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={addSection}
                disabled={sections.length >= 10}
                className="border-border"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Section
              </Button>
            </div>

            {sections.length === 0 ? (
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                <List className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No sections added. Add sections with options for users to choose from.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {sections.map((section, sectionIndex) => (
                  <div
                    key={section.id}
                    className="border border-border rounded-lg p-4 bg-muted"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => sectionIndex > 0 && moveSection(sectionIndex, sectionIndex - 1)}
                          disabled={sectionIndex === 0}
                          className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => sectionIndex < sections.length - 1 && moveSection(sectionIndex, sectionIndex + 1)}
                          disabled={sectionIndex === sections.length - 1}
                          className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </div>
                      
                      <div className="flex-1">
                        <Input
                          value={section.title}
                          onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                          placeholder="Section title"
                          maxLength={24}
                          className="bg-background border-border"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Section title (max 24 characters)
                        </p>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeSection(section.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {section.rows.map((row, rowIndex) => (
                        <div
                          key={row.id}
                          className="flex items-start gap-2 p-3 border border-border rounded bg-background"
                        >
                          <div className="flex items-center gap-1 mt-2">
                            <button
                              type="button"
                              onClick={() => rowIndex > 0 && moveRow(section.id, rowIndex, rowIndex - 1)}
                              disabled={rowIndex === 0}
                              className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                            >
                              <ChevronUp className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => rowIndex < section.rows.length - 1 && moveRow(section.id, rowIndex, rowIndex + 1)}
                              disabled={rowIndex === section.rows.length - 1}
                              className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                            >
                              <ChevronDown className="h-3 w-3" />
                            </button>
                          </div>
                          
                          <div className="flex-1 space-y-2">
                            <Input
                              value={row.title}
                              onChange={(e) => updateRow(section.id, row.id, 'title', e.target.value)}
                              placeholder="Option title"
                              maxLength={24}
                              className="bg-background border-border"
                            />
                            <Input
                              value={row.description || ''}
                              onChange={(e) => updateRow(section.id, row.id, 'description', e.target.value)}
                              placeholder="Option description (optional)"
                              maxLength={72}
                              className="bg-background border-border"
                            />
                            <p className="text-xs text-muted-foreground">
                              ID: {row.id.slice(0, 8)}... • Title: max 24 chars • Description: max 72 chars
                            </p>
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeRow(section.id, row.id)}
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 mt-2"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addRow(section.id)}
                      disabled={totalRows >= 10}
                      className="w-full mt-2 border-border"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Option to Section
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {sections.length > 0 && (
              <div className="mt-3 p-3 bg-blue-100 border border-blue-200 rounded-lg dark:bg-blue-900/20 dark:border-blue-800">
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                  Option Connections
                </h4>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Each option will have an output handle. Connect nodes to each option 
                  to define what happens when users select that option in WhatsApp.
                </p>
                <div className="mt-2 space-y-1">
                  {sections.flatMap(section => 
                    section.rows.slice(0, 3).map(row => (
                      <div key={row.id} className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="font-medium text-foreground">"{row.title}"</span>
                        <span className="text-blue-600 dark:text-blue-400">→ User selects this option</span>
                      </div>
                    ))
                  )}
                  {totalRows > 3 && (
                    <div className="text-xs text-muted-foreground">
                      ...and {totalRows - 3} more options
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="p-3 bg-blue-100 border border-blue-200 rounded-lg dark:bg-blue-900/20 dark:border-blue-800">
            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
              WhatsApp List Messages
            </h4>
            <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
              This will send an interactive list message with up to 10 sections and 10 total options.
              Users can tap the button to see options and select one, and the automation will continue based on their selection.
            </p>
            <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <div>• Header: Optional, max 60 characters</div>
              <div>• Body: Required, max 1024 characters</div>
              <div>• Footer: Optional, max 60 characters</div>
              <div>• Button Text: Required, max 20 characters</div>
              <div>• Sections: Up to 10, each with title (max 24 chars)</div>
              <div>• Options: Up to 10 total, each with title (max 24 chars) and optional description (max 72 chars)</div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Node ID: {node.id}</span>
          <div className="flex items-center gap-2">
            <List className="h-3 w-3 text-blue-500" />
            <span className="font-medium text-foreground">
              {sections.length} sections, {totalRows} options
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}