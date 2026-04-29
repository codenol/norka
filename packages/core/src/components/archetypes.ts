/**
 * Component Archetypes — built-in semantic component entities.
 *
 * Each archetype describes a semantic component (Button, Card, Input, etc.)
 * independent of any visual implementation. Libraries bind to these archetypes
 * to provide concrete design nodes. Code bindings map archetypes to production
 * React (or other framework) code. Rules (written by users) guide LLM and devs.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ArchetypeCategory =
  | 'action'
  | 'input'
  | 'display'
  | 'layout'
  | 'navigation'
  | 'feedback'
  | 'overlay'
  | 'data'

export const ARCHETYPE_CATEGORIES: ArchetypeCategory[] = [
  'action',
  'input',
  'display',
  'layout',
  'navigation',
  'feedback',
  'overlay',
  'data'
]

export interface ComponentPropSchema {
  name: string
  type: 'string' | 'boolean' | 'number' | 'enum'
  default?: unknown
  /** For enum type — list of valid values */
  options?: string[]
  description: string
  required?: boolean
}

export interface ComponentArchetype {
  /** Stable kebab-case identifier: 'button', 'product-card' */
  id: string
  /** Display name: 'Button', 'ProductCard' */
  name: string
  category: ArchetypeCategory
  description: string
  /** false = built-in, true = user-created custom archetype */
  isCustom: boolean
  props: ComponentPropSchema[]
  /** Alias names used during auto-binding (case-insensitive) */
  aliases: string[]
  tags: string[]
  /** Lucide icon name for UI panel */
  icon?: string
}

/**
 * Binding of an archetype to a COMPONENT node from a design library.
 * Stored per-document in SceneGraph.archetypeDesignBindings.
 */
export interface ArchetypeDesignBinding {
  archetypeId: string
  libraryId: string
  /** ID of the COMPONENT or COMPONENT_SET node in the library graph */
  componentId: string
  /** Maps archetype prop name → Figma component property name */
  propMapping?: Record<string, string>
}

/**
 * Binding of an archetype to production code (React, Vue, etc.).
 * Stored per-document in SceneGraph.archetypeCodeBindings.
 */
export interface ArchetypeCodeBinding {
  archetypeId: string
  /** e.g. '@/components/ui/button' or 'shadcn/ui' */
  packageName: string
  /** e.g. 'Button' */
  componentName: string
  /** Full import statement: 'import { Button } from "@/components/ui/button"' */
  importStatement: string
  /** JSX usage example: '<Button variant="primary">Click</Button>' */
  usageExample: string
  /** Optional full source code */
  sourceCode?: string
  /** Link to docs */
  propsDocUrl?: string
}

/**
 * Token binding: maps archetype prop variants to design variables.
 * Stored per-document in SceneGraph.archetypeTokenBindings.
 */
export interface ArchetypeTokenBinding {
  archetypeId: string
  /** variant value → (css property → variableId) */
  variantTokens?: Record<string, Record<string, string>>
  /** css property → variableId (applies to all variants) */
  globalTokens?: Record<string, string>
}

/**
 * A user-written rule for using a component (design + code guidance).
 * Stored per-document in SceneGraph.componentRules.
 */
