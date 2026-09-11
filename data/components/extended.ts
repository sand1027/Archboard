import type { ArchitectureComponent } from '@/types/architecture'

// ─── SHARDING ─────────────────────────────────────────────────────────────────
export const shardingComponents: ArchitectureComponent[] = [
  { id: 'range-shard', name: 'Range Shard', category: 'sharding', icon: '/components/sharding/range-shard.svg', description: 'Range-based sharding — data split by key range (A-F, G-M…)', tags: ['sharding', 'range', 'partition', 'horizontal-scaling'] },
  { id: 'hash-shard', name: 'Hash Shard', category: 'sharding', icon: '/components/sharding/hash-shard.svg', description: 'Hash-based sharding — hash function distributes rows evenly', tags: ['sharding', 'hash', 'partition', 'mod'] },
  { id: 'consistent-hash', name: 'Consistent Hash Ring', category: 'sharding', icon: '/components/sharding/consistent-hash.svg', description: 'Consistent hashing ring for elastic, minimal-rebalance sharding', tags: ['sharding', 'consistent-hashing', 'ring', 'dynamo'] },
  { id: 'directory-shard', name: 'Directory Shard', category: 'sharding', icon: '/components/sharding/directory-shard.svg', description: 'Directory/lookup-service based sharding — explicit key→shard map', tags: ['sharding', 'directory', 'lookup', 'mapping'] },
  { id: 'geo-shard', name: 'Geo Shard', category: 'sharding', icon: '/components/sharding/geo-shard.svg', description: 'Geographic/regional sharding — data co-located by region', tags: ['sharding', 'geo', 'regional', 'latency'] },
  { id: 'shard-coordinator', name: 'Shard Coordinator', category: 'sharding', icon: '/components/sharding/shard-coordinator.svg', description: 'Routes requests to the correct shard', tags: ['sharding', 'coordinator', 'router', 'proxy'] },
  { id: 'shard-manager', name: 'Shard Manager', category: 'sharding', icon: '/components/sharding/shard-manager.svg', description: 'Manages shard metadata, rebalancing, and migrations', tags: ['sharding', 'manager', 'rebalancer', 'metadata'] },
  { id: 'hot-shard', name: 'Hot Shard', category: 'sharding', icon: '/components/sharding/hot-shard.svg', description: 'Overloaded shard receiving disproportionate traffic', tags: ['sharding', 'hot-spot', 'bottleneck', 'problem'] },
  { id: 'resharding-job', name: 'Resharding Job', category: 'sharding', icon: '/components/sharding/resharding-job.svg', description: 'Background job that migrates data during reshard', tags: ['sharding', 'resharding', 'migration', 'rebalance'] },
  { id: 'virtual-shard', name: 'Virtual Shard', category: 'sharding', icon: '/components/sharding/virtual-shard.svg', description: 'Virtual (logical) shards for elastic rebalancing without data moves', tags: ['sharding', 'virtual', 'logical', 'elastic'] },
  { id: 'tenant-shard', name: 'Tenant Shard', category: 'sharding', icon: '/components/sharding/tenant-shard.svg', description: 'Multi-tenant sharding — one shard per tenant or tenant group', tags: ['sharding', 'multi-tenant', 'saas', 'tenant'] },
  { id: 'composite-shard', name: 'Composite Shard', category: 'sharding', icon: '/components/sharding/composite-shard.svg', description: 'Composite/hybrid sharding strategy (e.g. hash + range)', tags: ['sharding', 'composite', 'hybrid', 'multi-key'] },
]

