export const TREE_JSON_CONTRACT_TEMPLATE = `{
  "meta": {
    "sidebarRules": {
      "singleLogoBlock": true,
      "minMenuItems": 1
    },
    "possibleIcons": ["layout-grid", "settings-2", "rows-3", "circle", "search", "download", "trash-2"],
    "fallbackIcon": "circle",
    "miniBar": [
      { "id": "mini-circle", "icon": "circle", "state": "default", "visible": true },
      { "id": "mini-layout-grid", "icon": "layout-grid", "state": "default", "visible": true }
    ]
  },
  "sidebar": [
    {
      "id": "sidebar-main",
      "section": "sidebar",
      "component_id": "DesignSystemSidebarPanel",
      "props": {
        "title": "Example",
        "subTitle": "Overview",
        "activeId": "item-2",
        "items": [
          { "id": "item-1", "label": "Dashboard", "icon": "circle", "selected": false },
          { "id": "item-2", "label": "Report", "icon": "layout-grid", "selected": true },
          { "id": "item-3", "label": "System", "icon": "server", "selected": false }
        ]
      }
    }
  ],
  "breadcrumbs": [
    {
      "id": "breadcrumbs-main",
      "section": "breadcrumbs",
      "component_id": "DesignSystemBreadcrumb",
      "props": { "model": [{ "label": "Home" }, { "label": "Screen" }] }
    }
  ],
  "main": [
    {
      "id": "header-frame",
      "section": "main",
      "component_id": "Frame",
      "props": { "layout": "vertical", "gap": 12 },
      "children": [
        {
          "id": "toolbar-row",
          "section": "main",
          "component_id": "Frame",
          "props": { "layout": "horizontal", "gap": 8, "alignItems": "center" },
          "children": [
            {
              "id": "button-1",
              "section": "main",
              "component_id": "Button",
              "props": { "label": "Button", "iconLeft": "search" }
            }
          ]
        }
      ]
    },
    {
      "id": "page-header",
      "section": "main",
      "component_id": "page_header",
      "props": { "title": "Page Title" }
    },
    {
      "id": "table-main",
      "section": "main",
      "component_id": "DesignSystemDataTable",
      "props": {
        "selectionMode": "multiple",
        "dataKey": "id",
        "paginator": true,
        "rows": 10,
        "stripedRows": true,
        "columns": [
          { "key": "name", "label": "Name" },
          { "key": "status", "label": "Status" }
        ],
        "value": [
          { "id": "r1", "name": "Row 1", "status": "healthy" },
          { "id": "r2", "name": "Row 2", "status": "warning" }
        ]
      }
    }
  ],
  "actions": []
}`

