import { defineCommand } from 'citty'

import { executeRpcCommand } from '@norka/core'

import { isAppMode, requireFile, rpc } from '../app-client'
import { printNodeResults, printError } from '../format'
import { loadDocument } from '../headless'

import type { QueryNodeResult } from '@norka/core'

async function getData(
  file: string | undefined,
  args: { selector: string; page?: string; limit?: string }
): Promise<QueryNodeResult[] | { error: string }> {
  const rpcArgs = {
    selector: args.selector,
    page: args.page,
    limit: args.limit ? Number(args.limit) : undefined
  }
  if (isAppMode(file)) return rpc<QueryNodeResult[]>('query', rpcArgs)
  const graph = await loadDocument(requireFile(file))
  return (await executeRpcCommand(graph, 'query', rpcArgs)) as QueryNodeResult[] | { error: string }
}

export default defineCommand({
  meta: {
    description: `Query nodes using XPath selectors

Examples:
  norka query file.fig "//FRAME"                              # All frames
  norka query file.fig "//FRAME[@width < 300]"                # Frames narrower than 300px
  norka query file.fig "//COMPONENT[starts-with(@name, 'Button')]"  # Components starting with Button
  norka query file.fig "//SECTION/FRAME"                      # Direct frame children of sections
  norka query file.fig "//SECTION//TEXT"                      # All text inside sections
  norka query file.fig "//*[@cornerRadius > 0]"               # Any node with corner radius`
  },
  args: {
    file: {
      type: 'positional',
      description: 'Document file path (omit to connect to running app)',
      required: false
    },
    selector: {
      type: 'positional',
      description: 'XPath selector (e.g., //FRAME[@width < 300], //TEXT[contains(@name, "Label")])',
      required: true
    },
    page: { type: 'string', description: 'Page name (default: all pages)' },
    limit: { type: 'string', description: 'Max results (default: 1000)', default: '1000' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const results = await getData(args.file, {
      selector: args.selector,
      page: args.page,
      limit: args.limit
    })

    if ('error' in results) {
      printError(results.error)
      process.exit(1)
    }

    if (args.json) {
      console.log(JSON.stringify(results, null, 2))
      return
    }

    printNodeResults(results, (n) => {
      const q = n as { width?: number; height?: number; name: string }
      return `${q.name}  ${q.width}×${q.height}`
    })
  }
})