// ─── RATE LIMITING ────────────────────────────────────────────────────────────
export const rateLimitingComponents: ArchitectureComponent[] = [
  { id: 'token-bucket', name: 'Token Bucket', category: 'rate-limiting', icon: '/components/rate-limiting/token-bucket.svg', description: 'Token bucket rate limiter — bursts allowed up to bucket size', tags: ['rate-limiting', 'token-bucket', 'burst', 'algorithm'] },
  { id: 'leaky-bucket', name: 'Leaky Bucket', category: 'rate-limiting', icon: '/components/rate-limiting/leaky-bucket.svg', description: 'Leaky bucket — smooths output at constant rate regardless of input', tags: ['rate-limiting', 'leaky-bucket', 'smoothing', 'algorithm'] },
  { id: 'fixed-window', name: 'Fixed Window Counter', category: 'rate-limiting', icon: '/components/rate-limiting/fixed-window.svg', description: 'Fixed window counter — count resets at each time window boundary', tags: ['rate-limiting', 'fixed-window', 'counter', 'algorithm'] },
  { id: 'sliding-window', name: 'Sliding Window Counter', category: 'rate-limiting', icon: '/components/rate-limiting/sliding-window.svg', description: 'Sliding window counter — blends current and previous windows', tags: ['rate-limiting', 'sliding-window', 'counter', 'algorithm'] },
  { id: 'sliding-log', name: 'Sliding Window Log', category: 'rate-limiting', icon: '/components/rate-limiting/sliding-log.svg', description: 'Sliding window log — tracks exact timestamps, most accurate', tags: ['rate-limiting', 'sliding-log', 'timestamps', 'algorithm'] },
  { id: 'concurrent-limiter', name: 'Concurrent Request Limiter', category: 'rate-limiting', icon: '/components/rate-limiting/concurrent-limiter.svg', description: 'Semaphore-based concurrency limiter — caps in-flight requests', tags: ['rate-limiting', 'concurrent', 'semaphore', 'bulkhead'] },
  { id: 'adaptive-limiter', name: 'Adaptive Rate Limiter', category: 'rate-limiting', icon: '/components/rate-limiting/adaptive-limiter.svg', description: 'Dynamic rate limiter that adjusts based on system load', tags: ['rate-limiting', 'adaptive', 'dynamic', 'auto-throttle'] },
  { id: 'global-rate-limiter', name: 'Global Rate Limiter', category: 'rate-limiting', icon: '/components/rate-limiting/global-rate-limiter.svg', description: 'Distributed global rate limiter (e.g. Redis-backed across nodes)', tags: ['rate-limiting', 'global', 'distributed', 'redis'] },
  { id: 'quota-manager', name: 'Quota Manager', category: 'rate-limiting', icon: '/components/rate-limiting/quota-manager.svg', description: 'Daily/monthly quota management — separate from burst limiting', tags: ['rate-limiting', 'quota', 'daily', 'monthly', 'billing'] },
  { id: 'throttle-queue', name: 'Throttling Queue', category: 'rate-limiting', icon: '/components/rate-limiting/throttle-queue.svg', description: 'Delays excess requests instead of rejecting them', tags: ['rate-limiting', 'throttle', 'queue', 'delay'] },
  { id: 'per-user-limiter', name: 'Per-User Rate Limiter', category: 'rate-limiting', icon: '/components/rate-limiting/per-user-limiter.svg', description: 'Rate limiting scoped per authenticated user', tags: ['rate-limiting', 'per-user', 'user-scoped'] },
  { id: 'per-ip-limiter', name: 'Per-IP Rate Limiter', category: 'rate-limiting', icon: '/components/rate-limiting/per-ip-limiter.svg', description: 'Rate limiting scoped per client IP address', tags: ['rate-limiting', 'per-ip', 'ip-scoped', 'ddos'] },
]

// ─── CACHING PATTERNS ─────────────────────────────────────────────────────────
export const cachingPatternComponents: ArchitectureComponent[] = [
  { id: 'write-through-cache', name: 'Write-Through Cache', category: 'caching-patterns', icon: '/components/caching-patterns/write-through.svg', description: 'Write goes to cache and DB simultaneously — strong consistency', tags: ['caching', 'write-through', 'consistency', 'pattern'] },
  { id: 'write-back-cache', name: 'Write-Back Cache', category: 'caching-patterns', icon: '/components/caching-patterns/write-back.svg', description: 'Write to cache first, async flush to DB — high write throughput', tags: ['caching', 'write-back', 'write-behind', 'async', 'pattern'] },
  { id: 'write-around-cache', name: 'Write-Around Cache', category: 'caching-patterns', icon: '/components/caching-patterns/write-around.svg', description: 'Write goes directly to DB, bypassing cache — avoids cache pollution', tags: ['caching', 'write-around', 'pattern'] },
  { id: 'cache-aside-pattern', name: 'Cache-Aside (Lazy)', category: 'caching-patterns', icon: '/components/caching-patterns/cache-aside.svg', description: 'App checks cache first; on miss loads from DB and populates cache', tags: ['caching', 'cache-aside', 'lazy-loading', 'pattern'] },
  { id: 'cache-invalidation', name: 'Cache Invalidation', category: 'caching-patterns', icon: '/components/caching-patterns/cache-invalidation.svg', description: 'Service that invalidates cache entries on data changes', tags: ['caching', 'invalidation', 'ttl', 'eviction'] },
  { id: 'cache-warming', name: 'Cache Warming', category: 'caching-patterns', icon: '/components/caching-patterns/cache-warming.svg', description: 'Pre-populates cache before traffic hits — avoids cold-start misses', tags: ['caching', 'warming', 'pre-load', 'cold-start'] },
  { id: 'cdn-cache', name: 'CDN Edge Cache', category: 'caching-patterns', icon: '/components/caching-patterns/cdn-cache.svg', description: 'CDN edge node cache for static and dynamic content', tags: ['caching', 'cdn', 'edge', 'static'] },
  { id: 'distributed-cache-cluster', name: 'Distributed Cache Cluster', category: 'caching-patterns', icon: '/components/caching-patterns/distributed-cache.svg', description: 'Multi-node distributed cache cluster (e.g. Redis Cluster)', tags: ['caching', 'distributed', 'cluster', 'redis'] },
  { id: 'local-process-cache', name: 'Local / In-Process Cache', category: 'caching-patterns', icon: '/components/caching-patterns/local-cache.svg', description: 'In-process memory cache within the application (e.g. Caffeine)', tags: ['caching', 'local', 'in-process', 'l1'] },
]

