---
title: Inspecting Files
description: Browse node trees, search by name or type, and dig into properties from the terminal.
---

# Inspecting Files

The CLI lets you explore design documents without opening the editor. Every command also works on the live app — just omit the file argument.

::: tip Install
```sh
bun add -g @norka/cli
# or
brew install norka/tap/norka
```
:::

## Document Info

Get a quick overview — page count, total nodes, fonts used, file size:

```sh
norka info design.fig
```

## Node Tree

Print the full node hierarchy:

```sh
norka tree design.fig
```

```
[0] [page] "Getting started" (0:46566)
  [0] [section] "" (0:46567)
    [0] [frame] "Body" (0:46568)
      [0] [frame] "Introduction" (0:46569)
        [0] [frame] "Introduction Card" (0:46570)
          [0] [frame] "Guidance" (0:46571)
```

## Find Nodes

Search by type:

```sh
norka find design.fig --type TEXT
```

Search by name:

```sh
norka find design.fig --name "Button"
```

Both flags can be combined to narrow results further.

## Query with XPath

Use XPath selectors to find nodes by type, attributes, and tree structure:

```sh
norka query design.fig "//FRAME"
```

### Useful patterns

**By type:**

```sh
norka query design.fig "//TEXT"                    # All text nodes
norka query design.fig "//COMPONENT"               # All components
norka query design.fig "//INSTANCE"                # All instances
```

**By attributes:**

```sh
norka query design.fig "//FRAME[@width < 300]"                # Frames under 300px wide
norka query design.fig "//*[@cornerRadius > 0]"               # Rounded corners
norka query design.fig "//*[@visible = false]"                # Hidden nodes
norka query design.fig "//TEXT[@fontSize >= 24]"              # Large text
norka query design.fig "//*[@opacity < 1]"                    # Semi-transparent nodes
```

**By name and text content:**

```sh
norka query design.fig "//TEXT[contains(@name, 'Button')]"    # Name contains 'Button'
norka query design.fig "//TEXT[contains(@text, 'Hello')]"     # Text content contains 'Hello'
```

**By hierarchy:**

```sh
norka query design.fig "//SECTION//TEXT"            # Text inside sections
norka query design.fig "//FRAME/TEXT"               # Direct text children of frames
norka query design.fig "//COMPONENT_SET//INSTANCE"  # Instances inside component sets
```

### Queryable attributes

`name`, `width`, `height`, `x`, `y`, `visible`, `opacity`, `cornerRadius`, `fontSize`, `fontFamily`, `fontWeight`, `layoutMode`, `itemSpacing`, `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`, `strokeWeight`, `rotation`, `locked`, `blendMode`, `text`, `lineHeight`, `letterSpacing`

### Example output

```
  Found 5 nodes

[0] [frame] "Logo  92×32" (0:9)
[1] [frame] "logo-short-6  31×32" (0:10)
[2] [frame] "wrapper  128×73" (0:20)
[3] [frame] "pen-drawing  148×52" (0:21)
[4] [frame] "surprised-emoji  32×32" (0:26)
```

## Node Details

Inspect all properties of a specific node by its ID:

```sh
norka node design.fig --id 1:23
```

## Pages

List all pages in the document:

```sh
norka pages design.fig
```

## Variables

List design variables and their collections:

```sh
norka variables design.fig
```

## Live App Mode

When the desktop app is running, omit the file argument — the CLI connects via RPC and operates on the live canvas:

```sh
norka tree              # inspect the live document
norka eval -c "..."     # query the editor
```

## Lint Designs

Check documents for naming, layout, structure, and accessibility issues:

```sh
norka lint design.fig
norka lint design.pen --preset strict
norka lint design.fig --rule color-contrast
norka lint design.fig --list-rules
```

Use `--json` for machine-readable output.

## JSON Output

All commands support `--json` for machine-readable output — pipe into `jq`, feed to CI scripts, or process with other tools:

```sh
norka tree design.fig --json | jq '.[] | .name'
```
