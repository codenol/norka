import { createElement } from 'react'
import { BreadCrumb } from 'primereact/breadcrumb'
import { Column } from 'primereact/column'
import { DataTable } from 'primereact/datatable'
import * as LucideIcons from 'lucide-react'

type UnknownRecord = Record<string, unknown>

function kebabToPascal(value: string): string {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join('')
}

function renderLucideIcon(raw: unknown, className = 'size-4'): unknown | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  const key = kebabToPascal(raw.trim().toLowerCase())
  const Icon = (LucideIcons as Record<string, unknown>)[key]
  if (!Icon) return null
  return createElement(Icon as never, { className, size: 16, strokeWidth: 1.8 } as never)
}

export function DesignSystemBreadcrumb(props: UnknownRecord) {
  const model = Array.isArray(props.model) ? props.model : []
  return createElement(BreadCrumb as never, { model } as never)
}

export function DesignSystemStatusBadge(props: UnknownRecord) {
  const code = typeof props.code === 'string' ? props.code : 'ok'
  const name = typeof props.name === 'string' ? props.name : typeof props.value === 'string' ? props.value : 'STATUS'
  return createElement(
    'span',
    {
      className: 'status-badge status-badge--small',
      'data-status-code': code
    } as never,
    name
  )
}

export function DesignSystemSidebarPanel(props: UnknownRecord) {
  const title = typeof props.title === 'string' ? props.title : 'Навигация'
  const subTitle = typeof props.subTitle === 'string' ? props.subTitle : ''
  const navItems = Array.isArray(props.items) ? (props.items as Array<UnknownRecord>) : []
  const activeId = typeof props.activeId === 'string' ? props.activeId : ''
  return createElement(
    'div',
    { className: 'p-2' } as never,
    createElement('div', { className: 'text-xl font-semibold mb-1' } as never, title),
    subTitle ? createElement('div', { className: 'text-xs opacity-70 mb-2' } as never, subTitle) : null,
    navItems.length > 0
      ? createElement(
          'div',
          { className: 'flex flex-col gap-1' } as never,
          ...navItems.map((item, index) => {
            const id = String(item.id ?? `item-${index}`)
            const label = String(item.label ?? item.title ?? `Пункт ${index + 1}`)
            const isActive = activeId ? activeId === id : Boolean(item.active)
            const iconNode = renderLucideIcon(item.icon, 'size-3.5')
            return createElement(
              'div',
              {
                key: id,
                className: isActive
                  ? 'px-2 py-2 rounded border-1 border-primary text-color bg-primary-50'
                  : 'px-2 py-2 rounded border-1 border-transparent text-color-secondary'
              } as never,
              createElement(
                'div',
                { className: 'flex items-center gap-2' } as never,
                ...(iconNode ? [iconNode as never] : []),
                createElement('span', null, label)
              )
            )
          })
        )
      : null
  )
}

export function DesignSystemDataTable(props: UnknownRecord) {
  const rows = Array.isArray(props.value) ? props.value : Array.isArray(props.data) ? props.data : []
  const selectionMode = props.selectionMode === 'multiple' || props.selectionMode === 'single'
    ? props.selectionMode
    : null
  const schemaColumns = Array.isArray(props.columns) ? (props.columns as Array<UnknownRecord>) : []
  const columns = (
    schemaColumns.length > 0
      ? schemaColumns
      : rows.length > 0 && rows[0] && typeof rows[0] === 'object'
        ? Object.keys(rows[0] as UnknownRecord).map((key) => ({ key, label: key }))
        : []
  )
  const columnNodes = columns.map((column) => {
    const columnRecord = column as UnknownRecord
    const field = String(columnRecord.field ?? columnRecord.key ?? '')
    const header = String(columnRecord.header ?? columnRecord.label ?? field)
    const lower = field.toLowerCase()
    const isStatus = lower === 'status' || lower.includes('state')
    return createElement(Column as never, {
      key: field,
      field,
      header,
      sortable: true,
      body: isStatus
        ? (rowData: UnknownRecord) => {
            const rawValue = rowData[field]
            const value = typeof rawValue === 'string' ? rawValue : 'STATUS'
            const code = value.toLowerCase()
            return createElement(
              'span',
              {
                className: 'status-badge status-badge--small',
                'data-status-code': code
              } as never,
              value.toUpperCase()
            )
          }
        : undefined
    } as never)
  })

  return createElement(DataTable as never, {
    value: rows,
    paginator: props.paginator !== false,
    rows: typeof props.rows === 'number' ? props.rows : 10,
    stripedRows: props.stripedRows !== false,
    showGridlines: true,
    className: 'w-full',
    dataKey: typeof props.dataKey === 'string' ? props.dataKey : undefined
  } as never,
  ...(selectionMode
    ? [createElement(Column as never, { key: '__select__', selectionMode, style: { width: '2.5rem' } } as never)]
    : []),
  ...columnNodes as never[])
}

export function DesignSystemPageHeader(props: UnknownRecord) {
  const title = typeof props.title === 'string' ? props.title : 'Page Title'
  return createElement(
    'div',
    { className: 'ds-page-header' } as never,
    createElement('h3', { className: 'ds-page-header__title' } as never, title)
  )
}