// ─── REPLICATION ──────────────────────────────────────────────────────────────
export const replicationComponents: ArchitectureComponent[] = [
  { id: 'leader-follower-repl', name: 'Leader-Follower', category: 'replication', icon: '/components/replication/leader-follower.svg', description: 'Primary-replica replication — one writable leader, N read replicas', tags: ['replication', 'leader', 'follower', 'primary', 'replica'] },
  { id: 'multi-leader-repl', name: 'Multi-Leader', category: 'replication', icon: '/components/replication/multi-leader.svg', description: 'Multiple writable leaders — high availability with conflict resolution', tags: ['replication', 'multi-leader', 'active-active', 'conflict'] },
  { id: 'leaderless-repl', name: 'Leaderless (Quorum)', category: 'replication', icon: '/components/replication/leaderless.svg', description: 'Leaderless / quorum-based replication (Dynamo, Cassandra style)', tags: ['replication', 'leaderless', 'quorum', 'dynamo', 'cassandra'] },
  { id: 'sync-replica', name: 'Synchronous Replica', category: 'replication', icon: '/components/replication/sync-replica.svg', description: 'Replica that must acknowledge write before leader confirms', tags: ['replication', 'synchronous', 'strong-consistency', 'durability'] },
  { id: 'async-replica', name: 'Asynchronous Replica', category: 'replication', icon: '/components/replication/async-replica.svg', description: 'Replica that receives updates asynchronously — eventual consistency', tags: ['replication', 'asynchronous', 'eventual-consistency', 'lag'] },
  { id: 'cross-region-repl', name: 'Cross-Region Replica', category: 'replication', icon: '/components/replication/cross-region-replica.svg', description: 'Replica in a different geographic region for DR / latency', tags: ['replication', 'cross-region', 'geo', 'disaster-recovery'] },
  { id: 'read-replica-pool', name: 'Read Replica Pool', category: 'replication', icon: '/components/replication/read-replica-pool.svg', description: 'Pool of read replicas for horizontal read scaling', tags: ['replication', 'read-replicas', 'pool', 'read-scaling'] },
]

