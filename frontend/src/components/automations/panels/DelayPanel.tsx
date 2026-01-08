"use client"

import { useState, useEffect } from "react"
import { X, Clock, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Slider 
} from "@/components/ui/slider"
import type { Node } from "@xyflow/react"

interface DelayPanelProps {
  node: Node
  onClose: () => void
  onUpdate: (nodeId: string, data: any) => void
}

const DELAY_UNITS = [
  { value: 'seconds', label: 'Seconds', description: 'Short delays' },
  { value: 'minutes', label: 'Minutes', description: 'Most common delays' },
  { value: 'hours', label: 'Hours', description: 'Longer delays' },
  { value: 'days', label: 'Days', description: 'Multi-day delays' },
] as const

type DelayUnit = typeof DELAY_UNITS[number]['value']

export default function DelayPanel({ node, onClose, onUpdate }: DelayPanelProps) {
  const [delayValue, setDelayValue] = useState<number>(node.data?.delayValue || 5)
  const [delayUnit, setDelayUnit] = useState<DelayUnit>(node.data?.delayUnit || 'minutes')
  const [label, setLabel] = useState(node.data?.label || "")

  // Update node data when configuration changes
  useEffect(() => {
    onUpdate(node.id, {
      label: label || `Wait ${delayValue} ${delayUnit}`,
      delayValue,
      delayUnit,
    })
  }, [delayValue, delayUnit, label, node.id, onUpdate])

  const getTotalSeconds = () => {
    switch (delayUnit) {
      case 'seconds': return delayValue
      case 'minutes': return delayValue * 60
      case 'hours': return delayValue * 60 * 60
      case 'days': return delayValue * 24 * 60 * 60
      default: return delayValue
    }
  }

  const formatDuration = (totalSeconds: number) => {
    const days = Math.floor(totalSeconds / (24 * 60 * 60))
    const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60))
    const minutes = Math.floor((totalSeconds % (60 * 60)) / 60)
    const seconds = totalSeconds % 60

    const parts = []
    if (days > 0) parts.push(`${days}d`)
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0) parts.push(`${minutes}m`)
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`)

    return parts.join(' ')
  }

  const totalSeconds = getTotalSeconds()

  return (
    <div className="w-96 bg-card border-l border-border flex flex-col shadow-lg">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-indigo-100 rounded flex items-center justify-center dark:bg-indigo-900/20">
            <Clock className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h2 className="font-semibold text-foreground">DELAY</h2>
          <Badge variant="outline" className="ml-2 bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800">
            {delayValue} {delayUnit}
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Node Label */}
        <div>
          <Label className="text-sm font-medium text-foreground mb-2 block">
            Delay Label
          </Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Enter a descriptive name for this delay..."
            className="bg-background"
          />
        </div>

        {/* Delay Configuration */}
        <div className="space-y-4">
          <Label className="text-sm font-medium text-foreground mb-2 block">
            Delay Duration
          </Label>
          
          {/* Unit Selection */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Time Unit</Label>
            <Select value={delayUnit} onValueChange={(value: DelayUnit) => setDelayUnit(value)}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="Select time unit" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {DELAY_UNITS.map(unit => (
                  <SelectItem key={unit.value} value={unit.value} className="cursor-pointer">
                    <div className="flex flex-col">
                      <span className="font-medium">{unit.label}</span>
                      <span className="text-xs text-muted-foreground">{unit.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Value Selection */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-sm text-muted-foreground">Duration</Label>
              <div className="text-sm font-medium text-foreground">
                {delayValue} {delayUnit}
              </div>
            </div>
            
            {delayUnit === 'seconds' && (
              <Slider
                value={[delayValue]}
                onValueChange={(value) => setDelayValue(value[0])}
                min={1}
                max={60}
                step={1}
                className="w-full"
              />
            )}
            {delayUnit === 'minutes' && (
              <Slider
                value={[delayValue]}
                onValueChange={(value) => setDelayValue(value[0])}
                min={1}
                max={120}
                step={1}
                className="w-full"
              />
            )}
            {delayUnit === 'hours' && (
              <Slider
                value={[delayValue]}
                onValueChange={(value) => setDelayValue(value[0])}
                min={1}
                max={48}
                step={1}
                className="w-full"
              />
            )}
            {delayUnit === 'days' && (
              <Slider
                value={[delayValue]}
                onValueChange={(value) => setDelayValue(value[0])}
                min={1}
                max={30}
                step={1}
                className="w-full"
              />
            )}

            {/* Quick Presets */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              {delayUnit === 'seconds' && [5, 15, 30].map(preset => (
                <Button
                  key={preset}
                  variant="outline"
                  size="sm"
                  onClick={() => setDelayValue(preset)}
                  className={delayValue === preset ? "bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800" : ""}
                >
                  {preset}s
                </Button>
              ))}
              {delayUnit === 'minutes' && [5, 15, 30].map(preset => (
                <Button
                  key={preset}
                  variant="outline"
                  size="sm"
                  onClick={() => setDelayValue(preset)}
                  className={delayValue === preset ? "bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800" : ""}
                >
                  {preset}m
                </Button>
              ))}
              {delayUnit === 'hours' && [1, 4, 8].map(preset => (
                <Button
                  key={preset}
                  variant="outline"
                  size="sm"
                  onClick={() => setDelayValue(preset)}
                  className={delayValue === preset ? "bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800" : ""}
                >
                  {preset}h
                </Button>
              ))}
              {delayUnit === 'days' && [1, 3, 7].map(preset => (
                <Button
                  key={preset}
                  variant="outline"
                  size="sm"
                  onClick={() => setDelayValue(preset)}
                  className={delayValue === preset ? "bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800" : ""}
                >
                  {preset}d
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Total Duration Display */}
        <div className="p-4 bg-muted rounded-lg border border-border">
          <div className="text-sm font-medium text-foreground mb-2">Total Delay</div>
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {formatDuration(totalSeconds)}
            </div>
            <div className="text-sm text-muted-foreground">
              {totalSeconds.toLocaleString()} seconds
            </div>
          </div>
        </div>

        {/* Example Timeline */}
        <div className="space-y-3">
          <Label className="text-sm font-medium text-foreground">Example Timeline</Label>
          <div className="p-3 bg-muted/50 rounded-lg border border-border/50">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-muted-foreground">Before Delay</span>
              <span className="font-medium text-foreground">→</span>
              <span className="text-muted-foreground">After Delay</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <div className="w-20 text-right text-muted-foreground">Step 1</div>
                <div className="flex-1 h-2 bg-border rounded-full"></div>
                <div className="w-20 text-left">Send message</div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-20 text-right text-muted-foreground">Delay</div>
                <div className="flex-1 flex items-center">
                  <div className="h-2 bg-indigo-500 rounded-full animate-pulse flex-1"></div>
                  <Clock className="h-3 w-3 ml-1 text-indigo-500" />
                </div>
                <div className="w-20 text-left text-indigo-600 dark:text-indigo-400 font-medium">
                  Wait {delayValue} {delayUnit}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-20 text-right text-muted-foreground">Step 2</div>
                <div className="flex-1 h-2 bg-border rounded-full"></div>
                <div className="w-20 text-left">Next action</div>
              </div>
            </div>
          </div>
        </div>

        {/* Use Cases */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Common Use Cases</Label>
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-0.5"></div>
              <span><strong>Follow-up messages:</strong> Wait 5-10 minutes between automated responses</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-0.5"></div>
              <span><strong>Order processing:</strong> Give 1-2 hours for order confirmation</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-0.5"></div>
              <span><strong>Appointment reminders:</strong> Send 24-hour and 1-hour reminders</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Node ID: {node.id}</span>
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3 text-indigo-500" />
            <span className="font-medium text-foreground">
              {delayValue} {delayUnit} delay
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}