export interface ComponentRule {
  id: string
  archetypeId: string
  title: string
  /** Markdown text. May cover design AND code usage. */
  body: string
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Built-in archetypes (~35)
// ---------------------------------------------------------------------------

type BuiltIn = Omit<ComponentArchetype, 'isCustom'>

const button: BuiltIn = {
  id: 'button',
  name: 'Button',
  category: 'action',
  description: 'Clickable button with label, optional icon, variants and sizes',
  props: [
    {
      name: 'label',
      type: 'string',
      default: 'Button',
      description: 'Button label text',
      required: true
    },
    {
      name: 'variant',
      type: 'enum',
      options: ['primary', 'secondary', 'ghost', 'outline', 'destructive', 'link'],
      default: 'primary',
      description: 'Visual style variant'
    },
    {
      name: 'size',
      type: 'enum',
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
      default: 'md',
      description: 'Size preset'
    },
    { name: 'disabled', type: 'boolean', default: false, description: 'Disabled state' },
    { name: 'loading', type: 'boolean', default: false, description: 'Loading/pending state' },
    { name: 'iconLeft', type: 'string', description: 'Lucide icon name to show left of label' },
    { name: 'iconRight', type: 'string', description: 'Lucide icon name to show right of label' },
    {
      name: 'fullWidth',
      type: 'boolean',
      default: false,
      description: 'Stretch to full container width'
    }
  ],
  aliases: ['btn', 'cta', 'action-button', 'primary-button', 'submit-button'],
  tags: ['interactive', 'form', 'cta'],
  icon: 'square'
}

const iconButton: BuiltIn = {
  id: 'icon-button',
  name: 'IconButton',
  category: 'action',
  description: 'Square button with only an icon, no label',
  props: [
    {
      name: 'icon',
      type: 'string',
      default: 'plus',
      description: 'Lucide icon name',
      required: true
    },
    {
      name: 'variant',
      type: 'enum',
      options: ['primary', 'secondary', 'ghost', 'outline', 'destructive'],
      default: 'ghost',
      description: 'Visual style'
    },
    {
      name: 'size',
      type: 'enum',
      options: ['xs', 'sm', 'md', 'lg'],
      default: 'md',
      description: 'Size preset'
    },
    { name: 'disabled', type: 'boolean', default: false, description: 'Disabled state' },
    {
      name: 'ariaLabel',
      type: 'string',
      description: 'Accessibility label (required in code)',
      required: true
    }
  ],
  aliases: ['icon-btn', 'round-button', 'fab'],
  tags: ['interactive', 'icon'],
  icon: 'circle'
}

const textInput: BuiltIn = {
  id: 'input',
  name: 'Input',
  category: 'input',
  description: 'Single-line text input field with label, placeholder and validation',
  props: [
    { name: 'label', type: 'string', description: 'Field label' },
    {
      name: 'placeholder',
      type: 'string',
      default: 'Enter value...',
      description: 'Placeholder text'
    },
    { name: 'value', type: 'string', default: '', description: 'Current value' },
    {
      name: 'type',
      type: 'enum',
      options: ['text', 'email', 'password', 'number', 'search', 'tel', 'url'],
      default: 'text',
      description: 'HTML input type'
    },
    {
      name: 'state',
      type: 'enum',
      options: ['default', 'focus', 'error', 'disabled', 'success'],
      default: 'default',
      description: 'Validation/interaction state'
    },
    { name: 'helperText', type: 'string', description: 'Helper or error message below the input' },
    { name: 'iconLeft', type: 'string', description: 'Lucide icon inside left side' },
    { name: 'iconRight', type: 'string', description: 'Lucide icon inside right side' },
    { name: 'required', type: 'boolean', default: false, description: 'Required field indicator' }
  ],
  aliases: ['text-field', 'text-input', 'form-input', 'field', 'textfield'],
  tags: ['form', 'input'],
  icon: 'text-cursor-input'
}

const textarea: BuiltIn = {
  id: 'textarea',
  name: 'Textarea',
  category: 'input',
  description: 'Multi-line text input',
  props: [
    { name: 'label', type: 'string', description: 'Field label' },
    { name: 'placeholder', type: 'string', default: 'Enter text...', description: 'Placeholder' },
    { name: 'rows', type: 'number', default: 4, description: 'Visible rows' },
    {
      name: 'state',
      type: 'enum',
      options: ['default', 'focus', 'error', 'disabled'],
      default: 'default',
      description: 'State'
    },
    { name: 'helperText', type: 'string', description: 'Helper or error message' }
  ],
  aliases: ['multi-line', 'text-area'],
  tags: ['form', 'input'],
  icon: 'align-left'
}

const select: BuiltIn = {
  id: 'select',
  name: 'Select',
  category: 'input',
  description: 'Dropdown select / combobox for choosing from a list of options',
  props: [
    { name: 'label', type: 'string', description: 'Field label' },
    {
      name: 'placeholder',
      type: 'string',
      default: 'Select...',
      description: 'Placeholder when no value selected'
    },
    {
      name: 'state',
      type: 'enum',
      options: ['default', 'open', 'error', 'disabled'],
      default: 'default',
      description: 'State'
    },
    { name: 'helperText', type: 'string', description: 'Helper or error message' }
  ],
  aliases: ['dropdown', 'combobox', 'select-field'],
  tags: ['form', 'input'],
  icon: 'chevron-down'
}

const checkbox: BuiltIn = {
  id: 'checkbox',
  name: 'Checkbox',
  category: 'input',
  description: 'Checkbox with optional label for boolean form input',
  props: [
    { name: 'label', type: 'string', description: 'Checkbox label' },
    {
      name: 'checked',
      type: 'enum',
      options: ['unchecked', 'checked', 'indeterminate'],
      default: 'unchecked',
      description: 'Checked state'
    },
    { name: 'disabled', type: 'boolean', default: false, description: 'Disabled state' }
  ],
  aliases: ['check', 'tick'],
  tags: ['form', 'input'],
  icon: 'check-square'
}

const radioButton: BuiltIn = {
  id: 'radio',
  name: 'Radio',
  category: 'input',
  description: 'Radio button for single-select within a group',
  props: [
    { name: 'label', type: 'string', description: 'Radio label' },
    { name: 'checked', type: 'boolean', default: false, description: 'Selected state' },
    { name: 'disabled', type: 'boolean', default: false, description: 'Disabled state' }
  ],
  aliases: ['radio-button', 'radio-input'],
  tags: ['form', 'input'],
  icon: 'circle-dot'
}

const toggle: BuiltIn = {
  id: 'switch',
  name: 'Switch',
  category: 'input',
  description: 'Toggle switch for on/off boolean state',
  props: [
    { name: 'label', type: 'string', description: 'Switch label' },
    { name: 'checked', type: 'boolean', default: false, description: 'On/off state' },
    { name: 'disabled', type: 'boolean', default: false, description: 'Disabled state' },
    { name: 'size', type: 'enum', options: ['sm', 'md', 'lg'], default: 'md', description: 'Size' }
  ],
  aliases: ['toggle', 'toggle-switch'],
  tags: ['form', 'input'],
  icon: 'toggle-left'
}

const slider: BuiltIn = {
  id: 'slider',
  name: 'Slider',
  category: 'input',
  description: 'Range slider for numeric value selection',
  props: [
    { name: 'label', type: 'string', description: 'Slider label' },
    { name: 'value', type: 'number', default: 50, description: 'Current value' },
    { name: 'min', type: 'number', default: 0, description: 'Minimum value' },
    { name: 'max', type: 'number', default: 100, description: 'Maximum value' },
    { name: 'disabled', type: 'boolean', default: false, description: 'Disabled state' }
  ],
  aliases: ['range', 'range-input'],
  tags: ['form', 'input'],
  icon: 'sliders'
}

const card: BuiltIn = {
  id: 'card',
  name: 'Card',
  category: 'display',
  description: 'Content card container with optional header, body and footer',
  props: [
    { name: 'title', type: 'string', description: 'Card title' },
    { name: 'subtitle', type: 'string', description: 'Card subtitle or description' },
    {
      name: 'variant',
      type: 'enum',
      options: ['default', 'outline', 'elevated', 'filled'],
      default: 'default',
      description: 'Visual style'
    },
    {
      name: 'padding',
      type: 'enum',
      options: ['none', 'sm', 'md', 'lg'],
      default: 'md',
      description: 'Content padding'
    },
    { name: 'hasImage', type: 'boolean', default: false, description: 'Show image slot at top' },
    { name: 'hasFooter', type: 'boolean', default: false, description: 'Show footer slot' }
  ],
  aliases: ['panel', 'tile', 'widget', 'content-card'],
  tags: ['container', 'display'],
  icon: 'square'
}

const badge: BuiltIn = {
  id: 'badge',
  name: 'Badge',
  category: 'display',
  description: 'Small status indicator with label and optional icon',
  props: [
    { name: 'label', type: 'string', default: 'Badge', description: 'Badge text', required: true },
    {
      name: 'variant',
      type: 'enum',
      options: ['default', 'primary', 'success', 'warning', 'error', 'info', 'outline'],
      default: 'default',
      description: 'Color variant'
    },
    { name: 'size', type: 'enum', options: ['sm', 'md'], default: 'md', description: 'Size' },
    { name: 'icon', type: 'string', description: 'Lucide icon name' },
    {
      name: 'dot',
      type: 'boolean',
      default: false,
      description: 'Show status dot instead of label'
    }
  ],
  aliases: ['tag', 'chip', 'label', 'pill', 'status-badge'],
  tags: ['display', 'status'],
  icon: 'tag'
}

const avatar: BuiltIn = {
  id: 'avatar',
  name: 'Avatar',
  category: 'display',
  description: 'User avatar with image, initials or icon fallback',
  props: [
    { name: 'initials', type: 'string', description: 'Fallback initials when no image' },
    {
      name: 'size',
      type: 'enum',
      options: ['xs', 'sm', 'md', 'lg', 'xl', '2xl'],
      default: 'md',
      description: 'Size'
    },
    {
      name: 'shape',
      type: 'enum',
      options: ['circle', 'rounded', 'square'],
      default: 'circle',
      description: 'Shape'
    },
    { name: 'hasImage', type: 'boolean', default: false, description: 'Show image placeholder' },
    {
      name: 'status',
      type: 'enum',
      options: ['none', 'online', 'offline', 'busy', 'away'],
      default: 'none',
      description: 'Presence status indicator'
    }
  ],
  aliases: ['user-avatar', 'profile-picture', 'pfp'],
  tags: ['display', 'user'],
  icon: 'user-circle'
}

const tooltip: BuiltIn = {
  id: 'tooltip',
  name: 'Tooltip',
  category: 'display',
  description: 'Small informational popup that appears on hover',
  props: [
    {
      name: 'content',
      type: 'string',
      default: 'Tooltip text',
      description: 'Tooltip content',
      required: true
    },
    {
      name: 'position',
      type: 'enum',
      options: ['top', 'bottom', 'left', 'right'],
      default: 'top',
      description: 'Position relative to trigger'
    },
    {
      name: 'variant',
      type: 'enum',
      options: ['default', 'dark', 'light'],
      default: 'default',
      description: 'Color scheme'
    }
  ],
  aliases: ['hint', 'popover-hint'],
  tags: ['display', 'overlay'],
  icon: 'message-square'
}

const divider: BuiltIn = {
  id: 'divider',
  name: 'Divider',
  category: 'layout',
  description: 'Horizontal or vertical visual separator between sections',
  props: [
    {
      name: 'orientation',
      type: 'enum',
      options: ['horizontal', 'vertical'],
      default: 'horizontal',
      description: 'Line direction'
    },
    { name: 'label', type: 'string', description: 'Optional center label on the divider' },
    {
      name: 'variant',
      type: 'enum',
      options: ['solid', 'dashed', 'dotted'],
      default: 'solid',
      description: 'Line style'
    }
  ],
  aliases: ['separator', 'hr', 'rule'],
  tags: ['layout'],
  icon: 'minus'
}

const breadcrumb: BuiltIn = {
  id: 'breadcrumb',
  name: 'Breadcrumb',
  category: 'navigation',
  description: 'Hierarchical navigation path showing current location',
  props: [
    {
      name: 'items',
      type: 'number',
      default: 3,
      description: 'Number of breadcrumb items to show'
    },
    {
      name: 'separator',
      type: 'enum',
      options: ['slash', 'chevron', 'arrow', 'dot'],
      default: 'slash',
      description: 'Separator between items'
    }
  ],
  aliases: ['breadcrumbs', 'nav-path'],
  tags: ['navigation'],
  icon: 'chevrons-right'
}

const navbar: BuiltIn = {
  id: 'navbar',
  name: 'Navbar',
  category: 'navigation',
  description: 'Top navigation bar with logo, links and actions',
  props: [
    {
      name: 'variant',
      type: 'enum',
      options: ['default', 'transparent', 'solid', 'bordered'],
      default: 'default',
      description: 'Visual style'
    },
    { name: 'hasLogo', type: 'boolean', default: true, description: 'Show logo slot' },
    { name: 'hasCTA', type: 'boolean', default: true, description: 'Show CTA button' },
    { name: 'hasSearch', type: 'boolean', default: false, description: 'Show search input' },
    { name: 'hasAvatar', type: 'boolean', default: false, description: 'Show user avatar/menu' }
  ],
  aliases: ['navigation-bar', 'header', 'top-bar', 'nav-header'],
  tags: ['navigation', 'layout'],
  icon: 'layout-template'
}

const sidebar: BuiltIn = {
  id: 'sidebar',
  name: 'Sidebar',
  category: 'navigation',
  description: 'Vertical navigation sidebar with menu items and sections',
  props: [
    {
      name: 'variant',
      type: 'enum',
      options: ['default', 'compact', 'wide'],
      default: 'default',
      description: 'Width variant'
    },
    { name: 'hasHeader', type: 'boolean', default: true, description: 'Show header with logo' },
    {
      name: 'hasFooter',
      type: 'boolean',
      default: true,
      description: 'Show footer with user/settings'
    },
    {
      name: 'collapsed',
      type: 'boolean',
      default: false,
      description: 'Collapsed state (icons only)'
    }
  ],
  aliases: ['sidenav', 'side-nav', 'side-panel', 'navigation-menu'],
  tags: ['navigation', 'layout'],
  icon: 'panel-left'
}

const tabs: BuiltIn = {
  id: 'tabs',
  name: 'Tabs',
  category: 'navigation',
  description: 'Tabbed navigation for switching between sections',
  props: [
    { name: 'count', type: 'number', default: 3, description: 'Number of tab items' },
    { name: 'activeIndex', type: 'number', default: 0, description: 'Active tab index (0-based)' },
    {
      name: 'variant',
      type: 'enum',
      options: ['default', 'pills', 'underline', 'boxed'],
      default: 'default',
      description: 'Visual style'
    },
    { name: 'size', type: 'enum', options: ['sm', 'md', 'lg'], default: 'md', description: 'Size' }
  ],
  aliases: ['tab-bar', 'tab-list', 'tabbar'],
  tags: ['navigation'],
  icon: 'layout-list'
}

const pagination: BuiltIn = {
  id: 'pagination',
  name: 'Pagination',
  category: 'navigation',
  description: 'Page navigation controls for multi-page content',
  props: [
    { name: 'currentPage', type: 'number', default: 1, description: 'Current page number' },
    { name: 'totalPages', type: 'number', default: 10, description: 'Total number of pages' },
    {
      name: 'variant',
      type: 'enum',
      options: ['default', 'simple', 'compact'],
      default: 'default',
      description: 'Layout variant'
    }
  ],
  aliases: ['pager', 'page-nav'],
  tags: ['navigation', 'data'],
  icon: 'chevrons-right'
}

const alert: BuiltIn = {
  id: 'alert',
  name: 'Alert',
  category: 'feedback',
  description: 'Inline alert/notification banner for status messages',
  props: [
    { name: 'title', type: 'string', description: 'Alert title' },
    {
      name: 'message',
      type: 'string',
      default: 'Alert message',
      description: 'Main message text',
      required: true
    },
    {
      name: 'variant',
      type: 'enum',
      options: ['info', 'success', 'warning', 'error', 'neutral'],
      default: 'info',
      description: 'Severity/color variant'
    },
    { name: 'closable', type: 'boolean', default: false, description: 'Show close button' },
    { name: 'hasIcon', type: 'boolean', default: true, description: 'Show status icon' }
  ],
  aliases: ['banner', 'notification-bar', 'callout', 'message-banner'],
  tags: ['feedback', 'status'],
  icon: 'alert-circle'
}

const toast: BuiltIn = {
  id: 'toast',
  name: 'Toast',
  category: 'feedback',
  description: 'Transient popup notification in a corner of the screen',
  props: [
    { name: 'title', type: 'string', description: 'Toast title' },
    {
      name: 'message',
      type: 'string',
      default: 'Toast message',
      description: 'Message text',
      required: true
    },
    {
      name: 'variant',
      type: 'enum',
      options: ['default', 'success', 'warning', 'error', 'info'],
      default: 'default',
      description: 'Variant'
    },
    { name: 'closable', type: 'boolean', default: true, description: 'Show close button' },
    { name: 'hasAction', type: 'boolean', default: false, description: 'Show action button' }
  ],
  aliases: ['snackbar', 'notification', 'notification-toast'],
  tags: ['feedback', 'overlay'],
  icon: 'bell'
}

const spinner: BuiltIn = {
  id: 'spinner',
  name: 'Spinner',
  category: 'feedback',
  description: 'Loading spinner for async operations',
  props: [
    {
      name: 'size',
      type: 'enum',
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
      default: 'md',
      description: 'Size'
    },
    {
      name: 'variant',
      type: 'enum',
      options: ['default', 'primary', 'white'],
      default: 'default',
      description: 'Color variant'
    },
    { name: 'label', type: 'string', description: 'Optional label next to spinner' }
  ],
  aliases: ['loader', 'loading-spinner', 'loading'],
  tags: ['feedback', 'loading'],
  icon: 'loader-circle'
}

const skeleton: BuiltIn = {
  id: 'skeleton',
  name: 'Skeleton',
  category: 'feedback',
  description: 'Loading placeholder that mimics content shape',
  props: [
    {
      name: 'variant',
      type: 'enum',
      options: ['text', 'circle', 'rectangle', 'card'],
      default: 'text',
      description: 'Shape type'
    },
    {
      name: 'lines',
      type: 'number',
      default: 3,
      description: 'Number of text lines (for text variant)'
    },
    { name: 'animated', type: 'boolean', default: true, description: 'Pulse animation' }
  ],
  aliases: ['skeleton-loader', 'content-placeholder', 'ghost'],
  tags: ['feedback', 'loading'],
  icon: 'layers'
}

const progressBar: BuiltIn = {
  id: 'progress',
  name: 'Progress',
  category: 'feedback',
  description: 'Progress bar showing completion percentage',
  props: [
    { name: 'value', type: 'number', default: 60, description: 'Progress value 0-100' },
    {
      name: 'variant',
      type: 'enum',
      options: ['default', 'success', 'warning', 'error'],
      default: 'default',
      description: 'Color variant'
    },
    {
      name: 'size',
      type: 'enum',
      options: ['sm', 'md', 'lg'],
      default: 'md',
      description: 'Height'
    },
    { name: 'label', type: 'string', description: 'Label text above bar' },
    { name: 'showValue', type: 'boolean', default: false, description: 'Show percentage text' },
    { name: 'striped', type: 'boolean', default: false, description: 'Striped pattern' }
  ],
  aliases: ['progress-bar', 'progressbar'],
  tags: ['feedback', 'display'],
  icon: 'bar-chart-horizontal'
}

const modal: BuiltIn = {
  id: 'modal',
  name: 'Modal',
  category: 'overlay',
  description: 'Overlay dialog with header, content and footer actions',
  props: [
    {
      name: 'title',
      type: 'string',
      default: 'Dialog Title',
      description: 'Modal header title',
      required: true
    },
    {
      name: 'size',
      type: 'enum',
      options: ['sm', 'md', 'lg', 'xl', 'full'],
      default: 'md',
      description: 'Dialog width'
    },
    {
      name: 'hasFooter',
      type: 'boolean',
      default: true,
      description: 'Show footer with action buttons'
    },
    { name: 'closable', type: 'boolean', default: true, description: 'Show close button' },
    { name: 'hasBackdrop', type: 'boolean', default: true, description: 'Show dimmed backdrop' }
  ],
  aliases: ['dialog', 'popup', 'lightbox', 'modal-dialog'],
  tags: ['overlay'],
  icon: 'square-dashed'
}

const drawer: BuiltIn = {
  id: 'drawer',
  name: 'Drawer',
  category: 'overlay',
  description: 'Side panel that slides in from screen edge',
  props: [
    { name: 'title', type: 'string', default: 'Drawer', description: 'Drawer header title' },
    {
      name: 'side',
      type: 'enum',
      options: ['left', 'right', 'top', 'bottom'],
      default: 'right',
      description: 'Side to slide in from'
    },
    {
      name: 'size',
      type: 'enum',
      options: ['sm', 'md', 'lg', 'full'],
      default: 'md',
      description: 'Width/height'
    },
    { name: 'hasFooter', type: 'boolean', default: true, description: 'Show footer with actions' }
  ],
  aliases: ['sheet', 'side-panel', 'slide-over', 'offcanvas'],
  tags: ['overlay', 'navigation'],
  icon: 'panel-right'
}

const popover: BuiltIn = {
  id: 'popover',
  name: 'Popover',
  category: 'overlay',
  description: 'Floating content panel anchored to a trigger element',
  props: [
    { name: 'title', type: 'string', description: 'Optional popover title' },
    {
      name: 'position',
      type: 'enum',
      options: ['top', 'bottom', 'left', 'right'],
      default: 'bottom',
      description: 'Position relative to trigger'
    },
    { name: 'hasArrow', type: 'boolean', default: true, description: 'Show pointing arrow' }
  ],
  aliases: ['dropdown-panel', 'flyout', 'contextual-panel'],
  tags: ['overlay'],
  icon: 'layers'
}

const table: BuiltIn = {
  id: 'table',
  name: 'Table',
  category: 'data',
  description: 'Data table with headers, rows and optional sorting/actions',
  props: [
    { name: 'columns', type: 'number', default: 4, description: 'Number of columns' },
    { name: 'rows', type: 'number', default: 5, description: 'Number of data rows' },
    {
      name: 'hasCheckboxes',
      type: 'boolean',
      default: false,
      description: 'Show row selection checkboxes'
    },
    { name: 'hasActions', type: 'boolean', default: false, description: 'Show action column' },
    {
      name: 'variant',
      type: 'enum',
      options: ['default', 'striped', 'bordered', 'compact'],
      default: 'default',
      description: 'Visual style'
    },
    {
      name: 'hasPagination',
      type: 'boolean',
      default: false,
      description: 'Show pagination below table'
    }
  ],
  aliases: ['data-table', 'data-grid', 'datagrid'],
  tags: ['data', 'display'],
  icon: 'table'
}

const listItem: BuiltIn = {
  id: 'list-item',
  name: 'ListItem',
  category: 'data',
  description: 'Single item in a list with leading icon/avatar, content and trailing action',
  props: [
    {
      name: 'title',
      type: 'string',
      default: 'List item',
      description: 'Main text',
      required: true
    },
    { name: 'subtitle', type: 'string', description: 'Secondary text below title' },
    {
      name: 'leadingType',
      type: 'enum',
      options: ['none', 'icon', 'avatar', 'image', 'checkbox'],
      default: 'none',
      description: 'Leading element type'
    },
    {
      name: 'trailingType',
      type: 'enum',
      options: ['none', 'icon', 'badge', 'action', 'chevron'],
      default: 'none',
      description: 'Trailing element type'
    },
    {
      name: 'interactive',
      type: 'boolean',
      default: true,
      description: 'Hoverable/clickable state'
    }
  ],
  aliases: ['list-row', 'menu-item', 'row'],
  tags: ['data', 'display'],
  icon: 'list'
}

const accordion: BuiltIn = {
  id: 'accordion',
  name: 'Accordion',
  category: 'data',
  description: 'Collapsible section with header and expandable content',
  props: [
    {
      name: 'title',
      type: 'string',
      default: 'Section',
      description: 'Accordion header title',
      required: true
    },
    { name: 'open', type: 'boolean', default: false, description: 'Expanded state' },
    {
      name: 'variant',
      type: 'enum',
      options: ['default', 'bordered', 'filled'],
      default: 'default',
      description: 'Visual style'
    }
  ],
  aliases: ['collapsible', 'expandable', 'faq-item', 'disclosure'],
  tags: ['data', 'layout'],
  icon: 'chevron-down'
}

const emptyState: BuiltIn = {
  id: 'empty-state',
  name: 'EmptyState',
  category: 'feedback',
  description: 'Placeholder shown when content list is empty',
  props: [
    {
      name: 'title',
      type: 'string',
      default: 'No results',
      description: 'Main heading',
      required: true
    },
    { name: 'description', type: 'string', description: 'Explanatory text below heading' },
    {
      name: 'hasIllustration',
      type: 'boolean',
      default: true,
      description: 'Show illustration/icon'
    },
    { name: 'hasCTA', type: 'boolean', default: false, description: 'Show call-to-action button' },
    { name: 'ctaLabel', type: 'string', default: 'Get started', description: 'CTA button label' }
  ],
  aliases: ['empty', 'no-data', 'zero-state', 'blank-state'],
  tags: ['feedback', 'display'],
  icon: 'inbox'
}

const searchInput: BuiltIn = {
  id: 'search-input',
  name: 'SearchInput',
  category: 'input',
  description: 'Search field with icon and optional clear button',
  props: [
    { name: 'placeholder', type: 'string', default: 'Search...', description: 'Placeholder text' },
    { name: 'value', type: 'string', default: '', description: 'Current search value' },
    { name: 'size', type: 'enum', options: ['sm', 'md', 'lg'], default: 'md', description: 'Size' },
    {
      name: 'variant',
      type: 'enum',
      options: ['default', 'filled', 'ghost'],
      default: 'default',
      description: 'Style'
    }
  ],
  aliases: ['search-bar', 'search-box', 'search-field'],
  tags: ['input', 'form'],
  icon: 'search'
}

const dateInput: BuiltIn = {
  id: 'date-input',
  name: 'DateInput',
  category: 'input',
  description: 'Date picker input field',
  props: [
    { name: 'label', type: 'string', description: 'Field label' },
    { name: 'placeholder', type: 'string', default: 'Select date', description: 'Placeholder' },
    {
      name: 'state',
      type: 'enum',
      options: ['default', 'focus', 'error', 'disabled'],
      default: 'default',
      description: 'State'
    },
    { name: 'helperText', type: 'string', description: 'Helper or error message' }
  ],
  aliases: ['date-picker', 'datepicker', 'date-field'],
  tags: ['input', 'form'],
  icon: 'calendar'
}

const statCard: BuiltIn = {
  id: 'stat-card',
  name: 'StatCard',
  category: 'display',
  description: 'KPI card showing a metric with label, value and optional trend',
  props: [
    {
      name: 'label',
      type: 'string',
      default: 'Total Revenue',
      description: 'Metric label',
      required: true
    },
    {
      name: 'value',
      type: 'string',
      default: '$12,345',
      description: 'Metric value',
      required: true
    },
    { name: 'hasTrend', type: 'boolean', default: true, description: 'Show trend indicator' },
    {
      name: 'trend',
      type: 'enum',
      options: ['up', 'down', 'neutral'],
      default: 'up',
      description: 'Trend direction'
    },
    { name: 'trendValue', type: 'string', default: '+12%', description: 'Trend percentage text' },
    { name: 'hasChart', type: 'boolean', default: false, description: 'Show mini sparkline chart' }
  ],
  aliases: ['kpi-card', 'metric-card', 'stats-card', 'dashboard-card'],
  tags: ['display', 'data', 'dashboard'],
  icon: 'trending-up'
}

const fileUpload: BuiltIn = {
  id: 'file-upload',
  name: 'FileUpload',
  category: 'input',
  description: 'File upload dropzone or button',
  props: [
    {
      name: 'variant',
      type: 'enum',
      options: ['dropzone', 'button'],
      default: 'dropzone',
      description: 'Upload style'
    },
    { name: 'label', type: 'string', default: 'Drop files here', description: 'Main label text' },
    { name: 'subtitle', type: 'string', description: 'Accepted file types info' },
    {
      name: 'state',
      type: 'enum',
      options: ['default', 'hover', 'error', 'disabled'],
      default: 'default',
      description: 'State'
    }
  ],
  aliases: ['upload', 'file-input', 'dropzone', 'drop-zone'],
  tags: ['input', 'form'],
  icon: 'upload-cloud'
}

const colorPicker: BuiltIn = {
  id: 'color-input',
  name: 'ColorInput',
  category: 'input',
  description: 'Color picker input with swatch preview',
  props: [
    { name: 'label', type: 'string', description: 'Field label' },
    { name: 'value', type: 'string', default: '#3B82F6', description: 'Current hex color value' }
  ],
  aliases: ['color-picker', 'color-field', 'colorpicker'],
  tags: ['input', 'form'],
  icon: 'pipette'
}

export const BUILT_IN_ARCHETYPES: ComponentArchetype[] = [
  // Action
  { ...button, isCustom: false },
  { ...iconButton, isCustom: false },
  // Input
  { ...textInput, isCustom: false },
  { ...textarea, isCustom: false },
  { ...select, isCustom: false },
  { ...checkbox, isCustom: false },
  { ...radioButton, isCustom: false },
  { ...toggle, isCustom: false },
  { ...slider, isCustom: false },
  { ...searchInput, isCustom: false },
  { ...dateInput, isCustom: false },
  { ...fileUpload, isCustom: false },
  { ...colorPicker, isCustom: false },
  // Display
  { ...card, isCustom: false },
  { ...badge, isCustom: false },
  { ...avatar, isCustom: false },
  { ...tooltip, isCustom: false },
  { ...statCard, isCustom: false },
  // Layout
  { ...divider, isCustom: false },
  // Navigation
  { ...breadcrumb, isCustom: false },
  { ...navbar, isCustom: false },
  { ...sidebar, isCustom: false },
  { ...tabs, isCustom: false },
  { ...pagination, isCustom: false },
  // Feedback
  { ...alert, isCustom: false },
  { ...toast, isCustom: false },
  { ...spinner, isCustom: false },
  { ...skeleton, isCustom: false },
  { ...progressBar, isCustom: false },
  { ...emptyState, isCustom: false },
  // Overlay
  { ...modal, isCustom: false },
  { ...drawer, isCustom: false },
  { ...popover, isCustom: false },
  // Data
  { ...table, isCustom: false },
  { ...listItem, isCustom: false },
  { ...accordion, isCustom: false }
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a reverse alias map: normalized name → archetypeId.
 * Used during auto-binding when a library is imported.
 */
export function buildAliasMap(archetypes: ComponentArchetype[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const a of archetypes) {
    map.set(normalize(a.id), a.id)
    map.set(normalize(a.name), a.id)
    for (const alias of a.aliases) {
      map.set(normalize(alias), a.id)
    }
  }
  return map
}

/**
 * Normalize a component name to a canonical form for matching.
 * e.g. "PrimaryButton" → "primarybutton", "text-input" → "textinput"
 */
export function normalize(name: string): string {
  return name.toLowerCase().replace(/[\s_\-]/g, '')
}

/**
 * Find the archetype ID for a given component name using fuzzy matching.
 * Returns null if no confident match is found.
 */
export function matchArchetype(name: string, aliasMap: Map<string, string>): string | null {
  const normalized = normalize(name)

  // Exact match
  if (aliasMap.has(normalized)) {
    return aliasMap.get(normalized)!
  }

  // Prefix/suffix match — e.g. "SubmitButton" → "button"
  for (const [alias, id] of aliasMap) {
    if (normalized.includes(alias) || alias.includes(normalized)) {
      return id
    }
  }

  return null
}