// ─── LOAD BALANCING ───────────────────────────────────────────────────────────
export const loadBalancingComponents: ArchitectureComponent[] = [
  { id: 'round-robin-lb', name: 'Round Robin LB', category: 'load-balancing', icon: '/components/load-balancing/round-robin.svg', description: 'Round-robin load balancing — requests cycled evenly across servers', tags: ['load-balancing', 'round-robin', 'algorithm'] },
  { id: 'weighted-rr-lb', name: 'Weighted Round Robin', category: 'load-balancing', icon: '/components/load-balancing/weighted-rr.svg', description: 'Weighted round-robin — higher-capacity servers get proportionally more traffic', tags: ['load-balancing', 'weighted', 'round-robin', 'capacity'] },
  { id: 'least-connections-lb', name: 'Least Connections', category: 'load-balancing', icon: '/components/load-balancing/least-connections.svg', description: 'Routes to server with fewest active connections', tags: ['load-balancing', 'least-connections', 'active', 'algorithm'] },
  { id: 'ip-hash-lb', name: 'IP Hash LB', category: 'load-balancing', icon: '/components/load-balancing/ip-hash.svg', description: 'IP hash LB — same client IP always routes to the same server (sticky)', tags: ['load-balancing', 'ip-hash', 'sticky', 'session'] },
  { id: 'l4-lb', name: 'Layer 4 LB (TCP/UDP)', category: 'load-balancing', icon: '/components/load-balancing/l4-lb.svg', description: 'Transport-layer load balancer — fast, low-overhead, no content inspection', tags: ['load-balancing', 'l4', 'tcp', 'udp', 'transport'] },
  { id: 'l7-lb', name: 'Layer 7 LB (HTTP)', category: 'load-balancing', icon: '/components/load-balancing/l7-lb.svg', description: 'Application-layer load balancer — URL/header-aware routing', tags: ['load-balancing', 'l7', 'http', 'application', 'content-based'] },
  { id: 'gslb', name: 'Global Server LB (GSLB)', category: 'load-balancing', icon: '/components/load-balancing/gslb.svg', description: 'Global load balancer — routes to closest/healthiest data center', tags: ['load-balancing', 'gslb', 'global', 'anycast', 'geo'] },
  { id: 'dns-lb', name: 'DNS-Based LB', category: 'load-balancing', icon: '/components/load-balancing/dns-lb.svg', description: 'DNS round-robin or geo/latency-based routing', tags: ['load-balancing', 'dns', 'route53', 'geo-routing'] },
  { id: 'client-side-lb', name: 'Client-Side LB', category: 'load-balancing', icon: '/components/load-balancing/client-side-lb.svg', description: 'Client-side load balancing — client picks server from registry (Ribbon)', tags: ['load-balancing', 'client-side', 'ribbon', 'service-discovery'] },
]

// ─── STREAMING / MESSAGING (deep) ─────────────────────────────────────────────
export const streamingComponents: ArchitectureComponent[] = [
  { id: 'partitioned-topic', name: 'Partitioned Topic', category: 'streaming', icon: '/components/streaming/partitioned-topic.svg', description: 'Kafka-style partitioned topic for parallel, ordered consumption', tags: ['streaming', 'kafka', 'partition', 'topic', 'ordered'] },
  { id: 'consumer-group', name: 'Consumer Group', category: 'streaming', icon: '/components/streaming/consumer-group.svg', description: 'Group of consumers sharing topic partitions for parallel processing', tags: ['streaming', 'consumer-group', 'kafka', 'parallel'] },
  { id: 'dlq', name: 'Dead-Letter Queue', category: 'streaming', icon: '/components/streaming/dead-letter-queue.svg', description: 'Holds messages that failed processing after max retries', tags: ['streaming', 'dlq', 'dead-letter', 'error-handling'] },
  { id: 'priority-queue', name: 'Priority Queue', category: 'streaming', icon: '/components/streaming/priority-queue.svg', description: 'Message queue with priority levels — high-priority messages processed first', tags: ['streaming', 'priority', 'queue', 'ordering'] },
  { id: 'backpressure', name: 'Backpressure Handler', category: 'streaming', icon: '/components/streaming/backpressure.svg', description: 'Signals producer to slow down when consumer is overwhelmed', tags: ['streaming', 'backpressure', 'flow-control', 'reactive'] },
  { id: 'stream-processor', name: 'Stream Processor', category: 'streaming', icon: '/components/streaming/stream-processor.svg', description: 'Real-time stream processing (Kafka Streams, Flink, Spark Streaming)', tags: ['streaming', 'flink', 'stream-processing', 'real-time'] },
  { id: 'webhook', name: 'Webhook', category: 'streaming', icon: '/components/streaming/webhook.svg', description: 'HTTP callback triggered by events in an external system', tags: ['streaming', 'webhook', 'http-callback', 'events'] },
]

