import type { Diagram } from '@/types/diagram'

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

export interface Template {
  id: string
  name: string
  description: string
  preview: string
  diagram: Omit<Diagram, 'id' | 'metadata'>
}

export const templates: Template[] = [
  {
    id: 'basic-web-app',
    name: 'Basic Web Application',
    description: 'Simple 3-tier web architecture: Client → API → Database',
    preview: 'Client → DNS → CDN → LB → App Server → DB',
    diagram: {
      name: 'Basic Web Application',
      version: 1,
      viewport: { x: 0, y: 0, zoom: 0.8 },
      nodes: [
        {
          id: 'n1', type: 'architecture', position: { x: 300, y: 50 },
          data: { componentId: 'web-browser', label: 'User', category: 'clients', icon: '/components/generic/web-browser.svg' },
        },
        {
          id: 'n2', type: 'architecture', position: { x: 300, y: 180 },
          data: { componentId: 'dns', label: 'DNS', category: 'networking', icon: '/components/networking/dns.svg' },
        },
        {
          id: 'n3', type: 'architecture', position: { x: 300, y: 310 },
          data: { componentId: 'cdn', label: 'CDN', category: 'networking', icon: '/components/networking/cdn.svg' },
        },
        {
          id: 'n4', type: 'architecture', position: { x: 300, y: 440 },
          data: { componentId: 'load-balancer', label: 'Load Balancer', category: 'networking', icon: '/components/networking/load-balancer.svg' },
        },
        {
          id: 'n5', type: 'architecture', position: { x: 150, y: 570 },
          data: { componentId: 'app-server', label: 'App Server A', category: 'compute', icon: '/components/compute/app-server.svg' },
        },
        {
          id: 'n6', type: 'architecture', position: { x: 450, y: 570 },
          data: { componentId: 'app-server', label: 'App Server B', category: 'compute', icon: '/components/compute/app-server.svg' },
        },
        {
          id: 'n7', type: 'architecture', position: { x: 300, y: 700 },
          data: { componentId: 'postgresql', label: 'PostgreSQL', category: 'databases', icon: '/components/databases/postgresql.svg' },
        },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', data: { protocol: 'HTTPS', connectionType: 'synchronous', label: 'HTTPS' } },
        { id: 'e2', source: 'n2', target: 'n3', data: { protocol: 'HTTPS', connectionType: 'synchronous' } },
        { id: 'e3', source: 'n3', target: 'n4', data: { protocol: 'HTTPS', connectionType: 'synchronous' } },
        { id: 'e4', source: 'n4', target: 'n5', data: { protocol: 'HTTP', connectionType: 'synchronous' } },
        { id: 'e5', source: 'n4', target: 'n6', data: { protocol: 'HTTP', connectionType: 'synchronous' } },
        { id: 'e6', source: 'n5', target: 'n7', data: { protocol: 'TCP', connectionType: 'read' } },
        { id: 'e7', source: 'n6', target: 'n7', data: { protocol: 'TCP', connectionType: 'write' } },
      ],
    },
  },
  {
    id: 'scalable-web-app',
    name: 'Scalable Web Application',
    description: 'AWS-based scalable architecture with CloudFront, ALB, Redis, and RDS',
    preview: 'Route53 → CloudFront → ALB → ECS → ElastiCache + Aurora',
    diagram: {
      name: 'Scalable Web Application (AWS)',
      version: 1,
      viewport: { x: 0, y: 0, zoom: 0.75 },
      nodes: [
        {
          id: 'n1', type: 'architecture', position: { x: 320, y: 40 },
          data: { componentId: 'web-browser', label: 'Users', category: 'clients', icon: '/components/generic/web-browser.svg' },
        },
        {
          id: 'n2', type: 'architecture', position: { x: 320, y: 160 },
          data: { componentId: 'aws-route53', label: 'Route 53', category: 'networking', provider: 'aws', icon: '/components/aws/route53.svg' },
        },
        {
          id: 'n3', type: 'architecture', position: { x: 320, y: 280 },
          data: { componentId: 'aws-cloudfront', label: 'CloudFront', category: 'networking', provider: 'aws', icon: '/components/aws/cloudfront.svg' },
        },
        {
          id: 'n4', type: 'architecture', position: { x: 320, y: 400 },
          data: { componentId: 'aws-alb', label: 'ALB', category: 'networking', provider: 'aws', icon: '/components/aws/alb.svg' },
        },
        {
          id: 'n5', type: 'architecture', position: { x: 120, y: 530 },
          data: { componentId: 'aws-ecs', label: 'ECS Service A', category: 'compute', provider: 'aws', icon: '/components/aws/ecs.svg' },
        },
        {
          id: 'n6', type: 'architecture', position: { x: 320, y: 530 },
          data: { componentId: 'aws-ecs', label: 'ECS Service B', category: 'compute', provider: 'aws', icon: '/components/aws/ecs.svg' },
        },
        {
          id: 'n7', type: 'architecture', position: { x: 520, y: 530 },
          data: { componentId: 'aws-ecs', label: 'ECS Service C', category: 'compute', provider: 'aws', icon: '/components/aws/ecs.svg' },
        },
        {
          id: 'n8', type: 'architecture', position: { x: 120, y: 670 },
          data: { componentId: 'aws-elasticache', label: 'ElastiCache', category: 'caching', provider: 'aws', icon: '/components/aws/elasticache.svg' },
        },
        {
          id: 'n9', type: 'architecture', position: { x: 520, y: 670 },
          data: { componentId: 'aws-aurora', label: 'Aurora RDS', category: 'databases', provider: 'aws', icon: '/components/aws/aurora.svg' },
        },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', data: { protocol: 'HTTPS', connectionType: 'synchronous', label: 'HTTPS' } },
        { id: 'e2', source: 'n2', target: 'n3', data: { protocol: 'HTTPS', connectionType: 'synchronous' } },
        { id: 'e3', source: 'n3', target: 'n4', data: { protocol: 'HTTPS', connectionType: 'synchronous' } },
        { id: 'e4', source: 'n4', target: 'n5', data: { protocol: 'HTTP', connectionType: 'synchronous' } },
        { id: 'e5', source: 'n4', target: 'n6', data: { protocol: 'HTTP', connectionType: 'synchronous' } },
        { id: 'e6', source: 'n4', target: 'n7', data: { protocol: 'HTTP', connectionType: 'synchronous' } },
        { id: 'e7', source: 'n5', target: 'n8', data: { protocol: 'TCP', connectionType: 'read', label: 'Cache' } },
        { id: 'e8', source: 'n6', target: 'n8', data: { protocol: 'TCP', connectionType: 'read' } },
        { id: 'e9', source: 'n6', target: 'n9', data: { protocol: 'TCP', connectionType: 'write', label: 'SQL' } },
        { id: 'e10', source: 'n7', target: 'n9', data: { protocol: 'TCP', connectionType: 'write' } },
      ],
    },
  },
  {
    id: 'event-driven',
    name: 'Event-Driven Architecture',
    description: 'Async event processing with message queues and workers',
    preview: 'API → SQS/Kafka → Workers → DB',
    diagram: {
      name: 'Event-Driven Architecture',
      version: 1,
      viewport: { x: 0, y: 0, zoom: 0.85 },
      nodes: [
        {
          id: 'n1', type: 'architecture', position: { x: 300, y: 50 },
          data: { componentId: 'mobile-app', label: 'Client', category: 'clients', icon: '/components/generic/mobile-app.svg' },
        },
        {
          id: 'n2', type: 'architecture', position: { x: 300, y: 180 },
          data: { componentId: 'api-gateway', label: 'API Gateway', category: 'networking', icon: '/components/networking/api-gateway.svg' },
        },
        {
          id: 'n3', type: 'architecture', position: { x: 300, y: 310 },
          data: { componentId: 'kafka', label: 'Kafka', category: 'messaging', icon: '/components/messaging/kafka.svg' },
        },
        {
          id: 'n4', type: 'architecture', position: { x: 100, y: 440 },
          data: { componentId: 'worker', label: 'Worker A', category: 'compute', icon: '/components/compute/worker.svg' },
        },
        {
          id: 'n5', type: 'architecture', position: { x: 300, y: 440 },
          data: { componentId: 'worker', label: 'Worker B', category: 'compute', icon: '/components/compute/worker.svg' },
        },
        {
          id: 'n6', type: 'architecture', position: { x: 500, y: 440 },
          data: { componentId: 'worker', label: 'Worker C', category: 'compute', icon: '/components/compute/worker.svg' },
        },
        {
          id: 'n7', type: 'architecture', position: { x: 100, y: 570 },
          data: { componentId: 'mongodb', label: 'MongoDB', category: 'databases', icon: '/components/databases/mongodb.svg' },
        },
        {
          id: 'n8', type: 'architecture', position: { x: 500, y: 570 },
          data: { componentId: 'elasticsearch', label: 'Elasticsearch', category: 'databases', icon: '/components/databases/elasticsearch.svg' },
        },
        {
          id: 'n9', type: 'architecture', position: { x: 300, y: 570 },
          data: { componentId: 'monitoring', label: 'Monitoring', category: 'observability', icon: '/components/observability/monitoring.svg' },
        },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', data: { protocol: 'HTTPS', connectionType: 'synchronous', label: 'REST' } },
        { id: 'e2', source: 'n2', target: 'n3', data: { protocol: 'Kafka', connectionType: 'asynchronous', label: 'Publish' } },
        { id: 'e3', source: 'n3', target: 'n4', data: { protocol: 'Kafka', connectionType: 'event', label: 'Subscribe' } },
        { id: 'e4', source: 'n3', target: 'n5', data: { protocol: 'Kafka', connectionType: 'event', label: 'Subscribe' } },
        { id: 'e5', source: 'n3', target: 'n6', data: { protocol: 'Kafka', connectionType: 'event', label: 'Subscribe' } },
        { id: 'e6', source: 'n4', target: 'n7', data: { protocol: 'TCP', connectionType: 'write' } },
        { id: 'e7', source: 'n5', target: 'n9', data: { protocol: 'HTTP', connectionType: 'write' } },
        { id: 'e8', source: 'n6', target: 'n8', data: { protocol: 'HTTP', connectionType: 'write' } },
      ],
    },
  },
  {
    id: 'microservices',
    name: 'Microservices',
    description: 'API Gateway routing to multiple independent microservices with own datastores',
    preview: 'Gateway → Services → Databases',
    diagram: {
      name: 'Microservices Architecture',
      version: 1,
      viewport: { x: 0, y: 0, zoom: 0.7 },
      nodes: [
        {
          id: 'n1', type: 'architecture', position: { x: 340, y: 40 },
          data: { componentId: 'web-browser', label: 'Client', category: 'clients', icon: '/components/generic/web-browser.svg' },
        },
        {
          id: 'n2', type: 'architecture', position: { x: 340, y: 170 },
          data: { componentId: 'aws-api-gateway', label: 'API Gateway', category: 'networking', provider: 'aws', icon: '/components/aws/api-gateway.svg' },
        },
        {
          id: 'n3', type: 'architecture', position: { x: 100, y: 320 },
          data: { componentId: 'user-service', label: 'User Service', category: 'services', icon: '/components/generic/user-service.svg' },
        },
        {
          id: 'n4', type: 'architecture', position: { x: 340, y: 320 },
          data: { componentId: 'payment-service', label: 'Payment Service', category: 'services', icon: '/components/generic/payment-service.svg' },
        },
        {
          id: 'n5', type: 'architecture', position: { x: 580, y: 320 },
          data: { componentId: 'notification-service', label: 'Notification Svc', category: 'services', icon: '/components/generic/notification-service.svg' },
        },
        {
          id: 'n6', type: 'architecture', position: { x: 100, y: 480 },
          data: { componentId: 'postgresql', label: 'PostgreSQL', category: 'databases', icon: '/components/databases/postgresql.svg' },
        },
        {
          id: 'n7', type: 'architecture', position: { x: 340, y: 480 },
          data: { componentId: 'aws-dynamodb', label: 'DynamoDB', category: 'databases', provider: 'aws', icon: '/components/aws/dynamodb.svg' },
        },
        {
          id: 'n8', type: 'architecture', position: { x: 580, y: 480 },
          data: { componentId: 'redis', label: 'Redis', category: 'caching', icon: '/components/databases/redis.svg' },
        },
        {
          id: 'n9', type: 'architecture', position: { x: 340, y: 170 + 130 + 160 },
          data: { componentId: 'aws-sqs', label: 'SQS Queue', category: 'messaging', provider: 'aws', icon: '/components/aws/sqs.svg' },
        },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', data: { protocol: 'HTTPS', connectionType: 'synchronous' } },
        { id: 'e2', source: 'n2', target: 'n3', data: { protocol: 'REST', connectionType: 'synchronous', label: '/users' } },
        { id: 'e3', source: 'n2', target: 'n4', data: { protocol: 'REST', connectionType: 'synchronous', label: '/payments' } },
        { id: 'e4', source: 'n2', target: 'n5', data: { protocol: 'REST', connectionType: 'synchronous', label: '/notify' } },
        { id: 'e5', source: 'n3', target: 'n6', data: { protocol: 'TCP', connectionType: 'read' } },
        { id: 'e6', source: 'n4', target: 'n7', data: { protocol: 'TCP', connectionType: 'write' } },
        { id: 'e7', source: 'n5', target: 'n8', data: { protocol: 'TCP', connectionType: 'read' } },
        { id: 'e8', source: 'n4', target: 'n9', data: { protocol: 'AMQP', connectionType: 'asynchronous', label: 'payment.processed' } },
        { id: 'e9', source: 'n9', target: 'n5', data: { protocol: 'AMQP', connectionType: 'event' } },
      ],
    },
  },
]

export function getTemplateById(id: string): Template | undefined {
  return templates.find((t) => t.id === id)
}
