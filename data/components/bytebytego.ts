import type { ArchitectureComponent } from '@/types/architecture'

// ─── ByteByteGo-style components ──────────────────────────────────────────────
// Every component that appears regularly in BBG system design diagrams
// organised by the same visual categories they use.

export const bytebytegoComponents: ArchitectureComponent[] = [

  // ── DB SHARDS (labelled nodes as BBG draws them) ───────────────────────────
  {
    id: 'shard-1', name: 'DB Shard 1', category: 'databases',
    icon: '/components/bytebytego/shard-1.svg',
    description: 'Database shard node #1 — labelled for multi-shard diagrams',
    tags: ['database', 'shard', 'partition', 'shard-1', 'bbg'],
  },
  {
    id: 'shard-2', name: 'DB Shard 2', category: 'databases',
    icon: '/components/bytebytego/shard-2.svg',
    description: 'Database shard node #2',
    tags: ['database', 'shard', 'partition', 'shard-2', 'bbg'],
  },
  {
    id: 'shard-3', name: 'DB Shard 3', category: 'databases',
    icon: '/components/bytebytego/shard-3.svg',
    description: 'Database shard node #3',
    tags: ['database', 'shard', 'partition', 'shard-3', 'bbg'],
  },
  {
    id: 'shard-n', name: 'DB Shard N', category: 'databases',
    icon: '/components/bytebytego/shard-n.svg',
    description: 'Nth database shard — for showing scale-out patterns',
    tags: ['database', 'shard', 'partition', 'shard-n', 'bbg', 'scale'],
  },

  // ── NOSQL VARIANTS ─────────────────────────────────────────────────────────
  {
    id: 'kv-database', name: 'Key-Value DB', category: 'databases',
    icon: '/components/bytebytego/kv-database.svg',
    description: 'Key-value NoSQL database (Redis, DynamoDB, Riak)',
    tags: ['database', 'nosql', 'key-value', 'kv', 'bbg'],
  },
  {
    id: 'document-db', name: 'Document DB', category: 'databases',
    icon: '/components/bytebytego/document-db.svg',
    description: 'Document-oriented NoSQL database (MongoDB, Firestore, CouchDB)',
    tags: ['database', 'nosql', 'document', 'mongodb', 'bbg'],
  },
  {
    id: 'wide-column-db', name: 'Wide-Column DB', category: 'databases',
    icon: '/components/bytebytego/wide-column-db.svg',
    description: 'Wide-column NoSQL database (Cassandra, HBase, BigTable)',
    tags: ['database', 'nosql', 'wide-column', 'cassandra', 'hbase', 'bbg'],
  },
  {
    id: 'graph-db', name: 'Graph DB', category: 'databases',
    icon: '/components/bytebytego/graph-db.svg',
    description: 'Graph database for relationship-heavy data (Neo4j, Neptune)',
    tags: ['database', 'nosql', 'graph', 'neo4j', 'neptune', 'bbg'],
  },

  // ── CACHE VARIANTS ─────────────────────────────────────────────────────────
  {
    id: 'memcached', name: 'Memcached', category: 'caching',
    icon: '/components/bytebytego/memcached.svg',
    description: 'High-performance distributed memory caching system',
    tags: ['cache', 'memcached', 'in-memory', 'bbg'],
  },
  {
    id: 'cache-cluster', name: 'Cache Cluster', category: 'caching',
    icon: '/components/bytebytego/cache-cluster.svg',
    description: 'Multi-node cache cluster (Redis Cluster, Memcached cluster)',
    tags: ['cache', 'cluster', 'distributed', 'redis-cluster', 'bbg'],
  },

  // ── COMPUTE VARIANTS ───────────────────────────────────────────────────────
  {
    id: 'virtual-machine', name: 'Virtual Machine', category: 'compute',
    icon: '/components/bytebytego/virtual-machine.svg',
    description: 'Virtual machine instance (EC2, GCE, Azure VM)',
    tags: ['compute', 'vm', 'virtual-machine', 'ec2', 'bbg'],
  },
  {
    id: 'bare-metal', name: 'Bare Metal Server', category: 'compute',
    icon: '/components/bytebytego/bare-metal.svg',
    description: 'Physical dedicated server with no hypervisor layer',
    tags: ['compute', 'bare-metal', 'physical', 'dedicated', 'bbg'],
  },
  {
    id: 'edge-server', name: 'Edge Server', category: 'compute',
    icon: '/components/bytebytego/edge-server.svg',
    description: 'Edge computing node deployed close to end users',
    tags: ['compute', 'edge', 'cdn', 'pop', 'bbg'],
  },
  {
    id: 'batch-processor-node', name: 'Batch Processor', category: 'compute',
    icon: '/components/bytebytego/batch-processor.svg',
    description: 'Processes large data batches — Spark, Hadoop MapReduce',
    tags: ['compute', 'batch', 'spark', 'hadoop', 'bbg'],
  },
  {
    id: 'websocket-server', name: 'WebSocket Server', category: 'compute',
    icon: '/components/bytebytego/websocket-server.svg',
    description: 'Long-lived bidirectional WebSocket connection server',
    tags: ['compute', 'websocket', 'realtime', 'bidirectional', 'bbg'],
  },
  {
    id: 'grpc-server', name: 'gRPC Server', category: 'compute',
    icon: '/components/bytebytego/grpc-server.svg',
    description: 'High-performance gRPC microservice endpoint',
    tags: ['compute', 'grpc', 'protobuf', 'rpc', 'bbg'],
  },

  // ── NETWORKING ─────────────────────────────────────────────────────────────
  {
    id: 'nat-server', name: 'NAT Server', category: 'networking',
    icon: '/components/bytebytego/nat-server.svg',
    description: 'Network Address Translation — maps private to public IPs',
    tags: ['networking', 'nat', 'private-subnet', 'bbg'],
  },
  {
    id: 'vpn-gateway', name: 'VPN Gateway', category: 'networking',
    icon: '/components/bytebytego/vpn-gateway.svg',
    description: 'VPN gateway for encrypted tunnel between networks',
    tags: ['networking', 'vpn', 'tunnel', 'security', 'bbg'],
  },
  {
    id: 'service-registry', name: 'Service Registry', category: 'networking',
    icon: '/components/bytebytego/service-registry.svg',
    description: 'Tracks live service instances for discovery (Consul, Eureka)',
    tags: ['networking', 'service-registry', 'service-discovery', 'consul', 'bbg'],
  },
  {
    id: 'health-checker', name: 'Health Checker', category: 'networking',
    icon: '/components/bytebytego/health-checker.svg',
    description: 'Continuously probes services and removes unhealthy instances',
    tags: ['networking', 'health-check', 'liveness', 'readiness', 'bbg'],
  },
  {
    id: 'dns-resolver', name: 'DNS Resolver', category: 'networking',
    icon: '/components/bytebytego/dns-resolver.svg',
    description: 'Resolves domain names to IP addresses',
    tags: ['networking', 'dns', 'resolver', 'bbg'],
  },

  // ── DATA PIPELINE ──────────────────────────────────────────────────────────
  {
    id: 'apache-spark', name: 'Apache Spark', category: 'compute',
    icon: '/components/bytebytego/spark.svg',
    description: 'Distributed batch & stream processing engine',
    tags: ['data', 'spark', 'batch', 'distributed', 'bbg'],
  },
  {
    id: 'apache-flink', name: 'Apache Flink', category: 'streaming',
    icon: '/components/bytebytego/flink.svg',
    description: 'Stateful stream processing framework',
    tags: ['streaming', 'flink', 'real-time', 'stateful', 'bbg'],
  },
  {
    id: 'hdfs', name: 'HDFS', category: 'storage',
    icon: '/components/bytebytego/hdfs.svg',
    description: 'Hadoop Distributed File System — large-scale batch storage',
    tags: ['storage', 'hdfs', 'hadoop', 'distributed-fs', 'bbg'],
  },
  {
    id: 'data-pipeline-node', name: 'Data Pipeline', category: 'patterns',
    icon: '/components/bytebytego/data-pipeline.svg',
    description: 'Generic data pipeline — ingest → transform → load',
    tags: ['patterns', 'pipeline', 'etl', 'data', 'bbg'],
  },

  // ── COORDINATION ───────────────────────────────────────────────────────────
  {
    id: 'zookeeper', name: 'ZooKeeper', category: 'consistency',
    icon: '/components/bytebytego/zookeeper.svg',
    description: 'Distributed coordination service — leader election, config, locks',
    tags: ['consistency', 'zookeeper', 'coordination', 'election', 'bbg'],
  },
  {
    id: 'etcd', name: 'etcd', category: 'consistency',
    icon: '/components/bytebytego/etcd.svg',
    description: 'Strongly consistent distributed key-value store (used by k8s)',
    tags: ['consistency', 'etcd', 'k8s', 'config', 'raft', 'bbg'],
  },

  // ── MESSAGING VARIANTS ─────────────────────────────────────────────────────
  {
    id: 'delay-queue', name: 'Delay Queue', category: 'messaging',
    icon: '/components/bytebytego/delay-queue.svg',
    description: 'Queue that holds messages until a specified delay has elapsed',
    tags: ['messaging', 'queue', 'delay', 'scheduled', 'bbg'],
  },
  {
    id: 'fifo-queue', name: 'FIFO Queue', category: 'messaging',
    icon: '/components/bytebytego/fifo-queue.svg',
    description: 'Strictly ordered first-in-first-out message queue',
    tags: ['messaging', 'fifo', 'ordered', 'queue', 'bbg'],
  },
  {
    id: 'fanout', name: 'Fanout / Exchange', category: 'messaging',
    icon: '/components/bytebytego/fanout.svg',
    description: 'Broadcasts a message to all bound queues/subscribers',
    tags: ['messaging', 'fanout', 'pubsub', 'broadcast', 'rabbitmq', 'bbg'],
  },

  // ── SERVICES ───────────────────────────────────────────────────────────────
  {
    id: 'video-service', name: 'Video Service', category: 'services',
    icon: '/components/bytebytego/video-service.svg',
    description: 'Video streaming and delivery service',
    tags: ['service', 'video', 'streaming', 'media', 'bbg'],
  },
  {
    id: 'file-service-node', name: 'File Service', category: 'services',
    icon: '/components/bytebytego/file-service.svg',
    description: 'Handles file upload, download, and metadata',
    tags: ['service', 'file', 'upload', 'download', 'bbg'],
  },
  {
    id: 'recommendation-engine', name: 'Recommendation Engine', category: 'services',
    icon: '/components/bytebytego/recommendation-engine.svg',
    description: 'ML-based recommendation engine (collaborative/content filtering)',
    tags: ['service', 'recommendation', 'ml', 'personalisation', 'bbg'],
  },
  {
    id: 'reporting-service', name: 'Reporting Service', category: 'services',
    icon: '/components/bytebytego/reporting-service.svg',
    description: 'Generates analytics reports and dashboards',
    tags: ['service', 'reporting', 'analytics', 'bi', 'bbg'],
  },
  {
    id: 'media-service', name: 'Media Service', category: 'services',
    icon: '/components/bytebytego/media-service.svg',
    description: 'Handles media assets — images, video, audio',
    tags: ['service', 'media', 'image', 'video', 'bbg'],
  },
  {
    id: 'transcoding-service', name: 'Transcoding Service', category: 'services',
    icon: '/components/bytebytego/transcoding-service.svg',
    description: 'Converts video/audio between formats (MP4→HLS, 4K→1080p)',
    tags: ['service', 'transcoding', 'video', 'encoding', 'ffmpeg', 'bbg'],
  },

  // ── STORAGE VARIANTS ───────────────────────────────────────────────────────
  {
    id: 'blob-store', name: 'Blob Store', category: 'storage',
    icon: '/components/bytebytego/blob-store.svg',
    description: 'Binary large object store — images, videos, backups (S3, GCS)',
    tags: ['storage', 'blob', 's3', 'gcs', 'object', 'bbg'],
  },
  {
    id: 'cold-storage', name: 'Cold Storage', category: 'storage',
    icon: '/components/bytebytego/cold-storage.svg',
    description: 'Low-cost archival storage for infrequent access (Glacier, Nearline)',
    tags: ['storage', 'cold', 'archive', 'glacier', 'bbg'],
  },
  {
    id: 'log-store', name: 'Log Store', category: 'storage',
    icon: '/components/bytebytego/log-store.svg',
    description: 'Append-only log storage for audit trails and event sourcing',
    tags: ['storage', 'log', 'append-only', 'audit', 'bbg'],
  },

  // ── AUTH & SECURITY ────────────────────────────────────────────────────────
  {
    id: 'oauth-server', name: 'OAuth Server', category: 'security',
    icon: '/components/bytebytego/oauth-server.svg',
    description: 'OAuth 2.0 / OpenID Connect authorization server',
    tags: ['security', 'oauth', 'oidc', 'auth', 'identity', 'bbg'],
  },
  {
    id: 'jwt-store', name: 'JWT Token Store', category: 'security',
    icon: '/components/bytebytego/jwt-store.svg',
    description: 'Issues and validates JSON Web Tokens',
    tags: ['security', 'jwt', 'token', 'auth', 'bbg'],
  },
  {
    id: 'api-key-store', name: 'API Key Store', category: 'security',
    icon: '/components/bytebytego/api-key-store.svg',
    description: 'Manages API keys — issuance, rotation, revocation',
    tags: ['security', 'api-key', 'credentials', 'bbg'],
  },
  {
    id: 'tls-termination', name: 'TLS Termination', category: 'security',
    icon: '/components/bytebytego/tls-termination.svg',
    description: 'Terminates TLS/SSL at the proxy layer, decrypts traffic',
    tags: ['security', 'tls', 'ssl', 'termination', 'certificate', 'bbg'],
  },

  // ── OBSERVABILITY ──────────────────────────────────────────────────────────
  {
    id: 'error-tracker', name: 'Error Tracker', category: 'observability',
    icon: '/components/bytebytego/error-tracker.svg',
    description: 'Captures and groups application errors (Sentry, Rollbar, Bugsnag)',
    tags: ['observability', 'error', 'sentry', 'exception', 'bbg'],
  },
  {
    id: 'audit-log', name: 'Audit Log', category: 'observability',
    icon: '/components/bytebytego/audit-log.svg',
    description: 'Immutable log of who did what and when — compliance & forensics',
    tags: ['observability', 'audit', 'compliance', 'immutable', 'bbg'],
  },
  {
    id: 'sla-monitor', name: 'SLA Monitor', category: 'observability',
    icon: '/components/bytebytego/sla-monitor.svg',
    description: 'Tracks uptime and latency against SLA targets',
    tags: ['observability', 'sla', 'uptime', 'latency', 'reliability', 'bbg'],
  },

  // ── API PATTERNS ───────────────────────────────────────────────────────────
  {
    id: 'graphql-server', name: 'GraphQL Server', category: 'networking',
    icon: '/components/bytebytego/graphql-server.svg',
    description: 'GraphQL query / mutation endpoint',
    tags: ['networking', 'graphql', 'api', 'query', 'bbg'],
  },
  {
    id: 'rest-api-node', name: 'REST API', category: 'networking',
    icon: '/components/bytebytego/rest-api.svg',
    description: 'RESTful HTTP API — GET / POST / PUT / DELETE / PATCH',
    tags: ['networking', 'rest', 'api', 'http', 'bbg'],
  },
  {
    id: 'api-versioning', name: 'API Versioning', category: 'networking',
    icon: '/components/bytebytego/api-versioning.svg',
    description: 'Shows multiple API versions (/v1, /v2, /v3) in parallel',
    tags: ['networking', 'api', 'versioning', 'v1', 'v2', 'bbg'],
  },
]