// ─── CONSISTENCY / COORDINATION ───────────────────────────────────────────────
export const consistencyComponents: ArchitectureComponent[] = [
  { id: 'distributed-lock', name: 'Distributed Lock', category: 'consistency', icon: '/components/consistency/distributed-lock.svg', description: 'Distributed mutex to prevent concurrent access across nodes', tags: ['consistency', 'lock', 'mutex', 'zookeeper', 'redis'] },
  { id: 'leader-election', name: 'Leader Election', category: 'consistency', icon: '/components/consistency/leader-election.svg', description: 'Automatically elects a leader node for coordination', tags: ['consistency', 'leader-election', 'zookeeper', 'etcd'] },
  { id: 'raft-consensus', name: 'Consensus (Raft)', category: 'consistency', icon: '/components/consistency/consensus-raft.svg', description: 'Raft/Paxos consensus module for strongly-consistent distributed decisions', tags: ['consistency', 'raft', 'paxos', 'consensus', 'etcd'] },
  { id: 'vector-clock', name: 'Vector Clock', category: 'consistency', icon: '/components/consistency/vector-clock.svg', description: 'Logical clock for ordering events in distributed systems', tags: ['consistency', 'vector-clock', 'causality', 'ordering'] },
  { id: '2pc-coordinator', name: '2PC Coordinator', category: 'consistency', icon: '/components/consistency/2pc-coordinator.svg', description: 'Two-phase commit coordinator for distributed transactions', tags: ['consistency', '2pc', 'distributed-transaction', 'acid'] },
  { id: 'idempotency-store', name: 'Idempotency Key Store', category: 'consistency', icon: '/components/consistency/idempotency-store.svg', description: 'Tracks processed request IDs to safely replay without double-processing', tags: ['consistency', 'idempotency', 'exactly-once', 'deduplication'] },
  { id: 'gossip-protocol', name: 'Gossip Protocol Node', category: 'consistency', icon: '/components/consistency/gossip-protocol.svg', description: 'Peer-to-peer epidemic protocol for cluster state propagation', tags: ['consistency', 'gossip', 'p2p', 'cassandra', 'memberlist'] },
  { id: 'heartbeat-service', name: 'Heartbeat / Health Check', category: 'consistency', icon: '/components/consistency/heartbeat.svg', description: 'Periodic health signals used for failure detection and liveness', tags: ['consistency', 'heartbeat', 'health-check', 'failure-detection'] },
]

// ─── RESILIENCE PATTERNS ──────────────────────────────────────────────────────
export const resilienceComponents: ArchitectureComponent[] = [
  { id: 'circuit-breaker', name: 'Circuit Breaker', category: 'resilience', icon: '/components/resilience/circuit-breaker.svg', description: 'Stops calls to a failing service and fails fast until it recovers', tags: ['resilience', 'circuit-breaker', 'hystrix', 'fault-tolerance'] },
  { id: 'retry-handler', name: 'Retry Handler', category: 'resilience', icon: '/components/resilience/retry-handler.svg', description: 'Retries failed operations with exponential backoff and jitter', tags: ['resilience', 'retry', 'backoff', 'exponential', 'jitter'] },
  { id: 'bulkhead', name: 'Bulkhead Isolation', category: 'resilience', icon: '/components/resilience/bulkhead.svg', description: 'Isolates resource pools so failures in one don\'t cascade', tags: ['resilience', 'bulkhead', 'isolation', 'thread-pool'] },
  { id: 'timeout-handler', name: 'Timeout Handler', category: 'resilience', icon: '/components/resilience/timeout-handler.svg', description: 'Enforces deadlines on operations to prevent indefinite blocking', tags: ['resilience', 'timeout', 'deadline', 'sla'] },
  { id: 'fallback-service', name: 'Fallback Service', category: 'resilience', icon: '/components/resilience/fallback-service.svg', description: 'Provides degraded response when primary service is unavailable', tags: ['resilience', 'fallback', 'degraded', 'graceful-degradation'] },
]

