// frontend/src/components/automations/panels/ConditionPanel.tsx
"use client"

import { useState, useEffect } from "react"
import { X, Plus, Trash2, ChevronDown, Check, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { Node } from "@xyflow/react"
import { SYSTEM_VARIABLES, VARIABLE_CATEGORIES } from "@/lib/system-variables"

interface ConditionRule {
  id: string
  field: string
  operator: string
  value: string
}

interface ConditionPanelProps {
  node: Node
  onClose: () => void
  onUpdate: (nodeId: string, data: any) => void
}

// Available operators
const OPERATORS = [
  { value: "equals", label: "Equals", description: "Exactly matches the value" },
  { value: "not_equals", label: "Does Not Equal", description: "Does not match the value" },
  { value: "contains", label: "Contains", description: "Contains the text" },
  { value: "not_contains", label: "Does Not Contain", description: "Does not contain the text" },
  { value: "starts_with", label: "Starts With", description: "Begins with the text" },
  { value: "ends_with", label: "Ends With", description: "Ends with the text" },
  { value: "greater_than", label: "Greater Than", description: "Greater than the number" },
  { value: "less_than", label: "Less Than", description: "Less than the number" },
  { value: "greater_than_or_equal", label: "Greater Than or Equal", description: "Greater than or equal to the number" },
  { value: "less_than_or_equal", label: "Less Than or Equal", description: "Less than or equal to the number" },
  { value: "is_empty", label: "Is Empty", description: "Field is empty or null" },
  { value: "is_not_empty", label: "Is Not Empty", description: "Field is not empty" },
  { value: "exists", label: "Exists", description: "Field exists" },
  { value: "not_exists", label: "Does Not Exist", description: "Field does not exist" },
]

// Available fields (from system variables)
const AVAILABLE_FIELDS = SYSTEM_VARIABLES.filter(variable => 
  variable.category === 'contact' || variable.category === 'conversation'
).map(variable => ({
  id: variable.key,
  label: variable.label,
  description: variable.description,
  category: variable.category,
  type: variable.type || 'text'
}))

// Field type specific operators
const FIELD_TYPE_OPERATORS: Record<string, string[]> = {
  text: ["equals", "not_equals", "contains", "not_contains", "starts_with", "ends_with", "is_empty", "is_not_empty"],
  number: ["equals", "not_equals", "greater_than", "less_than", "greater_than_or_equal", "less_than_or_equal", "is_empty", "is_not_empty"],
  date: ["equals", "not_equals", "greater_than", "less_than", "greater_than_or_equal", "less_than_or_equal", "is_empty", "is_not_empty"],
  boolean: ["equals", "not_equals"],
  array: ["contains", "not_contains", "is_empty", "is_not_empty"],
  tags: ["contains", "not_contains", "is_empty", "is_not_empty"],
}

// Generate a unique ID for new rules
const generateId = () => `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

export default function ConditionPanel({ node, onClose, onUpdate }: ConditionPanelProps) {
  const [label, setLabel] = useState(node.data?.label || "Condition")
  const [rules, setRules] = useState<ConditionRule[]>(node.data?.rules || [])
  const [logic, setLogic] = useState<'all' | 'any'>(node.data?.logic || 'all')
  const [isAddingRule, setIsAddingRule] = useState(false)

  // Update node data when configuration changes
  useEffect(() => {
    onUpdate(node.id, {
      label,
      rules,
      logic
    })
  }, [label, rules, logic, node.id, onUpdate])

  // Add a new rule
  const addRule = () => {
    const newRule: ConditionRule = {
      id: generateId(),
      field: "",
      operator: "equals",
      value: ""
    }
    setRules([...rules, newRule])
    setIsAddingRule(false)
  }

  // Remove a rule
  const removeRule = (ruleId: string) => {
    setRules(rules.filter(rule => rule.id !== ruleId))
  }

  // Update a rule
  const updateRule = (ruleId: string, field: keyof ConditionRule, value: string) => {
    setRules(rules.map(rule => {
      if (rule.id === ruleId) {
        return { ...rule, [field]: value }
      }
      return rule
    }))
  }

  // Get field type
  const getFieldType = (fieldId: string): string => {
    const field = AVAILABLE_FIELDS.find(f => f.id === fieldId)
    return field?.type || 'text'
  }

  // Get available operators for a field
  const getAvailableOperators = (fieldId: string) => {
    if (!fieldId) return OPERATORS
    
    const fieldType = getFieldType(fieldId)
    const operators = FIELD_TYPE_OPERATORS[fieldType] || FIELD_TYPE_OPERATORS.text
    
    return OPERATORS.filter(op => operators.includes(op.value))
  }

  // Check if rule is valid
  const isRuleValid = (rule: ConditionRule): boolean => {
    if (!rule.field || !rule.operator) return false
    
    const requiresValue = ![
      'is_empty', 'is_not_empty', 
      'exists', 'not_exists'
    ].includes(rule.operator)
    
    if (requiresValue && !rule.value.trim()) return false
    
    return true
  }

  // Check if all rules are valid
  const isValid = rules.every(isRuleValid)

  // Get field label
  const getFieldLabel = (fieldId: string): string => {
    const field = AVAILABLE_FIELDS.find(f => f.id === fieldId)
    return field?.label || fieldId
  }

  // Get operator label
  const getOperatorLabel = (operatorValue: string): string => {
    const operator = OPERATORS.find(op => op.value === operatorValue)
    return operator?.label || operatorValue
  }

  // Get field description
  const getFieldDescription = (fieldId: string): string => {
    const field = AVAILABLE_FIELDS.find(f => f.id === fieldId)
    return field?.description || ""
  }

  // Render value input based on field type
  const renderValueInput = (rule: ConditionRule) => {
    const fieldType = getFieldType(rule.field)
    const operator = rule.operator

    // Operators that don't require a value
    if (['is_empty', 'is_not_empty', 'exists', 'not_exists'].includes(operator)) {
      return (
        <div className="text-sm text-muted-foreground italic">
          No value required for this operator
        </div>
      )
    }

    // Tags field (comma-separated)
    if (fieldType === 'tags') {
      return (
        <Input
          value={rule.value}
          onChange={(e) => updateRule(rule.id, 'value', e.target.value)}
          placeholder="e.g., VIP, Customer, Newsletter"
          className="bg-background"
        />
      )
    }

    // Number field
    if (fieldType === 'number') {
      return (
        <Input
          type="number"
          value={rule.value}
          onChange={(e) => updateRule(rule.id, 'value', e.target.value)}
          placeholder="Enter a number..."
          className="bg-background"
        />
      )
    }

    // Boolean field
    if (fieldType === 'boolean') {
      return (
        <Select
          value={rule.value}
          onValueChange={(value) => updateRule(rule.id, 'value', value)}
        >
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Select value..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">True</SelectItem>
            <SelectItem value="false">False</SelectItem>
            <SelectItem value="yes">Yes</SelectItem>
            <SelectItem value="no">No</SelectItem>
          </SelectContent>
        </Select>
      )
    }

    // Default text input
    return (
      <Input
        value={rule.value}
        onChange={(e) => updateRule(rule.id, 'value', e.target.value)}
        placeholder={
          fieldType === 'date' 
            ? "YYYY-MM-DD or relative date like '7 days ago'" 
            : "Enter value..."
        }
        className="bg-background"
      />
    )
  }

  return (
    <div className="w-96 bg-card border-l border-border flex flex-col shadow-lg">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-amber-100 rounded flex items-center justify-center dark:bg-amber-900/20">
            <span className="text-sm">🔍</span>
          </div>
          <h2 className="font-semibold text-foreground">CONDITION</h2>
          {rules.length > 0 && (
            <Badge variant="secondary">
              {rules.length} rule{rules.length !== 1 ? 's' : ''}
            </Badge>
          )}
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
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          {/* Condition Label */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">
              Condition Name
            </Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Enter a descriptive name..."
              className="bg-background"
            />
          </div>

          {/* Logic Type */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-3 block">
              Logic Type
            </Label>
            <RadioGroup 
              value={logic} 
              onValueChange={(value: 'all' | 'any') => setLogic(value)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="logic-all" />
                <Label htmlFor="logic-all" className="cursor-pointer">
                  <div className="font-medium">All conditions must match</div>
                  <div className="text-xs text-muted-foreground">
                    (AND logic) - Use for strict requirements
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="any" id="logic-any" />
                <Label htmlFor="logic-any" className="cursor-pointer">
                  <div className="font-medium">Any condition can match</div>
                  <div className="text-xs text-muted-foreground">
                    (OR logic) - Use for multiple possibilities
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Rules List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-medium text-foreground">
                Rules
              </Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddingRule(true)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Rule
              </Button>
            </div>

            {rules.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
                <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No rules added yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add rules to create branching logic
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setIsAddingRule(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Rule
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {rules.map((rule, index) => (
                  <div key={rule.id} className="border border-border rounded-lg p-4 bg-muted/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-background flex items-center justify-center">
                          <span className="text-xs font-medium">{index + 1}</span>
                        </div>
                        <span className="text-sm font-medium text-foreground">
                          Rule {index + 1}
                        </span>
                        {!isRuleValid(rule) && (
                          <Badge variant="destructive" className="text-xs">
                            Incomplete
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => removeRule(rule.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {/* Field Selection */}
                      <div>
                        <Label className="text-xs font-medium text-foreground mb-1 block">
                          Field to Check
                        </Label>
                        <Select
                          value={rule.field}
                          onValueChange={(value) => updateRule(rule.id, 'field', value)}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select a field..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-64">
                            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                              Contact Fields
                            </div>
                            {AVAILABLE_FIELDS.filter(f => f.category === 'contact').map(field => (
                              <SelectItem key={field.id} value={field.id}>
                                <div className="flex flex-col">
                                  <span>{field.label}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {field.description}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                              Conversation Fields
                            </div>
                            {AVAILABLE_FIELDS.filter(f => f.category === 'conversation').map(field => (
                              <SelectItem key={field.id} value={field.id}>
                                <div className="flex flex-col">
                                  <span>{field.label}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {field.description}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {rule.field && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {getFieldDescription(rule.field)}
                          </p>
                        )}
                      </div>

                      {/* Operator Selection */}
                      <div>
                        <Label className="text-xs font-medium text-foreground mb-1 block">
                          Condition
                        </Label>
                        <Select
                          value={rule.operator}
                          onValueChange={(value) => updateRule(rule.id, 'operator', value)}
                          disabled={!rule.field}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select condition..." />
                          </SelectTrigger>
                          <SelectContent>
                            {getAvailableOperators(rule.field).map(operator => (
                              <SelectItem key={operator.value} value={operator.value}>
                                <div className="flex flex-col">
                                  <span>{operator.label}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {operator.description}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Value Input */}
                      <div>
                        <Label className="text-xs font-medium text-foreground mb-1 block">
                          Value to Compare
                        </Label>
                        {renderValueInput(rule)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Rule Dialog */}
            <Dialog open={isAddingRule} onOpenChange={setIsAddingRule}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Rule</DialogTitle>
                  <DialogDescription>
                    Create a new condition rule to check against contact or conversation data.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Button 
                    className="w-full justify-start text-left h-auto py-3"
                    variant="outline"
                    onClick={addRule}
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-medium">Create New Rule</span>
                      <span className="text-xs text-muted-foreground">
                        Start with an empty rule and configure it
                      </span>
                    </div>
                  </Button>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddingRule(false)}>
                    Cancel
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Preview */}
          {rules.length > 0 && (
            <div className="pt-4 border-t border-border">
              <Label className="text-sm font-medium text-foreground mb-3 block">
                Preview
              </Label>
              <div className="p-3 bg-muted rounded-md">
                <div className="text-xs text-muted-foreground mb-2">
                  This condition will check:
                </div>
                <div className="text-sm text-foreground space-y-1">
                  {rules.map((rule, index) => (
                    <div key={rule.id} className="flex items-start gap-2">
                      <span className="text-muted-foreground">
                        {index === 0 ? '•' : logic === 'all' ? 'AND' : 'OR'}
                      </span>
                      <span>
                        {rule.field ? getFieldLabel(rule.field) : '[Select field]'}{' '}
                        {rule.operator ? getOperatorLabel(rule.operator) : '[Select operator]'}{' '}
                        {rule.value && !['is_empty', 'is_not_empty', 'exists', 'not_exists'].includes(rule.operator) 
                          ? `"${rule.value}"` 
                          : ''}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-border/50">
                  <div className="text-xs text-muted-foreground">
                    If {logic === 'all' ? 'ALL' : 'ANY'} of these conditions match, 
                    the workflow will continue through the <span className="text-green-600 dark:text-green-400 font-medium">TRUE</span> branch.
                    Otherwise, it will follow the <span className="text-red-600 dark:text-red-400 font-medium">FALSE</span> branch.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-border space-y-3">
        {!isValid && rules.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-4 w-4" />
            <span>Some rules are incomplete. Complete them to save.</span>
          </div>
        )}
        
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Condition ID: {node.id}</span>
          <span className="flex items-center gap-1">
            {isValid && rules.length > 0 ? (
              <>
                <Check className="h-3 w-3 text-green-500" />
                <span className="text-green-600 dark:text-green-400">Ready</span>
              </>
            ) : rules.length === 0 ? (
              <span className="text-amber-600 dark:text-amber-400">No rules</span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400">Incomplete</span>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}