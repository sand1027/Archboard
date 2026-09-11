import type { ComponentBehavior } from '@/types/architecture'

/**
 * Behavior registry — keyed by component ID.
 * Covers every component across generic, AWS, extended, and bytebytego registries.
 *
 * Each entry describes:
 *   outbound — what flows FROM this component when it initiates a connection
 *   inbound  — what this component expects to receive
 *   pattern  — the architecture pattern it participates in
 *   sim      — simulation hints (latency, fanout, async, etc.)
 */
export const BEHAVIORS: Record<string, ComponentBehavior> = {

  // ─── CLIENTS ───────────────────────────────────────────────────────────────

  'web-browser': {
    outbound: { flowLabel: 'HTTP request', protocol: 'HTTPS', connectionType: 'synchronous', role: 'request', dataHint: 'GET /page' },
    inbound:  { flowLabel: 'HTTP response', protocol: 'HTTPS', connectionType: 'synchronous', role: 'response', dataHint: 'HTML/JSON' },
    pattern: 'client',
    sim: { latencyMs: 5 },
  },
  'mobile-app': {
    outbound: { flowLabel: 'API request', protocol: 'HTTPS', connectionType: 'synchronous', role: 'request', dataHint: 'REST call' },
    inbound:  { flowLabel: 'API response', protocol: 'HTTPS', connectionType: 'synchronous', role: 'response', dataHint: 'JSON payload' },
    pattern: 'client',
    sim: { latencyMs: 10 },
  },
  'desktop-app': {
    outbound: { flowLabel: 'API request', protocol: 'HTTPS', connectionType: 'synchronous', role: 'request', dataHint: 'RPC call' },
    inbound:  { flowLabel: 'API response', protocol: 'HTTPS', connectionType: 'synchronous', role: 'response', dataHint: 'response data' },
    pattern: 'client',
    sim: { latencyMs: 5 },
  },
  'iot-device': {
    outbound: { flowLabel: 'sensor data', protocol: 'MQTT', connectionType: 'asynchronous', role: 'publish', dataHint: 'telemetry' },
    inbound:  { flowLabel: 'command', protocol: 'MQTT', connectionType: 'asynchronous', role: 'receive', dataHint: 'control message' },
    pattern: 'iot',
    sim: { latencyMs: 50, async: true },
  },
  'cli-client': {
    outbound: { flowLabel: 'CLI command', protocol: 'HTTPS', connectionType: 'synchronous', role: 'request', dataHint: 'command args' },
    inbound:  { flowLabel: 'stdout', protocol: 'HTTPS', connectionType: 'synchronous', role: 'response', dataHint: 'output' },
    pattern: 'client',
  },
  'external-client': {
    outbound: { flowLabel: 'external request', protocol: 'HTTPS', connectionType: 'synchronous', role: 'request', dataHint: 'API call' },
    inbound:  { flowLabel: 'response', protocol: 'HTTPS', connectionType: 'synchronous', role: 'response', dataHint: 'response data' },
    pattern: 'client',
  },
  'end-user': {
    outbound: { flowLabel: 'user request', protocol: 'HTTPS', connectionType: 'synchronous', role: 'request', dataHint: 'user action' },
    inbound:  { flowLabel: 'rendered page', protocol: 'HTTPS', connectionType: 'synchronous', role: 'response', dataHint: 'UI' },
    pattern: 'client',
  },
  'admin-user': {
    outbound: { flowLabel: 'admin command', protocol: 'HTTPS', connectionType: 'synchronous', role: 'request', dataHint: 'admin action' },
    inbound:  { flowLabel: 'admin response', protocol: 'HTTPS', connectionType: 'synchronous', role: 'response', dataHint: 'result' },
    pattern: 'client',
  },
  'bot-crawler': {
    outbound: { flowLabel: 'crawl request', protocol: 'HTTP', connectionType: 'synchronous', role: 'request', dataHint: 'GET /url' },
    inbound:  { flowLabel: 'page content', protocol: 'HTTP', connectionType: 'synchronous', role: 'response', dataHint: 'HTML' },
    pattern: 'client',
    sim: { latencyMs: 200 },
  },

  // ─── NETWORKING ────────────────────────────────────────────────────────────

  'dns': {
    outbound: { flowLabel: 'IP address', protocol: 'UDP', connectionType: 'synchronous', role: 'resolve', dataHint: '93.184.216.34' },
    inbound:  { flowLabel: 'domain query', protocol: 'UDP', connectionType: 'synchronous', role: 'lookup', dataHint: 'api.example.com' },
    pattern: 'dns-resolution',
    sim: { latencyMs: 3, stateful: false },
  },
  'dns-resolver': {
    outbound: { flowLabel: 'IP address', protocol: 'UDP', connectionType: 'synchronous', role: 'resolve', dataHint: 'resolved IP' },
    inbound:  { flowLabel: 'domain query', protocol: 'UDP', connectionType: 'synchronous', role: 'lookup', dataHint: 'hostname' },
    pattern: 'dns-resolution',
    sim: { latencyMs: 2 },
  },
  'cdn': {
    outbound: { flowLabel: 'cached asset', protocol: 'HTTPS', connectionType: 'synchronous', role: 'response', dataHint: 'static file' },
    inbound:  { flowLabel: 'asset request', protocol: 'HTTPS', connectionType: 'synchronous', role: 'request', dataHint: 'GET /asset' },
    pattern: 'caching',
    sim: { latencyMs: 10, stateful: true },
  },
  'cdn-cache': {
    outbound: { flowLabel: 'cached content', protocol: 'HTTPS', connectionType: 'synchronous', role: 'cache-read', dataHint: 'cached response' },
    inbound:  { flowLabel: 'cache request', protocol: 'HTTPS', connectionType: 'synchronous', role: 'request', dataHint: 'resource URL' },
    pattern: 'caching',
    sim: { latencyMs: 5, stateful: true },
  },
  'load-balancer': {
    outbound: { flowLabel: 'routed request', protocol: 'HTTP', connectionType: 'synchronous', role: 'balance', dataHint: 'forwarded request' },
    inbound:  { flowLabel: 'inbound request', protocol: 'HTTPS', connectionType: 'synchronous', role: 'request', dataHint: 'client request' },
    pattern: 'load-balancing',
    sim: { latencyMs: 2, fanout: true },
  },
  'reverse-proxy': {
    outbound: { flowLabel: 'proxied request', protocol: 'HTTP', connectionType: 'synchronous', role: 'proxy', dataHint: 'forwarded request' },
    inbound:  { flowLabel: 'client request', protocol: 'HTTPS', connectionType: 'synchronous', role: 'request', dataHint: 'client request' },
    pattern: 'proxy',
    sim: { latencyMs: 2 },
  },
  'api-gateway': {
    outbound: { flowLabel: 'routed API call', protocol: 'HTTP', connectionType: 'synchronous', role: 'route', dataHint: 'API request' },
    inbound:  { flowLabel: 'API request', protocol: 'HTTPS', connectionType: 'synchronous', role: 'request', dataHint: 'REST/GraphQL call' },
    pattern: 'api-gateway',
    sim: { latencyMs: 5, fanout: true },
  },
  'waf': {
    outbound: { flowLabel: 'filtered request', protocol: 'HTTPS', connectionType: 'synchronous', role: 'forward', dataHint: 'clean request' },
    inbound:  { flowLabel: 'raw request', protocol: 'HTTPS', connectionType: 'synchronous', role: 'request', dataHint: 'unfiltered traffic' },
    pattern: 'security',
    sim: { latencyMs: 1 },
  },
  'firewall': {
    outbound: { flowLabel: 'allowed traffic', protocol: 'TCP', connectionType: 'synchronous', role: 'forward', dataHint: 'permitted packets' },
    inbound:  { flowLabel: 'network traffic', protocol: 'TCP', connectionType: 'synchronous', role: 'request', dataHint: 'raw packets' },
    pattern: 'security',
    sim: { latencyMs: 1 },
  },
  'internet': {
    outbound: { flowLabel: 'internet traffic', protocol: 'HTTPS', connectionType: 'synchronous', role: 'request', dataHint: 'public request' },
    inbound:  { flowLabel: 'public response', protocol: 'HTTPS', connectionType: 'synchronous', role: 'response', dataHint: 'response' },
    pattern: 'network',
  },
  'nat-server': {
    outbound: { flowLabel: 'translated packet', protocol: 'TCP', connectionType: 'synchronous', role: 'forward', dataHint: 'NAT translated' },
    inbound:  { flowLabel: 'private traffic', protocol: 'TCP', connectionType: 'synchronous', role: 'request', dataHint: 'private IP packet' },
    pattern: 'network',
    sim: { latencyMs: 1 },
  },
  'vpn-gateway': {
    outbound: { flowLabel: 'encrypted tunnel', protocol: 'UDP', connectionType: 'synchronous', role: 'forward', dataHint: 'VPN packet' },
    inbound:  { flowLabel: 'VPN connection', protocol: 'UDP', connectionType: 'synchronous', role: 'connect', dataHint: 'tunnel request' },
    pattern: 'security',
    sim: { latencyMs: 10 },
  },
  'service-registry': {
    outbound: { flowLabel: 'service address', protocol: 'HTTP', connectionType: 'synchronous', role: 'resolve', dataHint: 'host:port' },
    inbound:  { flowLabel: 'service lookup', protocol: 'HTTP', connectionType: 'synchronous', role: 'lookup', dataHint: 'service name' },
    pattern: 'service-discovery',
    sim: { latencyMs: 2, stateful: true },
  },
  'health-checker': {
    outbound: { flowLabel: 'health probe', protocol: 'HTTP', connectionType: 'synchronous', role: 'request', dataHint: 'GET /health' },
    inbound:  { flowLabel: 'health status', protocol: 'HTTP', connectionType: 'synchronous', role: 'response', dataHint: '200 OK / error' },
    pattern: 'observability',
    sim: { latencyMs: 5 },
  },
  'graphql-server': {
    outbound: { flowLabel: 'GraphQL response', protocol: 'GraphQL', connectionType: 'synchronous', role: 'response', dataHint: 'query result' },
    inbound:  { flowLabel: 'GraphQL query', protocol: 'GraphQL', connectionType: 'synchronous', role: 'query', dataHint: '{ query { ... } }' },
    pattern: 'api',
    sim: { latencyMs: 20 },
  },
  'rest-api-node': {
    outbound: { flowLabel: 'REST response', protocol: 'REST', connectionType: 'synchronous', role: 'response', dataHint: 'JSON response' },
    inbound:  { flowLabel: 'REST request', protocol: 'REST', connectionType: 'synchronous', role: 'request', dataHint: 'GET/POST/PUT' },
    pattern: 'api',
    sim: { latencyMs: 15 },
  },
  'websocket-server': {
    outbound: { flowLabel: 'WS message', protocol: 'WebSocket', connectionType: 'bidirectional', role: 'emit', dataHint: 'real-time event' },
    inbound:  { flowLabel: 'WS connection', protocol: 'WebSocket', connectionType: 'bidirectional', role: 'connect', dataHint: 'WS upgrade' },
    pattern: 'realtime',
    sim: { latencyMs: 5, stateful: true },
  },
  'grpc-server': {
    outbound: { flowLabel: 'gRPC response', protocol: 'gRPC', connectionType: 'synchronous', role: 'response', dataHint: 'protobuf response' },
    inbound:  { flowLabel: 'gRPC call', protocol: 'gRPC', connectionType: 'synchronous', role: 'request', dataHint: 'protobuf request' },
    pattern: 'rpc',
    sim: { latencyMs: 5 },
  },

  // ─── COMPUTE ───────────────────────────────────────────────────────────────

  'server': {
    outbound: { flowLabel: 'server response', protocol: 'HTTP', connectionType: 'synchronous', role: 'response', dataHint: 'processed result' },
    inbound:  { flowLabel: 'server request', protocol: 'HTTP', connectionType: 'synchronous', role: 'request', dataHint: 'inbound request' },
    pattern: 'compute',
    sim: { latencyMs: 20 },
  },
  'web-server': {
    outbound: { flowLabel: 'HTTP response', protocol: 'HTTP', connectionType: 'synchronous', role: 'response', dataHint: 'HTML/JSON' },
    inbound:  { flowLabel: 'HTTP request', protocol: 'HTTP', connectionType: 'synchronous', role: 'request', dataHint: 'GET/POST' },
    pattern: 'web',
    sim: { latencyMs: 10 },
  },
  'app-server': {
    outbound: { flowLabel: 'application response', protocol: 'HTTP', connectionType: 'synchronous', role: 'response', dataHint: 'business logic result' },
    inbound:  { flowLabel: 'application request', protocol: 'HTTP', connectionType: 'synchronous', role: 'request', dataHint: 'API call' },
    pattern: 'compute',
    sim: { latencyMs: 30, stateful: true },
  },
  'worker': {
    outbound: { flowLabel: 'job result', protocol: 'AMQP', connectionType: 'asynchronous', role: 'produce', dataHint: 'processed result' },
    inbound:  { flowLabel: 'job message', protocol: 'AMQP', connectionType: 'asynchronous', role: 'consume', dataHint: 'task payload' },
    pattern: 'async-worker',
    sim: { latencyMs: 500, async: true },
  },
  'container': {
    outbound: { flowLabel: 'container output', protocol: 'HTTP', connectionType: 'synchronous', role: 'response', dataHint: 'service response' },
    inbound:  { flowLabel: 'container input', protocol: 'HTTP', connectionType: 'synchronous', role: 'request', dataHint: 'service request' },
    pattern: 'compute',
    sim: { latencyMs: 20 },
  },
  'kubernetes': {
    outbound: { flowLabel: 'pod request', protocol: 'HTTP', connectionType: 'synchronous', role: 'route', dataHint: 'k8s service call' },
    inbound:  { flowLabel: 'service request', protocol: 'HTTP', connectionType: 'synchronous', role: 'request', dataHint: 'inbound traffic' },
    pattern: 'orchestration',
    sim: { latencyMs: 5, fanout: true },
  },
  'serverless': {
    outbound: { flowLabel: 'function result', protocol: 'HTTPS', connectionType: 'synchronous', role: 'response', dataHint: 'lambda response' },
    inbound:  { flowLabel: 'function invocation', protocol: 'HTTPS', connectionType: 'synchronous', role: 'request', dataHint: 'event trigger' },
    pattern: 'serverless',
    sim: { latencyMs: 50 },
  },
  'scheduler': {
    outbound: { flowLabel: 'scheduled job', protocol: 'AMQP', connectionType: 'asynchronous', role: 'trigger', dataHint: 'cron trigger' },
    inbound:  { flowLabel: 'schedule config', protocol: 'HTTP', connectionType: 'synchronous', role: 'request', dataHint: 'cron expression' },
    pattern: 'scheduler',
    sim: { latencyMs: 10, async: true },
  },
  'virtual-machine': {
    outbound: { flowLabel: 'VM response', protocol: 'HTTP', connectionType: 'synchronous', role: 'response', dataHint: 'compute result' },
    inbound:  { flowLabel: 'VM request', protocol: 'HTTP', connectionType: 'synchronous', role: 'request', dataHint: 'workload' },
    pattern: 'compute',
    sim: { latencyMs: 15 },
  },
  'bare-metal': {
    outbound: { flowLabel: 'raw compute response', protocol: 'TCP', connectionType: 'synchronous', role: 'response', dataHint: 'result' },
    inbound:  { flowLabel: 'raw compute request', protocol: 'TCP', connectionType: 'synchronous', role: 'request', dataHint: 'workload' },
    pattern: 'compute',
    sim: { latencyMs: 5 },
  },
  'edge-server': {
    outbound: { flowLabel: 'edge response', protocol: 'HTTPS', connectionType: 'synchronous', role: 'response', dataHint: 'cached/computed' },
    inbound:  { flowLabel: 'edge request', protocol: 'HTTPS', connectionType: 'synchronous', role: 'request', dataHint: 'user request' },
    pattern: 'edge-computing',
    sim: { latencyMs: 5 },
  },
  'batch-processor': {
    outbound: { flowLabel: 'batch output', protocol: 'TCP', connectionType: 'asynchronous', role: 'produce', dataHint: 'processed records' },
    inbound:  { flowLabel: 'batch input', protocol: 'TCP', connectionType: 'asynchronous', role: 'consume', dataHint: 'data records' },
    pattern: 'batch-processing',
    sim: { latencyMs: 5000, async: true },
  },
  'batch-processor-node': {
    outbound: { flowLabel: 'batch output', protocol: 'TCP', connectionType: 'asynchronous', role: 'produce', dataHint: 'processed batch' },
    inbound:  { flowLabel: 'batch input', protocol: 'TCP', connectionType: 'asynchronous', role: 'consume', dataHint: 'raw records' },
    pattern: 'batch-processing',
    sim: { latencyMs: 3000, async: true },
  },
  'apache-spark': {
    outbound: { flowLabel: 'Spark job result', protocol: 'TCP', connectionType: 'asynchronous', role: 'produce', dataHint: 'transformed data' },
    inbound:  { flowLabel: 'Spark job input', protocol: 'TCP', connectionType: 'asynchronous', role: 'consume', dataHint: 'raw dataset' },
    pattern: 'batch-processing',
    sim: { latencyMs: 10000, async: true },
  },

  // ─── SERVICES ──────────────────────────────────────────────────────────────

  'microservice': {
    outbound: { flowLabel: 'service response', protocol: 'REST', connectionType: 'synchronous', role: 'response', dataHint: 'JSON response' },
    inbound:  { flowLabel: 'service call', protocol: 'REST', connectionType: 'synchronous', role: 'request', dataHint: 'API request' },
    pattern: 'microservice',
    sim: { latencyMs: 25 },
  },
  'auth-service': {
    outbound: { flowLabel: 'auth token', protocol: 'HTTPS', connectionType: 'synchronous', role: 'token', dataHint: 'JWT token' },
    inbound:  { flowLabel: 'auth request', protocol: 'HTTPS', connectionType: 'synchronous', role: 'authenticate', dataHint: 'credentials' },
    pattern: 'auth',
    sim: { latencyMs: 30 },
  },
  'user-service': {
    outbound: { flowLabel: 'user data', protocol: 'REST', connectionType: 'synchronous', role: 'response', dataHint: 'user profile' },
    inbound:  { flowLabel: 'user request', protocol: 'REST', connectionType: 'synchronous', role: 'request', dataHint: 'user ID' },
    pattern: 'crud',
    sim: { latencyMs: 20 },
  },
  'payment-service': {
    outbound: { flowLabel: 'payment result', protocol: 'HTTPS', connectionType: 'synchronous', role: 'response', dataHint: 'charge confirmation' },
    inbound:  { flowLabel: 'payment request', protocol: 'HTTPS', connectionType: 'synchronous', role: 'request', dataHint: 'payment intent' },
    pattern: 'payment',
    sim: { latencyMs: 200 },
  },
  'notification-service': {
    outbound: { flowLabel: 'notification', protocol: 'HTTPS', connectionType: 'asynchronous', role: 'emit', dataHint: 'push / email / SMS' },
    inbound:  { flowLabel: 'notification trigger', protocol: 'AMQP', connectionType: 'asynchronous', role: 'receive', dataHint: 'event payload' },
    pattern: 'notifications',
    sim: { latencyMs: 50, async: true },
  },
  'search-service': {
    outbound: { flowLabel: 'search results', protocol: 'REST', connectionType: 'synchronous', role: 'response', dataHint: 'result set' },
    inbound:  { flowLabel: 'search query', protocol: 'REST', connectionType: 'synchronous', role: 'query', dataHint: 'query string' },
    pattern: 'search',
    sim: { latencyMs: 30 },
  },
  'video-service': {
    outbound: { flowLabel: 'video stream', protocol: 'HTTPS', connectionType: 'synchronous', role: 'stream', dataHint: 'HLS/DASH stream' },
    inbound:  { flowLabel: 'video request', protocol: 'HTTPS', connectionType: 'synchronous', role: 'request', dataHint: 'video ID' },
    pattern: 'media',
    sim: { latencyMs: 100 },
  },
  'file-service': {
    outbound: { flowLabel: 'file data', protocol: 'HTTPS', connectionType: 'synchronous', role: 'retrieve', dataHint: 'file bytes' },
    inbound:  { flowLabel: 'file upload', protocol: 'HTTPS', connectionType: 'synchronous', role: 'upload', dataHint: 'multipart/form-data' },
    pattern: 'file-storage',
    sim: { latencyMs: 80 },
  },
  'file-service-node': {
    outbound: { flowLabel: 'file content', protocol: 'HTTPS', connectionType: 'synchronous', role: 'retrieve', dataHint: 'file bytes' },
    inbound:  { flowLabel: 'file request', protocol: 'HTTPS', connectionType: 'synchronous', role: 'request', dataHint: 'file ID' },
    pattern: 'file-storage',
    sim: { latencyMs: 60 },
  },
  'media-service': {
    outbound: { flowLabel: 'media asset', protocol: 'HTTPS', connectionType: 'synchronous', role: 'retrieve', dataHint: 'media URL' },
    inbound:  { flowLabel: 'media request', protocol: 'HTTPS', connectionType: 'synchronous', role: 'request', dataHint: 'media ID' },
    pattern: 'media',
    sim: { latencyMs: 50 },
  },
  'transcoding-service': {
    outbound: { flowLabel: 'transcoded video', protocol: 'HTTPS', connectionType: 'asynchronous', role: 'produce', dataHint: 'HLS segments' },
    inbound:  { flowLabel: 'raw video', protocol: 'HTTPS', connectionType: 'asynchronous', role: 'consume', dataHint: 'MP4 upload' },
    pattern: 'media-processing',
    sim: { latencyMs: 30000, async: true },
  },
  'recommendation-engine': {
    outbound: { flowLabel: 'recommendations', protocol: 'REST', connectionType: 'synchronous', role: 'response', dataHint: 'item list' },
    inbound:  { flowLabel: 'user context', protocol: 'REST', connectionType: 'synchronous', role: 'query', dataHint: 'user ID + context' },
    pattern: 'ml-inference',
    sim: { latencyMs: 40 },
  },
  'reporting-service': {
    outbound: { flowLabel: 'report data', protocol: 'REST', connectionType: 'synchronous', role: 'response', dataHint: 'report payload' },
    inbound:  { flowLabel: 'report query', protocol: 'REST', connectionType: 'synchronous', role: 'query', dataHint: 'report params' },
    pattern: 'analytics',
    sim: { latencyMs: 500 },
  },
  'oauth-server': {
    outbound: { flowLabel: 'access token', protocol: 'HTTPS', connectionType: 'synchronous', role: 'token', dataHint: 'OAuth2 token' },
    inbound:  { flowLabel: 'auth code', protocol: 'HTTPS', connectionType: 'synchronous', role: 'authenticate', dataHint: 'authorization code' },
    pattern: 'oauth',
    sim: { latencyMs: 50 },
  },

  // ─── DATABASES ─────────────────────────────────────────────────────────────

  'postgresql': {
    outbound: { flowLabel: 'query result', protocol: 'TCP', connectionType: 'synchronous', role: 'result', dataHint: 'row data' },
    inbound:  { flowLabel: 'SQL query', protocol: 'TCP', connectionType: 'synchronous', role: 'query', dataHint: 'SELECT/INSERT/UPDATE' },
    pattern: 'rdbms',
    sim: { latencyMs: 10, stateful: true },
  },
  'mysql': {
    outbound: { flowLabel: 'query result', protocol: 'TCP', connectionType: 'synchronous', role: 'result', dataHint: 'row data' },
    inbound:  { flowLabel: 'SQL query', protocol: 'TCP', connectionType: 'synchronous', role: 'query', dataHint: 'SELECT/INSERT' },
    pattern: 'rdbms',
    sim: { latencyMs: 10, stateful: true },
  },
  'mongodb': {
    outbound: { flowLabel: 'document', protocol: 'TCP', connectionType: 'synchronous', role: 'result', dataHint: 'BSON document' },
    inbound:  { flowLabel: 'document query', protocol: 'TCP', connectionType: 'synchronous', role: 'query', dataHint: 'find / aggregate' },
    pattern: 'nosql',
    sim: { latencyMs: 8, stateful: true },
  },
  'cassandra': {
    outbound: { flowLabel: 'row data', protocol: 'TCP', connectionType: 'synchronous', role: 'result', dataHint: 'CQL result' },
    inbound:  { flowLabel: 'CQL query', protocol: 'TCP', connectionType: 'synchronous', role: 'query', dataHint: 'SELECT/INSERT CQL' },
    pattern: 'wide-column',
    sim: { latencyMs: 5, stateful: true },
  },
  'elasticsearch': {
    outbound: { flowLabel: 'search hits', protocol: 'HTTP', connectionType: 'synchronous', role: 'result', dataHint: 'search results' },
    inbound:  { flowLabel: 'search query', protocol: 'HTTP', connectionType: 'synchronous', role: 'query', dataHint: 'DSL query' },
    pattern: 'search',
    sim: { latencyMs: 15, stateful: true },
  },
  'db-primary': {
    outbound: { flowLabel: 'replication stream', protocol: 'TCP', connectionType: 'replication', role: 'replicate', dataHint: 'WAL stream' },
    inbound:  { flowLabel: 'write query', protocol: 'TCP', connectionType: 'synchronous', role: 'write', dataHint: 'INSERT/UPDATE/DELETE' },
    pattern: 'replication',
    sim: { latencyMs: 8, stateful: true },
  },
  'db-replica': {
    outbound: { flowLabel: 'read result', protocol: 'TCP', connectionType: 'synchronous', role: 'result', dataHint: 'replicated data' },
    inbound:  { flowLabel: 'replication stream', protocol: 'TCP', connectionType: 'replication', role: 'replicate', dataHint: 'WAL updates' },
    pattern: 'replication',
    sim: { latencyMs: 10, stateful: true },
  },
  'kv-database': {
    outbound: { flowLabel: 'value', protocol: 'TCP', connectionType: 'synchronous', role: 'result', dataHint: 'stored value' },
    inbound:  { flowLabel: 'key lookup', protocol: 'TCP', connectionType: 'synchronous', role: 'query', dataHint: 'GET key' },
    pattern: 'key-value',
    sim: { latencyMs: 3, stateful: true },
  },
  'document-db': {
    outbound: { flowLabel: 'document', protocol: 'TCP', connectionType: 'synchronous', role: 'result', dataHint: 'JSON document' },
    inbound:  { flowLabel: 'document query', protocol: 'TCP', connectionType: 'synchronous', role: 'query', dataHint: 'find query' },
    pattern: 'nosql',
    sim: { latencyMs: 8, stateful: true },
  },
  'wide-column-db': {
    outbound: { flowLabel: 'column data', protocol: 'TCP', connectionType: 'synchronous', role: 'result', dataHint: 'columns' },
    inbound:  { flowLabel: 'column query', protocol: 'TCP', connectionType: 'synchronous', role: 'query', dataHint: 'row key' },
    pattern: 'wide-column',
    sim: { latencyMs: 5, stateful: true },
  },
  'graph-db': {
    outbound: { flowLabel: 'graph traversal', protocol: 'HTTP', connectionType: 'synchronous', role: 'result', dataHint: 'nodes + edges' },
    inbound:  { flowLabel: 'graph query', protocol: 'HTTP', connectionType: 'synchronous', role: 'query', dataHint: 'Cypher / Gremlin' },
    pattern: 'graph',
    sim: { latencyMs: 20, stateful: true },
  },
  'time-series-db': {
    outbound: { flowLabel: 'time series data', protocol: 'HTTP', connectionType: 'synchronous', role: 'result', dataHint: 'metric series' },
    inbound:  { flowLabel: 'metric write', protocol: 'HTTP', connectionType: 'synchronous', role: 'write', dataHint: 'timestamp + value' },
    pattern: 'time-series',
    sim: { latencyMs: 5, stateful: true },
  },
  'vector-db': {
    outbound: { flowLabel: 'similar vectors', protocol: 'HTTP', connectionType: 'synchronous', role: 'result', dataHint: 'nearest neighbors' },
    inbound:  { flowLabel: 'vector query', protocol: 'HTTP', connectionType: 'synchronous', role: 'query', dataHint: 'embedding vector' },
    pattern: 'vector-search',
    sim: { latencyMs: 20, stateful: true },
  },
  'search-index-db': {
    outbound: { flowLabel: 'search results', protocol: 'HTTP', connectionType: 'synchronous', role: 'result', dataHint: 'ranked docs' },
    inbound:  { flowLabel: 'index query', protocol: 'HTTP', connectionType: 'synchronous', role: 'query', dataHint: 'search terms' },
    pattern: 'search',
    sim: { latencyMs: 15, stateful: true },
  },
  'shard-1': {
    outbound: { flowLabel: 'shard result', protocol: 'TCP', connectionType: 'synchronous', role: 'result', dataHint: 'shard 1 data' },
    inbound:  { flowLabel: 'shard query', protocol: 'TCP', connectionType: 'synchronous', role: 'query', dataHint: 'routed query' },
    pattern: 'sharding',
    sim: { latencyMs: 8, stateful: true },
  },
  'shard-2': {
    outbound: { flowLabel: 'shard result', protocol: 'TCP', connectionType: 'synchronous', role: 'result', dataHint: 'shard 2 data' },
    inbound:  { flowLabel: 'shard query', protocol: 'TCP', connectionType: 'synchronous', role: 'query', dataHint: 'routed query' },
    pattern: 'sharding',
    sim: { latencyMs: 8, stateful: true },
  },
  'shard-3': {
    outbound: { flowLabel: 'shard result', protocol: 'TCP', connectionType: 'synchronous', role: 'result', dataHint: 'shard 3 data' },
    inbound:  { flowLabel: 'shard query', protocol: 'TCP', connectionType: 'synchronous', role: 'query', dataHint: 'routed query' },
    pattern: 'sharding',
    sim: { latencyMs: 8, stateful: true },
  },
  'shard-n': {
    outbound: { flowLabel: 'shard result', protocol: 'TCP', connectionType: 'synchronous', role: 'result', dataHint: 'shard N data' },
    inbound:  { flowLabel: 'shard query', protocol: 'TCP', connectionType: 'synchronous', role: 'query', dataHint: 'routed query' },
    pattern: 'sharding',
    sim: { latencyMs: 8, stateful: true },
  },

  // ─── CACHING ───────────────────────────────────────────────────────────────

  'redis': {
    outbound: { flowLabel: 'cached value', protocol: 'TCP', connectionType: 'synchronous', role: 'cache-read', dataHint: 'GET key → value' },
    inbound:  { flowLabel: 'cache request', protocol: 'TCP', connectionType: 'synchronous', role: 'cache-write', dataHint: 'SET key value' },
    pattern: 'caching',
    sim: { latencyMs: 1, stateful: true },
  },
  'memcached': {
    outbound: { flowLabel: 'cached value', protocol: 'TCP', connectionType: 'synchronous', role: 'cache-read', dataHint: 'cached data' },
    inbound:  { flowLabel: 'cache set', protocol: 'TCP', connectionType: 'synchronous', role: 'cache-write', dataHint: 'key + value' },
    pattern: 'caching',
    sim: { latencyMs: 1, stateful: true },
  },
  'cache-cluster': {
    outbound: { flowLabel: 'cache response', protocol: 'TCP', connectionType: 'synchronous', role: 'cache-read', dataHint: 'distributed cache hit' },
    inbound:  { flowLabel: 'cache request', protocol: 'TCP', connectionType: 'synchronous', role: 'cache-write', dataHint: 'key lookup / set' },
    pattern: 'caching',
    sim: { latencyMs: 2, stateful: true, fanout: false },
  },

  // ─── STORAGE ───────────────────────────────────────────────────────────────

  'object-storage': {
    outbound: { flowLabel: 'object data', protocol: 'HTTPS', connectionType: 'synchronous', role: 'retrieve', dataHint: 'blob bytes' },
    inbound:  { flowLabel: 'object upload', protocol: 'HTTPS', connectionType: 'synchronous', role: 'store', dataHint: 'PUT object' },
    pattern: 'object-storage',
    sim: { latencyMs: 50, stateful: true },
  },
  'file-storage': {
    outbound: { flowLabel: 'file data', protocol: 'TCP', connectionType: 'synchronous', role: 'retrieve', dataHint: 'file bytes' },
    inbound:  { flowLabel: 'file write', protocol: 'TCP', connectionType: 'synchronous', role: 'store', dataHint: 'file data' },
    pattern: 'file-storage',
    sim: { latencyMs: 20, stateful: true },
  },
  'block-storage': {
    outbound: { flowLabel: 'block data', protocol: 'TCP', connectionType: 'synchronous', role: 'retrieve', dataHint: 'block read' },
    inbound:  { flowLabel: 'block write', protocol: 'TCP', connectionType: 'synchronous', role: 'store', dataHint: 'block write I/O' },
    pattern: 'block-storage',
    sim: { latencyMs: 5, stateful: true },
  },
  'data-lake': {
    outbound: { flowLabel: 'raw data', protocol: 'HTTPS', connectionType: 'asynchronous', role: 'retrieve', dataHint: 'raw dataset' },
    inbound:  { flowLabel: 'data ingest', protocol: 'HTTPS', connectionType: 'asynchronous', role: 'store', dataHint: 'raw data dump' },
    pattern: 'data-lake',
    sim: { latencyMs: 200, async: true, stateful: true },
  },
  'data-warehouse': {
    outbound: { flowLabel: 'analytics query result', protocol: 'HTTPS', connectionType: 'synchronous', role: 'result', dataHint: 'OLAP result' },
    inbound:  { flowLabel: 'analytics query', protocol: 'HTTPS', connectionType: 'synchronous', role: 'query', dataHint: 'SQL OLAP query' },
    pattern: 'analytics',
    sim: { latencyMs: 1000, stateful: true },
  },
  'blob-store': {
    outbound: { flowLabel: 'blob data', protocol: 'HTTPS', connectionType: 'synchronous', role: 'retrieve', dataHint: 'binary blob' },
    inbound:  { flowLabel: 'blob upload', protocol: 'HTTPS', connectionType: 'synchronous', role: 'store', dataHint: 'PUT /blob' },
    pattern: 'object-storage',
    sim: { latencyMs: 60, stateful: true },
  },
  'cold-storage': {
    outbound: { flowLabel: 'archived data', protocol: 'HTTPS', connectionType: 'asynchronous', role: 'retrieve', dataHint: 'archive retrieval' },
    inbound:  { flowLabel: 'archive request', protocol: 'HTTPS', connectionType: 'asynchronous', role: 'store', dataHint: 'cold data' },
    pattern: 'archival',
    sim: { latencyMs: 5000, async: true, stateful: true },
  },
  'log-store': {
    outbound: { flowLabel: 'log entries', protocol: 'HTTP', connectionType: 'synchronous', role: 'retrieve', dataHint: 'log query result' },
    inbound:  { flowLabel: 'log write', protocol: 'TCP', connectionType: 'asynchronous', role: 'log', dataHint: 'log line' },
    pattern: 'logging',
    sim: { latencyMs: 5, async: true, stateful: true },
  },
  'hdfs': {
    outbound: { flowLabel: 'HDFS block', protocol: 'TCP', connectionType: 'synchronous', role: 'retrieve', dataHint: 'data block' },
    inbound:  { flowLabel: 'HDFS write', protocol: 'TCP', connectionType: 'asynchronous', role: 'store', dataHint: 'data block' },
    pattern: 'distributed-fs',
    sim: { latencyMs: 100, async: true, stateful: true },
  },

  // ─── MESSAGING ─────────────────────────────────────────────────────────────

  'message-queue': {
    outbound: { flowLabel: 'dequeued message', protocol: 'AMQP', connectionType: 'asynchronous', role: 'consume', dataHint: 'message payload' },
    inbound:  { flowLabel: 'enqueue message', protocol: 'AMQP', connectionType: 'asynchronous', role: 'produce', dataHint: 'message' },
    pattern: 'message-queue',
    sim: { latencyMs: 5, async: true, ordered: true, stateful: true },
  },
  'kafka': {
    outbound: { flowLabel: 'Kafka message', protocol: 'Kafka', connectionType: 'event', role: 'consume', dataHint: 'event record' },
    inbound:  { flowLabel: 'publish event', protocol: 'Kafka', connectionType: 'event', role: 'produce', dataHint: 'event payload' },
    pattern: 'pub-sub',
    sim: { latencyMs: 5, async: true, ordered: true, fanout: true, stateful: true },
  },
  'rabbitmq': {
    outbound: { flowLabel: 'AMQP message', protocol: 'AMQP', connectionType: 'asynchronous', role: 'consume', dataHint: 'queued message' },
    inbound:  { flowLabel: 'AMQP publish', protocol: 'AMQP', connectionType: 'asynchronous', role: 'produce', dataHint: 'message payload' },
    pattern: 'message-broker',
    sim: { latencyMs: 5, async: true, fanout: true, stateful: true },
  },
  'pubsub': {
    outbound: { flowLabel: 'published event', protocol: 'HTTPS', connectionType: 'event', role: 'publish', dataHint: 'event payload' },
    inbound:  { flowLabel: 'event subscription', protocol: 'HTTPS', connectionType: 'event', role: 'subscribe', dataHint: 'topic subscription' },
    pattern: 'pub-sub',
    sim: { latencyMs: 10, async: true, fanout: true },
  },
  'event-bus': {
    outbound: { flowLabel: 'event', protocol: 'AMQP', connectionType: 'event', role: 'emit', dataHint: 'domain event' },
    inbound:  { flowLabel: 'event publish', protocol: 'AMQP', connectionType: 'event', role: 'receive', dataHint: 'event payload' },
    pattern: 'event-driven',
    sim: { latencyMs: 5, async: true, fanout: true },
  },
  'partitioned-topic': {
    outbound: { flowLabel: 'partition message', protocol: 'Kafka', connectionType: 'event', role: 'consume', dataHint: 'ordered record' },
    inbound:  { flowLabel: 'partition write', protocol: 'Kafka', connectionType: 'event', role: 'produce', dataHint: 'keyed record' },
    pattern: 'pub-sub',
    sim: { latencyMs: 3, async: true, ordered: true, fanout: true, stateful: true },
  },
  'consumer-group': {
    outbound: { flowLabel: 'processed message', protocol: 'Kafka', connectionType: 'event', role: 'consume', dataHint: 'consumed offset' },
    inbound:  { flowLabel: 'Kafka message', protocol: 'Kafka', connectionType: 'event', role: 'consume', dataHint: 'event record' },
    pattern: 'pub-sub',
    sim: { latencyMs: 20, async: true, stateful: true },
  },
  'dlq': {
    outbound: { flowLabel: 'failed message', protocol: 'AMQP', connectionType: 'asynchronous', role: 'produce', dataHint: 'poison message' },
    inbound:  { flowLabel: 'failed message', protocol: 'AMQP', connectionType: 'asynchronous', role: 'receive', dataHint: 'retry-exhausted msg' },
    pattern: 'error-handling',
    sim: { latencyMs: 5, async: true, stateful: true },
  },
  'delay-queue': {
    outbound: { flowLabel: 'delayed message', protocol: 'AMQP', connectionType: 'asynchronous', role: 'consume', dataHint: 'scheduled delivery' },
    inbound:  { flowLabel: 'delayed enqueue', protocol: 'AMQP', connectionType: 'asynchronous', role: 'produce', dataHint: 'message + delay' },
    pattern: 'message-queue',
    sim: { latencyMs: 1000, async: true, stateful: true },
  },
  'fifo-queue': {
    outbound: { flowLabel: 'ordered message', protocol: 'AMQP', connectionType: 'asynchronous', role: 'consume', dataHint: 'FIFO message' },
    inbound:  { flowLabel: 'enqueue', protocol: 'AMQP', connectionType: 'asynchronous', role: 'produce', dataHint: 'message' },
    pattern: 'message-queue',
    sim: { latencyMs: 5, async: true, ordered: true, stateful: true },
  },
  'priority-queue': {
    outbound: { flowLabel: 'priority message', protocol: 'AMQP', connectionType: 'asynchronous', role: 'consume', dataHint: 'high-priority first' },
    inbound:  { flowLabel: 'enqueue with priority', protocol: 'AMQP', connectionType: 'asynchronous', role: 'produce', dataHint: 'priority + message' },
    pattern: 'message-queue',
    sim: { latencyMs: 5, async: true, stateful: true },
  },
  'fanout': {
    outbound: { flowLabel: 'broadcast message', protocol: 'AMQP', connectionType: 'event', role: 'publish', dataHint: 'broadcast payload' },
    inbound:  { flowLabel: 'source message', protocol: 'AMQP', connectionType: 'event', role: 'receive', dataHint: 'message to fan out' },
    pattern: 'pub-sub',
    sim: { latencyMs: 3, async: true, fanout: true },
  },
  'stream-processor': {
    outbound: { flowLabel: 'processed stream', protocol: 'Kafka', connectionType: 'event', role: 'produce', dataHint: 'transformed events' },
    inbound:  { flowLabel: 'input stream', protocol: 'Kafka', connectionType: 'event', role: 'consume', dataHint: 'raw event stream' },
    pattern: 'stream-processing',
    sim: { latencyMs: 50, async: true, stateful: true },
  },
  'apache-flink': {
    outbound: { flowLabel: 'Flink output', protocol: 'Kafka', connectionType: 'event', role: 'produce', dataHint: 'stream result' },
    inbound:  { flowLabel: 'Flink input', protocol: 'Kafka', connectionType: 'event', role: 'consume', dataHint: 'event stream' },
    pattern: 'stream-processing',
    sim: { latencyMs: 20, async: true, stateful: true },
  },
  'backpressure': {
    outbound: { flowLabel: 'slow-down signal', protocol: 'TCP', connectionType: 'asynchronous', role: 'emit', dataHint: 'backpressure signal' },
    inbound:  { flowLabel: 'overflow traffic', protocol: 'TCP', connectionType: 'asynchronous', role: 'receive', dataHint: 'excess messages' },
    pattern: 'resilience',
    sim: { latencyMs: 0, async: true },
  },
  'webhook': {
    outbound: { flowLabel: 'webhook POST', protocol: 'HTTPS', connectionType: 'event', role: 'emit', dataHint: 'event payload' },
    inbound:  { flowLabel: 'event trigger', protocol: 'HTTPS', connectionType: 'event', role: 'receive', dataHint: 'system event' },
    pattern: 'event-driven',
    sim: { latencyMs: 100, async: true },
  },

  // ─── OBSERVABILITY ─────────────────────────────────────────────────────────

  'monitoring': {
    outbound: { flowLabel: 'alert', protocol: 'HTTP', connectionType: 'asynchronous', role: 'alert', dataHint: 'threshold breach' },
    inbound:  { flowLabel: 'metrics', protocol: 'HTTP', connectionType: 'asynchronous', role: 'metric', dataHint: 'time-series metrics' },
    pattern: 'observability',
    sim: { latencyMs: 10, async: true, stateful: true },
  },
  'logging': {
    outbound: { flowLabel: 'log query result', protocol: 'HTTP', connectionType: 'synchronous', role: 'result', dataHint: 'log lines' },
    inbound:  { flowLabel: 'log events', protocol: 'TCP', connectionType: 'asynchronous', role: 'log', dataHint: 'structured logs' },
    pattern: 'observability',
    sim: { latencyMs: 5, async: true, stateful: true },
  },
  'tracing': {
    outbound: { flowLabel: 'trace data', protocol: 'HTTP', connectionType: 'asynchronous', role: 'trace', dataHint: 'span tree' },
    inbound:  { flowLabel: 'trace span', protocol: 'HTTP', connectionType: 'asynchronous', role: 'trace', dataHint: 'trace span' },
    pattern: 'observability',
    sim: { latencyMs: 5, async: true, stateful: true },
  },
  'dashboard': {
    outbound: { flowLabel: 'dashboard data', protocol: 'HTTP', connectionType: 'synchronous', role: 'retrieve', dataHint: 'chart data' },
    inbound:  { flowLabel: 'metrics query', protocol: 'HTTP', connectionType: 'synchronous', role: 'query', dataHint: 'PromQL / query' },
    pattern: 'observability',
    sim: { latencyMs: 100 },
  },
  'error-tracker': {
    outbound: { flowLabel: 'error alert', protocol: 'HTTP', connectionType: 'asynchronous', role: 'alert', dataHint: 'error event' },
    inbound:  { flowLabel: 'error event', protocol: 'HTTPS', connectionType: 'asynchronous', role: 'receive', dataHint: 'exception + stack' },
    pattern: 'observability',
    sim: { latencyMs: 20, async: true, stateful: true },
  },
  'audit-log': {
    outbound: { flowLabel: 'audit entry', protocol: 'HTTP', connectionType: 'synchronous', role: 'retrieve', dataHint: 'audit record' },
    inbound:  { flowLabel: 'audit event', protocol: 'TCP', connectionType: 'asynchronous', role: 'log', dataHint: 'user action' },
    pattern: 'compliance',
    sim: { latencyMs: 5, async: true, stateful: true },
  },
  'sla-monitor': {
    outbound: { flowLabel: 'SLA violation', protocol: 'HTTP', connectionType: 'asynchronous', role: 'alert', dataHint: 'SLA breach alert' },
    inbound:  { flowLabel: 'latency metric', protocol: 'HTTP', connectionType: 'asynchronous', role: 'metric', dataHint: 'p99 latency' },
    pattern: 'observability',
    sim: { latencyMs: 5, async: true },
  },

  // ─── SECURITY ──────────────────────────────────────────────────────────────

  'iam': {
    outbound: { flowLabel: 'permission decision', protocol: 'HTTPS', connectionType: 'synchronous', role: 'authorize', dataHint: 'allow / deny' },
    inbound:  { flowLabel: 'permission check', protocol: 'HTTPS', connectionType: 'synchronous', role: 'authorize', dataHint: 'principal + action' },
    pattern: 'authz',
    sim: { latencyMs: 10 },
  },
  'secret-manager': {
    outbound: { flowLabel: 'secret value', protocol: 'HTTPS', connectionType: 'synchronous', role: 'retrieve', dataHint: 'decrypted secret' },
    inbound:  { flowLabel: 'secret request', protocol: 'HTTPS', connectionType: 'synchronous', role: 'authenticate', dataHint: 'secret name' },
    pattern: 'secrets',
    sim: { latencyMs: 20 },
  },
  'certificate': {
    outbound: { flowLabel: 'TLS cert', protocol: 'HTTPS', connectionType: 'synchronous', role: 'token', dataHint: 'X.509 certificate' },
    inbound:  { flowLabel: 'cert request', protocol: 'HTTPS', connectionType: 'synchronous', role: 'request', dataHint: 'CSR' },
    pattern: 'security',
    sim: { latencyMs: 5 },
  },
  'jwt-store': {
    outbound: { flowLabel: 'JWT token', protocol: 'HTTPS', connectionType: 'synchronous', role: 'token', dataHint: 'eyJhbGciOi...' },
    inbound:  { flowLabel: 'token validate', protocol: 'HTTPS', connectionType: 'synchronous', role: 'authenticate', dataHint: 'Bearer token' },
    pattern: 'auth',
    sim: { latencyMs: 5 },
  },
  'api-key-store': {
    outbound: { flowLabel: 'API key', protocol: 'HTTPS', connectionType: 'synchronous', role: 'token', dataHint: 'api_key_xyz' },
    inbound:  { flowLabel: 'key validation', protocol: 'HTTPS', connectionType: 'synchronous', role: 'authenticate', dataHint: 'X-API-Key header' },
    pattern: 'auth',
    sim: { latencyMs: 5 },
  },
  'tls-termination': {
    outbound: { flowLabel: 'plaintext request', protocol: 'HTTP', connectionType: 'synchronous', role: 'forward', dataHint: 'decrypted traffic' },
    inbound:  { flowLabel: 'TLS request', protocol: 'HTTPS', connectionType: 'synchronous', role: 'request', dataHint: 'encrypted traffic' },
    pattern: 'security',
    sim: { latencyMs: 1 },
  },

  // ─── SHARDING ──────────────────────────────────────────────────────────────

  'shard-coordinator': {
    outbound: { flowLabel: 'routed query', protocol: 'TCP', connectionType: 'synchronous', role: 'route', dataHint: 'shard key → query' },
    inbound:  { flowLabel: 'client query', protocol: 'TCP', connectionType: 'synchronous', role: 'query', dataHint: 'query + shard key' },
    pattern: 'sharding',
    sim: { latencyMs: 3, fanout: false },
  },
  'consistent-hash': {
    outbound: { flowLabel: 'hash assignment', protocol: 'TCP', connectionType: 'synchronous', role: 'route', dataHint: 'node assignment' },
    inbound:  { flowLabel: 'key lookup', protocol: 'TCP', connectionType: 'synchronous', role: 'lookup', dataHint: 'key to hash' },
    pattern: 'consistent-hashing',
    sim: { latencyMs: 1 },
  },
  'range-shard': {
    outbound: { flowLabel: 'range result', protocol: 'TCP', connectionType: 'synchronous', role: 'result', dataHint: 'range data' },
    inbound:  { flowLabel: 'range query', protocol: 'TCP', connectionType: 'synchronous', role: 'query', dataHint: 'key range query' },
    pattern: 'sharding',
    sim: { latencyMs: 8, stateful: true },
  },
  'hash-shard': {
    outbound: { flowLabel: 'shard data', protocol: 'TCP', connectionType: 'synchronous', role: 'result', dataHint: 'hash partition data' },
    inbound:  { flowLabel: 'hashed query', protocol: 'TCP', connectionType: 'synchronous', role: 'query', dataHint: 'hashed key' },
    pattern: 'sharding',
    sim: { latencyMs: 8, stateful: true },
  },
  'hot-shard': {
    outbound: { flowLabel: 'overloaded response', protocol: 'TCP', connectionType: 'synchronous', role: 'result', dataHint: 'high-traffic shard' },
    inbound:  { flowLabel: 'hot key query', protocol: 'TCP', connectionType: 'synchronous', role: 'query', dataHint: 'hot key' },
    pattern: 'sharding',
    sim: { latencyMs: 50, stateful: true },
  },

  // ─── RATE LIMITING ─────────────────────────────────────────────────────────

  'token-bucket': {
    outbound: { flowLabel: 'rate-limited pass', protocol: 'HTTP', connectionType: 'synchronous', role: 'forward', dataHint: 'permitted request' },
    inbound:  { flowLabel: 'inbound request', protocol: 'HTTP', connectionType: 'synchronous', role: 'request', dataHint: 'client request' },
    pattern: 'rate-limiting',
    sim: { latencyMs: 1 },
  },
  'leaky-bucket': {
    outbound: { flowLabel: 'smoothed request', protocol: 'HTTP', connectionType: 'synchronous', role: 'forward', dataHint: 'throttled request' },
    inbound:  { flowLabel: 'burst request', protocol: 'HTTP', connectionType: 'synchronous', role: 'request', dataHint: 'burst traffic' },
    pattern: 'rate-limiting',
    sim: { latencyMs: 2 },
  },
  'global-rate-limiter': {
    outbound: { flowLabel: 'rate check result', protocol: 'TCP', connectionType: 'synchronous', role: 'forward', dataHint: 'allow/deny' },
    inbound:  { flowLabel: 'rate check', protocol: 'TCP', connectionType: 'synchronous', role: 'request', dataHint: 'client ID + counter' },
    pattern: 'rate-limiting',
    sim: { latencyMs: 2 },
  },
  'quota-manager': {
    outbound: { flowLabel: 'quota result', protocol: 'HTTP', connectionType: 'synchronous', role: 'response', dataHint: 'remaining quota' },
    inbound:  { flowLabel: 'quota check', protocol: 'HTTP', connectionType: 'synchronous', role: 'request', dataHint: 'user + usage' },
    pattern: 'rate-limiting',
    sim: { latencyMs: 5 },
  },

  // ─── REPLICATION ───────────────────────────────────────────────────────────

  'leader-follower-repl': {
    outbound: { flowLabel: 'replication stream', protocol: 'TCP', connectionType: 'replication', role: 'replicate', dataHint: 'WAL stream' },
    inbound:  { flowLabel: 'write operation', protocol: 'TCP', connectionType: 'synchronous', role: 'write', dataHint: 'mutation' },
    pattern: 'replication',
    sim: { latencyMs: 5, stateful: true },
  },
  'sync-replica': {
    outbound: { flowLabel: 'ack', protocol: 'TCP', connectionType: 'replication', role: 'replicate', dataHint: 'write acknowledged' },
    inbound:  { flowLabel: 'sync replication', protocol: 'TCP', connectionType: 'replication', role: 'replicate', dataHint: 'sync write' },
    pattern: 'replication',
    sim: { latencyMs: 5, stateful: true },
  },
  'async-replica': {
    outbound: { flowLabel: 'replicated data', protocol: 'TCP', connectionType: 'replication', role: 'replicate', dataHint: 'async WAL apply' },
    inbound:  { flowLabel: 'async replication', protocol: 'TCP', connectionType: 'replication', role: 'replicate', dataHint: 'async WAL' },
    pattern: 'replication',
    sim: { latencyMs: 20, async: true, stateful: true },
  },
  'read-replica-pool': {
    outbound: { flowLabel: 'read result', protocol: 'TCP', connectionType: 'synchronous', role: 'read', dataHint: 'SELECT result' },
    inbound:  { flowLabel: 'read query', protocol: 'TCP', connectionType: 'synchronous', role: 'read', dataHint: 'SELECT query' },
    pattern: 'replication',
    sim: { latencyMs: 10, stateful: true },
  },

  // ─── LOAD BALANCING ────────────────────────────────────────────────────────

  'round-robin-lb': {
    outbound: { flowLabel: 'balanced request', protocol: 'HTTP', connectionType: 'synchronous', role: 'balance', dataHint: 'round-robin forward' },
    inbound:  { flowLabel: 'inbound request', protocol: 'HTTP', connectionType: 'synchronous', role: 'request', dataHint: 'client request' },
    pattern: 'load-balancing',
    sim: { latencyMs: 2, fanout: true },
  },
  'l7-lb': {
    outbound: { flowLabel: 'routed HTTP request', protocol: 'HTTP', connectionType: 'synchronous', role: 'route', dataHint: 'URL-routed request' },
    inbound:  { flowLabel: 'HTTPS request', protocol: 'HTTPS', connectionType: 'synchronous', role: 'request', dataHint: 'client HTTPS' },
    pattern: 'load-balancing',
    sim: { latencyMs: 3, fanout: true },
  },
  'l4-lb': {
    outbound: { flowLabel: 'TCP packet', protocol: 'TCP', connectionType: 'synchronous', role: 'balance', dataHint: 'forwarded TCP' },
    inbound:  { flowLabel: 'TCP connection', protocol: 'TCP', connectionType: 'synchronous', role: 'request', dataHint: 'TCP SYN' },
    pattern: 'load-balancing',
    sim: { latencyMs: 1, fanout: true },
  },
  'client-side-lb': {
    outbound: { flowLabel: 'direct service call', protocol: 'HTTP', connectionType: 'synchronous', role: 'route', dataHint: 'client-picked target' },
    inbound:  { flowLabel: 'service list', protocol: 'HTTP', connectionType: 'synchronous', role: 'lookup', dataHint: 'from registry' },
    pattern: 'load-balancing',
    sim: { latencyMs: 1, fanout: true },
  },

  // ─── CONSISTENCY ───────────────────────────────────────────────────────────

  'distributed-lock': {
    outbound: { flowLabel: 'lock acquired', protocol: 'TCP', connectionType: 'synchronous', role: 'response', dataHint: 'lock token' },
    inbound:  { flowLabel: 'lock request', protocol: 'TCP', connectionType: 'synchronous', role: 'request', dataHint: 'resource key' },
    pattern: 'distributed-locking',
    sim: { latencyMs: 5, stateful: true },
  },
  'raft-consensus': {
    outbound: { flowLabel: 'consensus decision', protocol: 'TCP', connectionType: 'synchronous', role: 'response', dataHint: 'committed value' },
    inbound:  { flowLabel: 'write proposal', protocol: 'TCP', connectionType: 'synchronous', role: 'request', dataHint: 'Raft entry' },
    pattern: 'consensus',
    sim: { latencyMs: 10, stateful: true },
  },
  'zookeeper': {
    outbound: { flowLabel: 'coordination data', protocol: 'TCP', connectionType: 'synchronous', role: 'response', dataHint: 'znode data' },
    inbound:  { flowLabel: 'coordination request', protocol: 'TCP', connectionType: 'synchronous', role: 'request', dataHint: 'znode op' },
    pattern: 'coordination',
    sim: { latencyMs: 3, stateful: true },
  },
  'etcd': {
    outbound: { flowLabel: 'config value', protocol: 'gRPC', connectionType: 'synchronous', role: 'response', dataHint: 'key-value' },
    inbound:  { flowLabel: 'config request', protocol: 'gRPC', connectionType: 'synchronous', role: 'request', dataHint: 'GET /key' },
    pattern: 'coordination',
    sim: { latencyMs: 3, stateful: true },
  },
  'gossip-protocol': {
    outbound: { flowLabel: 'gossip message', protocol: 'UDP', connectionType: 'asynchronous', role: 'emit', dataHint: 'cluster state' },
    inbound:  { flowLabel: 'gossip message', protocol: 'UDP', connectionType: 'asynchronous', role: 'receive', dataHint: 'member state' },
    pattern: 'gossip',
    sim: { latencyMs: 50, async: true },
  },
  'heartbeat-service': {
    outbound: { flowLabel: 'heartbeat', protocol: 'TCP', connectionType: 'asynchronous', role: 'emit', dataHint: 'keepalive ping' },
    inbound:  { flowLabel: 'heartbeat ack', protocol: 'TCP', connectionType: 'asynchronous', role: 'response', dataHint: 'pong' },
    pattern: 'health-checking',
    sim: { latencyMs: 1, async: true },
  },
  'idempotency-store': {
    outbound: { flowLabel: 'idempotency check', protocol: 'TCP', connectionType: 'synchronous', role: 'result', dataHint: 'seen / unseen' },
    inbound:  { flowLabel: 'idempotency key', protocol: 'TCP', connectionType: 'synchronous', role: 'query', dataHint: 'request ID' },
    pattern: 'idempotency',
    sim: { latencyMs: 2, stateful: true },
  },
  '2pc-coordinator': {
    outbound: { flowLabel: 'commit / rollback', protocol: 'TCP', connectionType: 'synchronous', role: 'response', dataHint: 'phase-2 decision' },
    inbound:  { flowLabel: 'prepare request', protocol: 'TCP', connectionType: 'synchronous', role: 'request', dataHint: 'phase-1 prepare' },
    pattern: 'distributed-transaction',
    sim: { latencyMs: 20, stateful: true },
  },
  'vector-clock': {
    outbound: { flowLabel: 'versioned data', protocol: 'TCP', connectionType: 'synchronous', role: 'response', dataHint: '[v1,v2,v3]' },
    inbound:  { flowLabel: 'version check', protocol: 'TCP', connectionType: 'synchronous', role: 'request', dataHint: 'vector timestamp' },
    pattern: 'consistency',
    sim: { latencyMs: 2 },
  },

  // ─── RESILIENCE ────────────────────────────────────────────────────────────

  'circuit-breaker': {
    outbound: { flowLabel: 'guarded request', protocol: 'HTTP', connectionType: 'synchronous', role: 'forward', dataHint: 'circuit open/closed' },
    inbound:  { flowLabel: 'service call', protocol: 'HTTP', connectionType: 'synchronous', role: 'request', dataHint: 'outbound call' },
    pattern: 'resilience',
    sim: { latencyMs: 2 },
  },
  'retry-handler': {
    outbound: { flowLabel: 'retried request', protocol: 'HTTP', connectionType: 'synchronous', role: 'forward', dataHint: 'retry attempt' },
    inbound:  { flowLabel: 'failed call', protocol: 'HTTP', connectionType: 'synchronous', role: 'request', dataHint: 'failed request' },
    pattern: 'resilience',
    sim: { latencyMs: 100 },
  },
  'bulkhead': {
    outbound: { flowLabel: 'isolated request', protocol: 'HTTP', connectionType: 'synchronous', role: 'forward', dataHint: 'bulkhead-isolated' },
    inbound:  { flowLabel: 'service request', protocol: 'HTTP', connectionType: 'synchronous', role: 'request', dataHint: 'service call' },
    pattern: 'resilience',
    sim: { latencyMs: 2 },
  },
  'timeout-handler': {
    outbound: { flowLabel: 'timed call', protocol: 'HTTP', connectionType: 'synchronous', role: 'forward', dataHint: 'deadline-bounded' },
    inbound:  { flowLabel: 'slow call', protocol: 'HTTP', connectionType: 'synchronous', role: 'request', dataHint: 'outbound call' },
    pattern: 'resilience',
    sim: { latencyMs: 5 },
  },
  'fallback-service': {
    outbound: { flowLabel: 'fallback response', protocol: 'HTTP', connectionType: 'synchronous', role: 'response', dataHint: 'degraded response' },
    inbound:  { flowLabel: 'failed primary', protocol: 'HTTP', connectionType: 'synchronous', role: 'receive', dataHint: 'error from primary' },
    pattern: 'resilience',
    sim: { latencyMs: 10 },
  },

  // ─── DB INTERNALS ──────────────────────────────────────────────────────────

  'wal': {
    outbound: { flowLabel: 'WAL record', protocol: 'TCP', connectionType: 'replication', role: 'replicate', dataHint: 'write-ahead entry' },
    inbound:  { flowLabel: 'write operation', protocol: 'TCP', connectionType: 'synchronous', role: 'write', dataHint: 'DB mutation' },
    pattern: 'durability',
    sim: { latencyMs: 1, stateful: true },
  },
  'db-connection-pool': {
    outbound: { flowLabel: 'DB connection', protocol: 'TCP', connectionType: 'synchronous', role: 'connect', dataHint: 'pooled connection' },
    inbound:  { flowLabel: 'connection request', protocol: 'TCP', connectionType: 'synchronous', role: 'request', dataHint: 'connect request' },
    pattern: 'connection-pooling',
    sim: { latencyMs: 1 },
  },
  'db-proxy': {
    outbound: { flowLabel: 'proxied query', protocol: 'TCP', connectionType: 'synchronous', role: 'proxy', dataHint: 'forwarded SQL' },
    inbound:  { flowLabel: 'client query', protocol: 'TCP', connectionType: 'synchronous', role: 'query', dataHint: 'SQL query' },
    pattern: 'proxy',
    sim: { latencyMs: 2 },
  },
  'cdc-stream': {
    outbound: { flowLabel: 'change event', protocol: 'Kafka', connectionType: 'event', role: 'emit', dataHint: 'INSERT/UPDATE/DELETE event' },
    inbound:  { flowLabel: 'DB change', protocol: 'TCP', connectionType: 'synchronous', role: 'receive', dataHint: 'WAL entry' },
    pattern: 'cdc',
    sim: { latencyMs: 30, async: true },
  },
  'materialized-view': {
    outbound: { flowLabel: 'pre-computed data', protocol: 'TCP', connectionType: 'synchronous', role: 'result', dataHint: 'cached query result' },
    inbound:  { flowLabel: 'view query', protocol: 'TCP', connectionType: 'synchronous', role: 'query', dataHint: 'SELECT on view' },
    pattern: 'caching',
    sim: { latencyMs: 3, stateful: true },
  },
  'btree-index': {
    outbound: { flowLabel: 'index lookup', protocol: 'TCP', connectionType: 'synchronous', role: 'result', dataHint: 'row pointer' },
    inbound:  { flowLabel: 'index scan', protocol: 'TCP', connectionType: 'synchronous', role: 'query', dataHint: 'key range' },
    pattern: 'indexing',
    sim: { latencyMs: 1, stateful: true },
  },
  'query-planner': {
    outbound: { flowLabel: 'query plan', protocol: 'TCP', connectionType: 'synchronous', role: 'result', dataHint: 'execution plan' },
    inbound:  { flowLabel: 'SQL query', protocol: 'TCP', connectionType: 'synchronous', role: 'query', dataHint: 'raw SQL' },
    pattern: 'query-optimization',
    sim: { latencyMs: 1 },
  },

  // ─── INFRA / DEVOPS ────────────────────────────────────────────────────────

  'cicd-pipeline': {
    outbound: { flowLabel: 'artifact', protocol: 'HTTPS', connectionType: 'asynchronous', role: 'deploy', dataHint: 'build artifact' },
    inbound:  { flowLabel: 'code push', protocol: 'HTTPS', connectionType: 'asynchronous', role: 'push', dataHint: 'git commit' },
    pattern: 'cicd',
    sim: { latencyMs: 60000, async: true },
  },
  'container-registry': {
    outbound: { flowLabel: 'container image', protocol: 'HTTPS', connectionType: 'synchronous', role: 'retrieve', dataHint: 'docker image' },
    inbound:  { flowLabel: 'image push', protocol: 'HTTPS', connectionType: 'synchronous', role: 'push', dataHint: 'docker push' },
    pattern: 'devops',
    sim: { latencyMs: 5000, async: false, stateful: true },
  },
  'config-server': {
    outbound: { flowLabel: 'config value', protocol: 'HTTP', connectionType: 'synchronous', role: 'retrieve', dataHint: 'env config' },
    inbound:  { flowLabel: 'config request', protocol: 'HTTP', connectionType: 'synchronous', role: 'request', dataHint: 'config key' },
    pattern: 'configuration',
    sim: { latencyMs: 5, stateful: true },
  },
  'feature-flag-service': {
    outbound: { flowLabel: 'flag value', protocol: 'HTTP', connectionType: 'synchronous', role: 'retrieve', dataHint: 'true / false' },
    inbound:  { flowLabel: 'flag check', protocol: 'HTTP', connectionType: 'synchronous', role: 'request', dataHint: 'flag key + context' },
    pattern: 'feature-flags',
    sim: { latencyMs: 5 },
  },
  'artifact-repo': {
    outbound: { flowLabel: 'artifact', protocol: 'HTTPS', connectionType: 'synchronous', role: 'retrieve', dataHint: 'JAR / npm / whl' },
    inbound:  { flowLabel: 'artifact publish', protocol: 'HTTPS', connectionType: 'synchronous', role: 'push', dataHint: 'build artifact' },
    pattern: 'devops',
    sim: { latencyMs: 1000, stateful: true },
  },

  // ─── EXTERNAL ──────────────────────────────────────────────────────────────

  'payment-gateway-ext': {
    outbound: { flowLabel: 'payment result', protocol: 'HTTPS', connectionType: 'synchronous', role: 'response', dataHint: 'charge result' },
    inbound:  { flowLabel: 'payment request', protocol: 'HTTPS', connectionType: 'synchronous', role: 'request', dataHint: 'card + amount' },
    pattern: 'payment',
    sim: { latencyMs: 300 },
  },
  'email-provider': {
    outbound: { flowLabel: 'email sent', protocol: 'HTTPS', connectionType: 'asynchronous', role: 'emit', dataHint: 'email delivery' },
    inbound:  { flowLabel: 'send email', protocol: 'HTTPS', connectionType: 'asynchronous', role: 'request', dataHint: 'to + subject + body' },
    pattern: 'notifications',
    sim: { latencyMs: 500, async: true },
  },
  'sms-provider': {
    outbound: { flowLabel: 'SMS sent', protocol: 'HTTPS', connectionType: 'asynchronous', role: 'emit', dataHint: 'SMS delivery' },
    inbound:  { flowLabel: 'send SMS', protocol: 'HTTPS', connectionType: 'asynchronous', role: 'request', dataHint: 'to + text' },
    pattern: 'notifications',
    sim: { latencyMs: 800, async: true },
  },
  'push-notification-provider': {
    outbound: { flowLabel: 'push notification', protocol: 'HTTPS', connectionType: 'asynchronous', role: 'emit', dataHint: 'push payload' },
    inbound:  { flowLabel: 'notification request', protocol: 'HTTPS', connectionType: 'asynchronous', role: 'request', dataHint: 'device token + msg' },
    pattern: 'notifications',
    sim: { latencyMs: 200, async: true },
  },
  'external-api': {
    outbound: { flowLabel: 'API response', protocol: 'HTTPS', connectionType: 'synchronous', role: 'response', dataHint: 'third-party data' },
    inbound:  { flowLabel: 'API call', protocol: 'HTTPS', connectionType: 'synchronous', role: 'request', dataHint: 'API request' },
    pattern: 'integration',
    sim: { latencyMs: 200 },
  },
  'analytics-service-ext': {
    outbound: { flowLabel: 'analytics event ack', protocol: 'HTTPS', connectionType: 'asynchronous', role: 'response', dataHint: '200 OK' },
    inbound:  { flowLabel: 'analytics event', protocol: 'HTTPS', connectionType: 'asynchronous', role: 'emit', dataHint: 'event payload' },
    pattern: 'analytics',
    sim: { latencyMs: 50, async: true },
  },

  // ─── AWS COMPONENTS ────────────────────────────────────────────────────────

  'aws-ec2': {
    outbound: { flowLabel: 'EC2 response', protocol: 'HTTP', connectionType: 'synchronous', role: 'response', dataHint: 'compute result' },
    inbound:  { flowLabel: 'EC2 request', protocol: 'HTTP', connectionType: 'synchronous', role: 'request', dataHint: 'inbound traffic' },
    pattern: 'compute',
    sim: { latencyMs: 20 },
  },
  'aws-lambda': {
    outbound: { flowLabel: 'Lambda response', protocol: 'HTTPS', connectionType: 'synchronous', role: 'response', dataHint: 'function result' },
    inbound:  { flowLabel: 'Lambda invocation', protocol: 'HTTPS', connectionType: 'synchronous', role: 'request', dataHint: 'event trigger' },
    pattern: 'serverless',
    sim: { latencyMs: 50 },
  },
  'aws-ecs': {
    outbound: { flowLabel: 'container response', protocol: 'HTTP', connectionType: 'synchronous', role: 'response', dataHint: 'service result' },
    inbound:  { flowLabel: 'container request', protocol: 'HTTP', connectionType: 'synchronous', role: 'request', dataHint: 'task request' },
    pattern: 'compute',
    sim: { latencyMs: 20 },
  },
  'aws-eks': {
    outbound: { flowLabel: 'k8s response', protocol: 'HTTP', connectionType: 'synchronous', role: 'route', dataHint: 'pod response' },
    inbound:  { flowLabel: 'k8s request', protocol: 'HTTP', connectionType: 'synchronous', role: 'request', dataHint: 'service request' },
    pattern: 'orchestration',
    sim: { latencyMs: 10 },
  },
  'aws-fargate': {
    outbound: { flowLabel: 'Fargate response', protocol: 'HTTP', connectionType: 'synchronous', role: 'response', dataHint: 'task result' },
    inbound:  { flowLabel: 'Fargate request', protocol: 'HTTP', connectionType: 'synchronous', role: 'request', dataHint: 'container task' },
    pattern: 'serverless',
    sim: { latencyMs: 30 },
  },
  'aws-route53': {
    outbound: { flowLabel: 'DNS record', protocol: 'UDP', connectionType: 'synchronous', role: 'resolve', dataHint: 'A/CNAME record' },
    inbound:  { flowLabel: 'DNS query', protocol: 'UDP', connectionType: 'synchronous', role: 'lookup', dataHint: 'domain lookup' },
    pattern: 'dns-resolution',
    sim: { latencyMs: 5 },
  },
  'aws-cloudfront': {
    outbound: { flowLabel: 'cached content', protocol: 'HTTPS', connectionType: 'synchronous', role: 'response', dataHint: 'CDN edge response' },
    inbound:  { flowLabel: 'CDN request', protocol: 'HTTPS', connectionType: 'synchronous', role: 'request', dataHint: 'GET /asset' },
    pattern: 'caching',
    sim: { latencyMs: 8 },
  },
  'aws-api-gateway': {
    outbound: { flowLabel: 'routed API call', protocol: 'HTTP', connectionType: 'synchronous', role: 'route', dataHint: 'API request' },
    inbound:  { flowLabel: 'API request', protocol: 'HTTPS', connectionType: 'synchronous', role: 'request', dataHint: 'REST call' },
    pattern: 'api-gateway',
    sim: { latencyMs: 5, fanout: true },
  },
  'aws-alb': {
    outbound: { flowLabel: 'routed request', protocol: 'HTTP', connectionType: 'synchronous', role: 'balance', dataHint: 'ALB forward' },
    inbound:  { flowLabel: 'HTTPS request', protocol: 'HTTPS', connectionType: 'synchronous', role: 'request', dataHint: 'client request' },
    pattern: 'load-balancing',
    sim: { latencyMs: 3, fanout: true },
  },
  'aws-nlb': {
    outbound: { flowLabel: 'TCP forward', protocol: 'TCP', connectionType: 'synchronous', role: 'balance', dataHint: 'NLB forward' },
    inbound:  { flowLabel: 'TCP connection', protocol: 'TCP', connectionType: 'synchronous', role: 'request', dataHint: 'TCP SYN' },
    pattern: 'load-balancing',
    sim: { latencyMs: 1, fanout: true },
  },
  'aws-vpc': {
    outbound: { flowLabel: 'VPC traffic', protocol: 'TCP', connectionType: 'synchronous', role: 'route', dataHint: 'private traffic' },
    inbound:  { flowLabel: 'network packet', protocol: 'TCP', connectionType: 'synchronous', role: 'request', dataHint: 'IP packet' },
    pattern: 'network',
    sim: { latencyMs: 0 },
  },
  'aws-nat-gateway': {
    outbound: { flowLabel: 'NAT translated', protocol: 'TCP', connectionType: 'synchronous', role: 'forward', dataHint: 'public IP packet' },
    inbound:  { flowLabel: 'private traffic', protocol: 'TCP', connectionType: 'synchronous', role: 'request', dataHint: 'private IP' },
    pattern: 'network',
    sim: { latencyMs: 1 },
  },
  'aws-s3': {
    outbound: { flowLabel: 'S3 object', protocol: 'HTTPS', connectionType: 'synchronous', role: 'retrieve', dataHint: 'object bytes' },
    inbound:  { flowLabel: 'S3 PUT/GET', protocol: 'HTTPS', connectionType: 'synchronous', role: 'store', dataHint: 'PUT /bucket/key' },
    pattern: 'object-storage',
    sim: { latencyMs: 50, stateful: true },
  },
  'aws-rds': {
    outbound: { flowLabel: 'SQL result', protocol: 'TCP', connectionType: 'synchronous', role: 'result', dataHint: 'row data' },
    inbound:  { flowLabel: 'SQL query', protocol: 'TCP', connectionType: 'synchronous', role: 'query', dataHint: 'SQL statement' },
    pattern: 'rdbms',
    sim: { latencyMs: 10, stateful: true },
  },
  'aws-aurora': {
    outbound: { flowLabel: 'Aurora result', protocol: 'TCP', connectionType: 'synchronous', role: 'result', dataHint: 'query result' },
    inbound:  { flowLabel: 'Aurora query', protocol: 'TCP', connectionType: 'synchronous', role: 'query', dataHint: 'SQL query' },
    pattern: 'rdbms',
    sim: { latencyMs: 5, stateful: true },
  },
  'aws-dynamodb': {
    outbound: { flowLabel: 'DynamoDB item', protocol: 'HTTPS', connectionType: 'synchronous', role: 'result', dataHint: 'item / batch' },
    inbound:  { flowLabel: 'DynamoDB request', protocol: 'HTTPS', connectionType: 'synchronous', role: 'query', dataHint: 'GetItem / PutItem' },
    pattern: 'key-value',
    sim: { latencyMs: 3, stateful: true },
  },
  'aws-elasticache': {
    outbound: { flowLabel: 'cached value', protocol: 'TCP', connectionType: 'synchronous', role: 'cache-read', dataHint: 'Redis/Memcached value' },
    inbound:  { flowLabel: 'cache request', protocol: 'TCP', connectionType: 'synchronous', role: 'cache-write', dataHint: 'GET/SET key' },
    pattern: 'caching',
    sim: { latencyMs: 1, stateful: true },
  },
  'aws-sqs': {
    outbound: { flowLabel: 'SQS message', protocol: 'HTTPS', connectionType: 'asynchronous', role: 'consume', dataHint: 'dequeued message' },
    inbound:  { flowLabel: 'SQS send', protocol: 'HTTPS', connectionType: 'asynchronous', role: 'produce', dataHint: 'SendMessage' },
    pattern: 'message-queue',
    sim: { latencyMs: 10, async: true, ordered: true, stateful: true },
  },
  'aws-sns': {
    outbound: { flowLabel: 'SNS notification', protocol: 'HTTPS', connectionType: 'event', role: 'publish', dataHint: 'fan-out message' },
    inbound:  { flowLabel: 'SNS publish', protocol: 'HTTPS', connectionType: 'event', role: 'produce', dataHint: 'Publish call' },
    pattern: 'pub-sub',
    sim: { latencyMs: 10, async: true, fanout: true },
  },
  'aws-eventbridge': {
    outbound: { flowLabel: 'event', protocol: 'HTTPS', connectionType: 'event', role: 'emit', dataHint: 'matched event' },
    inbound:  { flowLabel: 'event publish', protocol: 'HTTPS', connectionType: 'event', role: 'receive', dataHint: 'PutEvents call' },
    pattern: 'event-driven',
    sim: { latencyMs: 15, async: true, fanout: true },
  },
  'aws-kinesis': {
    outbound: { flowLabel: 'Kinesis record', protocol: 'HTTPS', connectionType: 'event', role: 'consume', dataHint: 'stream record' },
    inbound:  { flowLabel: 'Kinesis put', protocol: 'HTTPS', connectionType: 'event', role: 'produce', dataHint: 'PutRecord' },
    pattern: 'streaming',
    sim: { latencyMs: 70, async: true, ordered: true, stateful: true },
  },
  'aws-msk': {
    outbound: { flowLabel: 'Kafka message', protocol: 'Kafka', connectionType: 'event', role: 'consume', dataHint: 'Kafka record' },
    inbound:  { flowLabel: 'Kafka produce', protocol: 'Kafka', connectionType: 'event', role: 'produce', dataHint: 'producer record' },
    pattern: 'pub-sub',
    sim: { latencyMs: 5, async: true, fanout: true, stateful: true },
  },
  'aws-iam': {
    outbound: { flowLabel: 'IAM decision', protocol: 'HTTPS', connectionType: 'synchronous', role: 'authorize', dataHint: 'allow / deny' },
    inbound:  { flowLabel: 'IAM check', protocol: 'HTTPS', connectionType: 'synchronous', role: 'authorize', dataHint: 'principal + resource' },
    pattern: 'authz',
    sim: { latencyMs: 5 },
  },
  'aws-cognito': {
    outbound: { flowLabel: 'identity token', protocol: 'HTTPS', connectionType: 'synchronous', role: 'token', dataHint: 'JWT / OIDC token' },
    inbound:  { flowLabel: 'auth request', protocol: 'HTTPS', connectionType: 'synchronous', role: 'authenticate', dataHint: 'credentials' },
    pattern: 'auth',
    sim: { latencyMs: 50 },
  },
  'aws-waf': {
    outbound: { flowLabel: 'filtered request', protocol: 'HTTPS', connectionType: 'synchronous', role: 'forward', dataHint: 'allowed request' },
    inbound:  { flowLabel: 'web request', protocol: 'HTTPS', connectionType: 'synchronous', role: 'request', dataHint: 'HTTP request' },
    pattern: 'security',
    sim: { latencyMs: 1 },
  },
  'aws-kms': {
    outbound: { flowLabel: 'encrypted data', protocol: 'HTTPS', connectionType: 'synchronous', role: 'response', dataHint: 'ciphertext' },
    inbound:  { flowLabel: 'encrypt request', protocol: 'HTTPS', connectionType: 'synchronous', role: 'request', dataHint: 'plaintext + key ID' },
    pattern: 'encryption',
    sim: { latencyMs: 10 },
  },
  'aws-opensearch': {
    outbound: { flowLabel: 'search results', protocol: 'HTTP', connectionType: 'synchronous', role: 'result', dataHint: 'search hits' },
    inbound:  { flowLabel: 'search query', protocol: 'HTTP', connectionType: 'synchronous', role: 'query', dataHint: 'DSL query' },
    pattern: 'search',
    sim: { latencyMs: 15, stateful: true },
  },
  'aws-neptune': {
    outbound: { flowLabel: 'graph result', protocol: 'HTTP', connectionType: 'synchronous', role: 'result', dataHint: 'traversal result' },
    inbound:  { flowLabel: 'graph query', protocol: 'HTTP', connectionType: 'synchronous', role: 'query', dataHint: 'Gremlin query' },
    pattern: 'graph',
    sim: { latencyMs: 20, stateful: true },
  },

  // ─── PATTERNS ──────────────────────────────────────────────────────────────

  'monolith': {
    outbound: { flowLabel: 'monolith response', protocol: 'HTTP', connectionType: 'synchronous', role: 'response', dataHint: 'response' },
    inbound:  { flowLabel: 'request', protocol: 'HTTPS', connectionType: 'synchronous', role: 'request', dataHint: 'HTTP request' },
    pattern: 'monolith',
    sim: { latencyMs: 40 },
  },
  'bff-pattern': {
    outbound: { flowLabel: 'BFF response', protocol: 'HTTPS', connectionType: 'synchronous', role: 'response', dataHint: 'tailored response' },
    inbound:  { flowLabel: 'client request', protocol: 'HTTPS', connectionType: 'synchronous', role: 'request', dataHint: 'client-specific request' },
    pattern: 'bff',
    sim: { latencyMs: 15, fanout: true },
  },
  'cqrs-pattern': {
    outbound: { flowLabel: 'command / query', protocol: 'HTTP', connectionType: 'synchronous', role: 'route', dataHint: 'CMD or QRY' },
    inbound:  { flowLabel: 'request', protocol: 'HTTP', connectionType: 'synchronous', role: 'request', dataHint: 'client request' },
    pattern: 'cqrs',
    sim: { latencyMs: 10, fanout: true },
  },
  'saga-orchestrator': {
    outbound: { flowLabel: 'saga step', protocol: 'AMQP', connectionType: 'asynchronous', role: 'emit', dataHint: 'saga command' },
    inbound:  { flowLabel: 'saga trigger', protocol: 'AMQP', connectionType: 'asynchronous', role: 'receive', dataHint: 'saga start event' },
    pattern: 'saga',
    sim: { latencyMs: 30, async: true, fanout: true },
  },
  'etl-pipeline': {
    outbound: { flowLabel: 'transformed data', protocol: 'TCP', connectionType: 'asynchronous', role: 'produce', dataHint: 'ETL output' },
    inbound:  { flowLabel: 'raw data', protocol: 'TCP', connectionType: 'asynchronous', role: 'consume', dataHint: 'source data' },
    pattern: 'etl',
    sim: { latencyMs: 2000, async: true },
  },
  'service-mesh-pattern': {
    outbound: { flowLabel: 'proxied request', protocol: 'gRPC', connectionType: 'synchronous', role: 'proxy', dataHint: 'sidecar forward' },
    inbound:  { flowLabel: 'service request', protocol: 'gRPC', connectionType: 'synchronous', role: 'request', dataHint: 'service call' },
    pattern: 'service-mesh',
    sim: { latencyMs: 5 },
  },
  'data-pipeline-node': {
    outbound: { flowLabel: 'pipeline output', protocol: 'TCP', connectionType: 'asynchronous', role: 'produce', dataHint: 'processed data' },
    inbound:  { flowLabel: 'pipeline input', protocol: 'TCP', connectionType: 'asynchronous', role: 'consume', dataHint: 'raw data' },
    pattern: 'data-pipeline',
    sim: { latencyMs: 500, async: true },
  },
}