// ─── DATABASE INTERNALS ───────────────────────────────────────────────────────
export const dbInternalsComponents: ArchitectureComponent[] = [
  { id: 'wal', name: 'Write-Ahead Log (WAL)', category: 'db-internals', icon: '/components/db-internals/wal.svg', description: 'Append-only durability log written before actual data pages', tags: ['db-internals', 'wal', 'durability', 'recovery', 'postgres'] },
  { id: 'db-connection-pool', name: 'Connection Pool', category: 'db-internals', icon: '/components/db-internals/connection-pool.svg', description: 'Reusable pool of database connections to reduce overhead', tags: ['db-internals', 'connection-pool', 'pgbouncer', 'proxysql'] },
  { id: 'query-planner', name: 'Query Planner / Optimizer', category: 'db-internals', icon: '/components/db-internals/query-planner.svg', description: 'Generates and selects the optimal query execution plan', tags: ['db-internals', 'query-planner', 'optimizer', 'explain'] },
  { id: 'btree-index', name: 'B-Tree Index', category: 'db-internals', icon: '/components/db-internals/btree-index.svg', description: 'Balanced tree index structure for efficient range and point queries', tags: ['db-internals', 'btree', 'index', 'b+tree'] },
  { id: 'materialized-view', name: 'Materialized View', category: 'db-internals', icon: '/components/db-internals/materialized-view.svg', description: 'Pre-computed query result stored as a table for fast reads', tags: ['db-internals', 'materialized-view', 'denormalization', 'cache'] },
  { id: 'cdc-stream', name: 'CDC Stream', category: 'db-internals', icon: '/components/db-internals/cdc-stream.svg', description: 'Change Data Capture — streams DB mutations as an event log', tags: ['db-internals', 'cdc', 'debezium', 'change-data-capture'] },
  { id: 'db-proxy', name: 'Database Proxy', category: 'db-internals', icon: '/components/db-internals/db-proxy.svg', description: 'Sits between app and DB — connection pooling, query routing', tags: ['db-internals', 'proxy', 'proxysql', 'pgbouncer', 'rds-proxy'] },
  { id: 'time-series-db', name: 'Time-Series DB', category: 'db-internals', icon: '/components/db-internals/time-series-db.svg', description: 'Optimised for time-stamped metrics (InfluxDB, TimescaleDB, Prometheus)', tags: ['db-internals', 'time-series', 'influxdb', 'timescale', 'metrics'] },
  { id: 'vector-db', name: 'Vector Database', category: 'db-internals', icon: '/components/db-internals/vector-db.svg', description: 'Stores and queries high-dimensional embeddings (Pinecone, Weaviate)', tags: ['db-internals', 'vector-db', 'embeddings', 'ai', 'pinecone', 'weaviate'] },
  { id: 'search-index-db', name: 'Search Index', category: 'db-internals', icon: '/components/db-internals/search-index.svg', description: 'Inverted index for full-text and faceted search (Elasticsearch, OpenSearch)', tags: ['db-internals', 'search', 'elasticsearch', 'inverted-index'] },
]

// ─── INFRA / DEVOPS ───────────────────────────────────────────────────────────
export const infraDevopsComponents: ArchitectureComponent[] = [
  { id: 'cicd-pipeline', name: 'CI/CD Pipeline', category: 'infra-devops', icon: '/components/infra-devops/cicd-pipeline.svg', description: 'Automated build, test and deploy pipeline', tags: ['infra', 'cicd', 'pipeline', 'github-actions', 'jenkins'] },
  { id: 'container-registry', name: 'Container Registry', category: 'infra-devops', icon: '/components/infra-devops/container-registry.svg', description: 'Stores and distributes container images (ECR, GCR, Docker Hub)', tags: ['infra', 'container-registry', 'docker', 'ecr', 'gcr'] },
  { id: 'config-server', name: 'Config Server', category: 'infra-devops', icon: '/components/infra-devops/config-server.svg', description: 'Centralised configuration store (Consul, etcd, AWS Parameter Store)', tags: ['infra', 'config', 'consul', 'etcd', 'parameter-store'] },
  { id: 'feature-flag-service', name: 'Feature Flag Service', category: 'infra-devops', icon: '/components/infra-devops/feature-flag.svg', description: 'Runtime feature toggle service (LaunchDarkly, Unleash)', tags: ['infra', 'feature-flags', 'launchdarkly', 'toggles'] },
  { id: 'artifact-repo', name: 'Artifact Repository', category: 'infra-devops', icon: '/components/infra-devops/artifact-repo.svg', description: 'Stores build artifacts, packages, and binaries (Nexus, JFrog)', tags: ['infra', 'artifact', 'nexus', 'jfrog', 'packages'] },
]

