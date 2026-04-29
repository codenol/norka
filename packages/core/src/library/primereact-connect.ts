/**
 * PRIMEREACT_CONNECT_DEFS — static Code Connect mapping for the built-in
 * PrimeReact Core library components.
 *
 * Keyed by design component name (must match node.name in primereact-graph.ts).
 * These definitions are used to populate the Code Connect store at startup
 * instead of empty stubs, so Preview always emits real PrimeReact imports.
 */

export interface PrimeReactConnectDef {
  codeComponent: string
  importPath: string
  staticProps: Record<string, unknown>
}

export const PRIMEREACT_CONNECT_DEFS: Record<string, PrimeReactConnectDef> = {
  Button: {
    codeComponent: 'Button',
    importPath: 'primereact/button',
    staticProps: { label: 'Button' }
  },
  InputText: {
    codeComponent: 'InputText',
    importPath: 'primereact/inputtext',
    staticProps: {}
  },
  Dropdown: {
    codeComponent: 'Dropdown',
    importPath: 'primereact/dropdown',
    staticProps: { placeholder: 'Select' }
  },
  DataTable: {
    codeComponent: 'DataTable',
    importPath: 'primereact/datatable',
    staticProps: {}
  },
  Card: {
    codeComponent: 'Card',
    importPath: 'primereact/card',
    staticProps: { title: 'Card Title' }
  },
  Dialog: {
    codeComponent: 'Dialog',
    importPath: 'primereact/dialog',
    staticProps: { header: 'Dialog', visible: true }
  },
  Panel: {
    codeComponent: 'Panel',
    importPath: 'primereact/panel',
    staticProps: { header: 'Panel' }
  },
  Tag: {
    codeComponent: 'Tag',
    importPath: 'primereact/tag',
    staticProps: { value: 'Tag' }
  },
  Badge: {
    codeComponent: 'Badge',
    importPath: 'primereact/badge',
    staticProps: { value: '3' }
  },
  ProgressBar: {
    codeComponent: 'ProgressBar',
    importPath: 'primereact/progressbar',
    staticProps: { value: 50 }
  },
  Toolbar: {
    codeComponent: 'Toolbar',
    importPath: 'primereact/toolbar',
    staticProps: {}
  },
  Breadcrumb: {
    codeComponent: 'Breadcrumb',
    importPath: 'primereact/breadcrumb',
    staticProps: {}
  },
  InputNumber: {
    codeComponent: 'InputNumber',
    importPath: 'primereact/inputnumber',
    staticProps: {}
  },
  Calendar: {
    codeComponent: 'Calendar',
    importPath: 'primereact/calendar',
    staticProps: { placeholder: 'Select Date' }
  },
  Checkbox: {
    codeComponent: 'Checkbox',
    importPath: 'primereact/checkbox',
    staticProps: {}
  },
  RadioButton: {
    codeComponent: 'RadioButton',
    importPath: 'primereact/radiobutton',
    staticProps: {}
  },
  Slider: {
    codeComponent: 'Slider',
    importPath: 'primereact/slider',
    staticProps: { value: 50 }
  },
  TabView: {
    codeComponent: 'TabView',
    importPath: 'primereact/tabview',
    staticProps: {}
  },
  Message: {
    codeComponent: 'Message',
    importPath: 'primereact/message',
    staticProps: { severity: 'info', text: 'Info' }
  },
  Divider: {
    codeComponent: 'Divider',
    importPath: 'primereact/divider',
    staticProps: {}
  },
  Avatar: {
    codeComponent: 'Avatar',
    importPath: 'primereact/avatar',
    staticProps: { label: 'A' }
  },
  MultiSelect: {
    codeComponent: 'MultiSelect',
    importPath: 'primereact/multiselect',
    staticProps: { placeholder: 'Select options' }
  },
  InputTextarea: {
    codeComponent: 'InputTextarea',
    importPath: 'primereact/inputtextarea',
    staticProps: { placeholder: 'Type details...' }
  },
  SelectButton: {
    codeComponent: 'SelectButton',
    importPath: 'primereact/selectbutton',
    staticProps: {}
  }
}
