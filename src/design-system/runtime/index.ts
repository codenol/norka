import { createElement } from 'react'
import { BreadCrumb } from 'primereact/breadcrumb'
import { Column } from 'primereact/column'
import { DataTable } from 'primereact/datatable'
import * as LucideIcons from 'lucide-react'

type UnknownRecord = Record<string, unknown>
const SIDEBAR_LOGO_SVG = `<svg width="200" height="48" viewBox="0 0 200 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M33.1476 35.18V22.7036H40.4653V19.241H29.5449V35.18H33.1476Z" fill="#11244D"/><path fill-rule="evenodd" clip-rule="evenodd" d="M52.4656 34.9376C53.4227 34.5399 54.1608 34.0525 54.689 33.4806C54.9887 33.157 55.2489 32.8525 55.4701 32.5671L52.6095 30.9843C52.372 31.3266 52.0162 31.6453 51.5548 31.9435L51.5508 31.9461C50.9217 32.3301 50.1652 32.5172 49.2901 32.5172C48.1235 32.5172 47.1237 32.1506 46.3021 31.4138C45.4812 30.6776 44.9852 29.7083 44.8098 28.5177L44.778 28.302H56.9228L56.963 28.0185C57.0266 27.4426 57.057 27.0701 57.057 26.8906C57.057 24.6346 56.3008 22.7532 54.7892 21.2333L54.7874 21.2315C53.2962 19.6904 51.4677 18.9211 49.2901 18.9211C46.9394 18.9211 45.0054 19.7035 43.4737 21.2644C41.9641 22.8032 41.2051 24.7798 41.2051 27.2105C41.2051 29.6408 41.9638 31.6283 43.4738 33.1886C45.0051 34.7279 46.939 35.4999 49.2901 35.4999C50.457 35.4999 51.5147 35.3115 52.4656 34.9376ZM44.7597 25.9591L44.8126 25.7286C45.0742 24.5886 45.5788 23.6676 46.3322 22.9768C47.1139 22.2582 48.105 21.9038 49.2901 21.9038C50.4141 21.9038 51.3439 22.2599 52.0622 22.9817C52.7933 23.695 53.2547 24.6173 53.4514 25.7382L53.4902 25.9591H44.7597Z" fill="#11244D"/><path d="M63.434 35.18V29.1017H70.3306V35.18H73.9333V19.241H70.3306V25.6392H63.434V19.241H59.8313V35.18H63.434Z" fill="#11244D"/><path fill-rule="evenodd" clip-rule="evenodd" d="M90.5817 21.2653L90.58 21.2635C89.0698 19.7035 87.1471 18.9211 84.7963 18.9211C82.4455 18.9211 80.5116 19.7035 78.9799 21.2644C77.4702 22.8032 76.7113 24.7798 76.7113 27.2105C76.7113 29.6407 77.4699 31.6282 78.9798 33.1885C80.5112 34.7279 82.4452 35.4999 84.7963 35.4999C87.1478 35.4999 89.0709 34.7277 90.5808 33.1886C92.1122 31.628 92.8813 29.6405 92.8813 27.2105C92.8813 24.7805 92.1123 22.8043 90.5817 21.2653ZM84.7963 32.1973C83.5349 32.1973 82.4672 31.7274 81.6048 30.7936C80.7406 29.8578 80.314 28.6579 80.314 27.2105C80.314 25.7631 80.7406 24.5633 81.6048 23.6275C82.4672 22.6936 83.5349 22.2237 84.7963 22.2237C86.0577 22.2237 87.1254 22.6936 87.9878 23.6275C88.852 24.5633 89.2786 25.7631 89.2786 27.2105C89.2786 28.6579 88.852 29.8578 87.9878 30.7936C87.1254 31.7274 86.0577 32.1973 84.7963 32.1973Z" fill="#11244D"/><path d="M109.277 19.241L105.777 29.798H104.871L101.371 19.241H95.6481V35.18H99.2508V24.783H100.211L103.551 35.18H107.097L110.437 24.783H111.397V35.18H115V19.241H109.277Z" fill="#11244D"/><path d="M22.8991 16.5H19.3349L16 24.6717H18.8691L21.117 19.1613L23.365 24.6717H26.2341L22.8991 16.5Z" fill="#00BEC8"/><path d="M154.108 17.0752C156.158 17.0752 157.868 17.8764 159.24 19.4795C160.612 21.0662 161.298 23.2399 161.298 26C161.298 28.7601 160.612 30.9417 159.24 32.5449C157.868 34.1316 156.158 34.9248 154.108 34.9248C152.059 34.9248 150.348 34.1316 148.977 32.5449C147.605 30.9417 146.919 28.7601 146.919 26C146.919 23.2399 147.605 21.0662 148.977 19.4795C150.348 17.8765 152.059 17.0752 154.108 17.0752ZM130.95 17.0752C132.719 17.0752 134.132 17.5956 135.189 18.6367C136.247 19.678 136.776 21.0171 136.776 22.6533C136.776 22.9506 136.752 23.2397 136.702 23.5205C136.653 23.7849 136.594 24.0165 136.528 24.2148C136.479 24.4132 136.379 24.6447 136.23 24.9092C136.098 25.157 135.991 25.3473 135.908 25.4795C135.826 25.5952 135.677 25.7767 135.462 26.0244C135.247 26.2723 135.098 26.4379 135.016 26.5205C134.949 26.5867 134.785 26.7524 134.521 27.0166C134.256 27.281 134.098 27.4377 134.049 27.4873L129.959 31.4541V31.5781H137.024V34.6768H125.248V31.8262L132.313 25.0088C132.578 24.7444 132.768 24.5374 132.884 24.3887C133.016 24.2234 133.14 23.9918 133.256 23.6943C133.372 23.3969 133.43 23.0499 133.43 22.6533C133.43 21.9592 133.198 21.3719 132.735 20.8926C132.273 20.4133 131.677 20.1738 130.95 20.1738C130.19 20.1738 129.545 20.4635 129.017 21.042C128.488 21.6039 128.223 22.3065 128.223 23.1494H125C125 21.3646 125.554 19.91 126.661 18.7861C127.785 17.6457 129.215 17.0752 130.95 17.0752ZM143.65 34.6768H140.18V31.2061H143.65V34.6768ZM154.108 20.1738C152.985 20.1738 152.043 20.6783 151.282 21.6865C150.522 22.6782 150.142 24.1159 150.142 26C150.142 27.8842 150.522 29.3307 151.282 30.3389C152.042 31.3303 152.985 31.8262 154.108 31.8262C155.232 31.8261 156.174 31.3304 156.935 30.3389C157.695 29.3307 158.075 27.8842 158.075 26C158.075 24.116 157.695 22.6782 156.935 21.6865C156.174 20.6784 155.232 20.1739 154.108 20.1738Z" fill="#00BEC8"/></svg>`
const SIDEBAR_LOGO_DARK_SVG = `<svg width="200" height="48" viewBox="0 0 200 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M33.1476 35.18V22.7036H40.4653V19.241H29.5449V35.18H33.1476Z" fill="white"/><path fill-rule="evenodd" clip-rule="evenodd" d="M52.4656 34.9376C53.4227 34.5399 54.1608 34.0525 54.689 33.4806C54.9887 33.157 55.2489 32.8525 55.4701 32.5671L52.6095 30.9843C52.372 31.3266 52.0162 31.6453 51.5548 31.9435L51.5508 31.9461C50.9217 32.3301 50.1652 32.5172 49.2901 32.5172C48.1235 32.5172 47.1237 32.1506 46.3021 31.4138C45.4812 30.6776 44.9852 29.7083 44.8098 28.5177L44.778 28.302H56.9228L56.963 28.0185C57.0266 27.4426 57.057 27.0701 57.057 26.8906C57.057 24.6346 56.3008 22.7532 54.7892 21.2333L54.7874 21.2315C53.2962 19.6904 51.4677 18.9211 49.2901 18.9211C46.9394 18.9211 45.0054 19.7035 43.4737 21.2644C41.9641 22.8032 41.2051 24.7798 41.2051 27.2105C41.2051 29.6408 41.9638 31.6283 43.4738 33.1886C45.0051 34.7279 46.939 35.4999 49.2901 35.4999C50.457 35.4999 51.5147 35.3115 52.4656 34.9376ZM44.7597 25.9591L44.8126 25.7286C45.0742 24.5886 45.5788 23.6676 46.3322 22.9768C47.1139 22.2582 48.105 21.9038 49.2901 21.9038C50.4141 21.9038 51.3439 22.2599 52.0622 22.9817C52.7933 23.695 53.2547 24.6173 53.4514 25.7382L53.4902 25.9591H44.7597Z" fill="white"/><path d="M63.434 35.18V29.1017H70.3306V35.18H73.9333V19.241H70.3306V25.6392H63.434V19.241H59.8313V35.18H63.434Z" fill="white"/><path fill-rule="evenodd" clip-rule="evenodd" d="M90.5817 21.2653L90.58 21.2635C89.0698 19.7035 87.1471 18.9211 84.7963 18.9211C82.4455 18.9211 80.5116 19.7035 78.9799 21.2644C77.4702 22.8032 76.7113 24.7798 76.7113 27.2105C76.7113 29.6407 77.4699 31.6282 78.9798 33.1885C80.5112 34.7279 82.4452 35.4999 84.7963 35.4999C87.1478 35.4999 89.0709 34.7277 90.5808 33.1886C92.1122 31.628 92.8813 29.6405 92.8813 27.2105C92.8813 24.7805 92.1123 22.8043 90.5817 21.2653ZM84.7963 32.1973C83.5349 32.1973 82.4672 31.7274 81.6048 30.7936C80.7406 29.8578 80.314 28.6579 80.314 27.2105C80.314 25.7631 80.7406 24.5633 81.6048 23.6275C82.4672 22.6936 83.5349 22.2237 84.7963 22.2237C86.0577 22.2237 87.1254 22.6936 87.9878 23.6275C88.852 24.5633 89.2786 25.7631 89.2786 27.2105C89.2786 28.6579 88.852 29.8578 87.9878 30.7936C87.1254 31.7274 86.0577 32.1973 84.7963 32.1973Z" fill="white"/><path d="M109.277 19.241L105.777 29.798H104.871L101.371 19.241H95.6481V35.18H99.2508V24.783H100.211L103.551 35.18H107.097L110.437 24.783H111.397V35.18H115V19.241H109.277Z" fill="white"/><path d="M22.8991 16.5H19.3349L16 24.6717H18.8691L21.117 19.1613L23.365 24.6717H26.2341L22.8991 16.5Z" fill="#00BEC8"/><path d="M154.108 17.0752C156.158 17.0752 157.868 17.8764 159.24 19.4795C160.612 21.0662 161.298 23.2399 161.298 26C161.298 28.7601 160.612 30.9417 159.24 32.5449C157.868 34.1316 156.158 34.9248 154.108 34.9248C152.059 34.9248 150.348 34.1316 148.977 32.5449C147.605 30.9417 146.919 28.7601 146.919 26C146.919 23.2399 147.605 21.0662 148.977 19.4795C150.348 17.8765 152.059 17.0752 154.108 17.0752ZM130.95 17.0752C132.719 17.0752 134.132 17.5956 135.189 18.6367C136.247 19.678 136.776 21.0171 136.776 22.6533C136.776 22.9506 136.752 23.2397 136.702 23.5205C136.653 23.7849 136.594 24.0165 136.528 24.2148C136.479 24.4132 136.379 24.6447 136.23 24.9092C136.098 25.157 135.991 25.3473 135.908 25.4795C135.826 25.5952 135.677 25.7767 135.462 26.0244C135.247 26.2723 135.098 26.4379 135.016 26.5205C134.949 26.5867 134.785 26.7524 134.521 27.0166C134.256 27.281 134.098 27.4377 134.049 27.4873L129.959 31.4541V31.5781H137.024V34.6768H125.248V31.8262L132.313 25.0088C132.578 24.7444 132.768 24.5374 132.884 24.3887C133.016 24.2234 133.14 23.9918 133.256 23.6943C133.372 23.3969 133.43 23.0499 133.43 22.6533C133.43 21.9592 133.198 21.3719 132.735 20.8926C132.273 20.4133 131.677 20.1738 130.95 20.1738C130.19 20.1738 129.545 20.4635 129.017 21.042C128.488 21.6039 128.223 22.3065 128.223 23.1494H125C125 21.3646 125.554 19.91 126.661 18.7861C127.785 17.6457 129.215 17.0752 130.95 17.0752ZM143.65 34.6768H140.18V31.2061H143.65V34.6768ZM154.108 20.1738C152.985 20.1738 152.043 20.6783 151.282 21.6865C150.522 22.6782 150.142 24.1159 150.142 26C150.142 27.8842 150.522 29.3307 151.282 30.3389C152.042 31.3303 152.985 31.8262 154.108 31.8262C155.232 31.8261 156.174 31.3304 156.935 30.3389C157.695 29.3307 158.075 27.8842 158.075 26C158.075 24.116 157.695 22.6782 156.935 21.6865C156.174 20.6784 155.232 20.1739 154.108 20.1738Z" fill="#00BEC8"/></svg>`