// ─── EXTERNAL / THIRD-PARTY ───────────────────────────────────────────────────
export const externalComponents: ArchitectureComponent[] = [
  { id: 'payment-gateway-ext', name: 'Payment Gateway', category: 'external', icon: '/components/external/payment-gateway.svg', description: 'Third-party payment processor (Stripe, Braintree, PayPal)', tags: ['external', 'payment', 'stripe', 'braintree', 'third-party'] },
  { id: 'email-provider', name: 'Email Provider', category: 'external', icon: '/components/external/email-provider.svg', description: 'Transactional/marketing email service (SendGrid, SES, Mailgun)', tags: ['external', 'email', 'sendgrid', 'ses', 'mailgun'] },
  { id: 'sms-provider', name: 'SMS Provider', category: 'external', icon: '/components/external/sms-provider.svg', description: 'SMS and messaging provider (Twilio, Vonage)', tags: ['external', 'sms', 'twilio', 'vonage'] },
  { id: 'push-notification-provider', name: 'Push Notification', category: 'external', icon: '/components/external/push-notification.svg', description: 'Mobile push notification service (FCM, APNs)', tags: ['external', 'push', 'fcm', 'apns', 'notifications'] },
  { id: 'external-api', name: 'External API', category: 'external', icon: '/components/external/external-api.svg', description: 'Generic third-party API integration', tags: ['external', 'api', 'third-party', 'integration'] },
  { id: 'analytics-service-ext', name: 'Analytics Service', category: 'external', icon: '/components/external/analytics-service.svg', description: 'Third-party analytics platform (Segment, Mixpanel, Amplitude)', tags: ['external', 'analytics', 'segment', 'mixpanel', 'amplitude'] },
]

// ─── ACTORS / USERS ───────────────────────────────────────────────────────────
export const actorComponents: ArchitectureComponent[] = [
  { id: 'end-user', name: 'End User', category: 'actors', icon: '/components/actors/end-user.svg', description: 'Human end user of the system', tags: ['actor', 'user', 'human', 'client'] },
  { id: 'admin-user', name: 'Admin', category: 'actors', icon: '/components/actors/admin-user.svg', description: 'Administrator with elevated privileges', tags: ['actor', 'admin', 'operator', 'superuser'] },
  { id: 'bot-crawler', name: 'Bot / Crawler', category: 'actors', icon: '/components/actors/bot-crawler.svg', description: 'Automated bot, web crawler, or scraper', tags: ['actor', 'bot', 'crawler', 'spider', 'automated'] },
]

// ─── ARCHITECTURE PATTERNS ────────────────────────────────────────────────────
export const patternComponents: ArchitectureComponent[] = [
  { id: 'monolith', name: 'Monolith', category: 'patterns', icon: '/components/patterns/monolith.svg', description: 'Single deployable unit containing all application logic', tags: ['pattern', 'monolith', 'single-deployment', 'layered'] },
  { id: 'bff-pattern', name: 'BFF (Backend for Frontend)', category: 'patterns', icon: '/components/patterns/bff.svg', description: 'Dedicated backend per client type (web BFF, mobile BFF)', tags: ['pattern', 'bff', 'backend-for-frontend', 'api-gateway'] },
  { id: 'saga-orchestrator', name: 'Saga Orchestrator', category: 'patterns', icon: '/components/patterns/saga-orchestrator.svg', description: 'Central coordinator for multi-step distributed transactions', tags: ['pattern', 'saga', 'orchestration', 'distributed-transaction'] },
  { id: 'cqrs-pattern', name: 'CQRS Split', category: 'patterns', icon: '/components/patterns/cqrs.svg', description: 'Separate read (Query) and write (Command) paths', tags: ['pattern', 'cqrs', 'command', 'query', 'read-write-split'] },
  { id: 'etl-pipeline', name: 'ETL Pipeline', category: 'patterns', icon: '/components/patterns/etl-pipeline.svg', description: 'Extract → Transform → Load data pipeline', tags: ['pattern', 'etl', 'data-pipeline', 'batch'] },
  { id: 'batch-job-pattern', name: 'Batch Processing Job', category: 'patterns', icon: '/components/patterns/batch-job.svg', description: 'Processes large datasets in scheduled batches', tags: ['pattern', 'batch', 'scheduled', 'data-processing'] },
  { id: 'cache-aside-p', name: 'Cache-Aside Layer', category: 'patterns', icon: '/components/patterns/cache-aside-pattern.svg', description: 'Architectural layer that implements the cache-aside pattern', tags: ['pattern', 'cache-aside', 'caching-layer'] },
  { id: 'service-mesh-pattern', name: 'Service Mesh', category: 'patterns', icon: '/components/patterns/service-mesh.svg', description: 'Sidecar-proxy infrastructure for service-to-service communication', tags: ['pattern', 'service-mesh', 'istio', 'envoy', 'sidecar'] },
]
