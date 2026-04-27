#!/usr/bin/env node
import { serve } from '@hono/node-server'

import { startServer } from './server.js'

const port = parseInt(process.env.PORT ?? '7600', 10)
const wsPort = parseInt(process.env.WS_PORT ?? '7601', 10)
const host = process.env.HOST ?? '127.0.0.1'

const { app, httpPort } = startServer({
  httpPort: port,
  wsPort,
  enableEval: process.env.NORKA_MCP_EVAL === '1',
  authToken: process.env.NORKA_MCP_AUTH_TOKEN?.trim() || null,
  corsOrigin: process.env.NORKA_MCP_CORS_ORIGIN?.trim() || null
})

serve({ fetch: app.fetch, port: httpPort, hostname: host })

console.log(`Norka MCP server`)
console.log(`  HTTP:  http://${host}:${httpPort}`)
console.log(`  WS:    ws://${host}:${wsPort}`)
console.log(`  MCP:   http://${host}:${httpPort}/mcp`)