function isDarkThemeEnabled(): boolean {
  if (typeof document === 'undefined') return false
  if (document.body.classList.contains('layout-theme-dark')) return true
  if (document.body.classList.contains('layout-theme-light')) return false
  const primeTheme = document.documentElement.dataset.primeTheme ?? ''
  if (primeTheme.includes('dark')) return true
  if (primeTheme.includes('light')) return false
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

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

export function DesignSystemMenuItem(props: UnknownRecord) {
  const label = typeof props.label === 'string' ? props.label : 'Обзор'
  const icon = typeof props.icon === 'string' ? props.icon : 'workflow'
  const selected = Boolean(props.selected)
  const stateRaw = typeof props.state === 'string' ? props.state : 'default'
  const state = selected
    ? 'active'
    : stateRaw === 'hover' || stateRaw === 'active' || stateRaw === 'active-hover'
      ? stateRaw
      : 'default'
  const iconNode = renderLucideIcon(icon, 'size-4')
  return createElement(
    'div',
    { className: `ds-sidebar-menuitem is-${state}` } as never,
    createElement(
      'div',
      { className: 'ds-sidebar-menuitem__inner' } as never,
      ...(iconNode
        ? [
            createElement(
              'span',
              { className: 'ds-sidebar-menuitem__icon' } as never,
              iconNode as never
            ) as never
          ]
        : []),
      createElement('span', null, label)
    )
  )
}

export function DesignSystemSidebarPanel(props: UnknownRecord) {
  const navItemsRaw = Array.isArray(props.items) ? (props.items as Array<UnknownRecord>) : []
  const navItems = navItemsRaw.length > 0
    ? navItemsRaw
    : [{ id: 'overview', label: 'Обзор', icon: 'circle', selected: true } satisfies UnknownRecord]
  const activeId = typeof props.activeId === 'string' ? props.activeId : ''
  const logoSvg = isDarkThemeEnabled() ? SIDEBAR_LOGO_DARK_SVG : SIDEBAR_LOGO_SVG
  return createElement(
    'div',
    { className: 'p-2 ds-sidebar-panel' } as never,
    createElement('div', {
      className: 'ds-sidebar-panel__logo',
      dangerouslySetInnerHTML: { __html: logoSvg }
    } as never),
    createElement(
      'div',
      { className: 'ds-sidebar-panel__menu' } as never,
      navItems.length > 0
        ? createElement(
            'div',
            { className: 'ds-sidebar-panel__items' } as never,
            ...navItems.map((item, index) => {
              const id = String(item.id ?? `item-${index}`)
              const label = String(item.label ?? item.title ?? `Пункт ${index + 1}`)
              const isActive = activeId ? activeId === id : Boolean(item.active ?? item.selected)
            return createElement(DesignSystemMenuItem as never, {
              key: id,
              label,
              icon: item.icon,
                selected: isActive,
              state: isActive ? 'active' : (typeof item.state === 'string' ? item.state : 'default')
            } as never)
            })
          )
        : createElement('div', { className: 'ds-sidebar-panel__menu-space' } as never)
    )
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
