import type { Diagram } from '@/types/diagram'

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

export interface Template {
  id: string
  name: string
  description: string
  preview: string
  mode: 'hld' | 'lld'
  diagram: Omit<Diagram, 'id' | 'metadata'>
}

export const templates: Template[] = [
  {
    id: 'basic-web-app',
    name: 'Basic Web Application',
    description: 'Simple 3-tier web architecture: Client → API → Database',
    preview: 'Client → DNS → CDN → LB → App Server → DB',
    mode: 'hld',
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
    mode: 'hld',
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
    mode: 'hld',
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
    mode: 'hld',
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
  {
    id: 'lld-login-flow',
    name: 'Login Flowchart',
    description: 'User login decision flow with success and error paths',
    preview: 'Start → Credentials → Valid? → Session / Error',
    mode: 'lld',
    diagram: {
      name: 'Login Flowchart',
      version: 1,
      viewport: { x: 0, y: 0, zoom: 0.9 },
      nodes: [
        {
          id: 's1', type: 'shape', position: { x: 260, y: 40 }, width: 140, height: 56,
          style: { width: 140, height: 56 },
          data: { shapeType: 'terminator', label: 'Start', fill: '#ffffff', stroke: '#334155', strokeWidth: 2, cornerRadius: 999, fontSize: 13, textColor: '#0f172a' },
        },
        {
          id: 's2', type: 'shape', position: { x: 250, y: 140 }, width: 160, height: 70,
          style: { width: 160, height: 70 },
          data: { shapeType: 'parallelogram', label: 'Enter credentials', fill: '#ffffff', stroke: '#334155', strokeWidth: 2, fontSize: 13, textColor: '#0f172a' },
        },
        {
          id: 's3', type: 'shape', position: { x: 250, y: 250 }, width: 160, height: 100,
          style: { width: 160, height: 100 },
          data: { shapeType: 'diamond', label: 'Valid?', fill: '#ffffff', stroke: '#334155', strokeWidth: 2, fontSize: 13, textColor: '#0f172a' },
        },
        {
          id: 's4', type: 'shape', position: { x: 80, y: 400 }, width: 150, height: 70,
          style: { width: 150, height: 70 },
          data: { shapeType: 'rectangle', label: 'Create session', fill: '#ffffff', stroke: '#334155', strokeWidth: 2, cornerRadius: 4, fontSize: 13, textColor: '#0f172a' },
        },
        {
          id: 's5', type: 'shape', position: { x: 420, y: 400 }, width: 150, height: 70,
          style: { width: 150, height: 70 },
          data: { shapeType: 'rectangle', label: 'Show error', fill: '#ffffff', stroke: '#334155', strokeWidth: 2, cornerRadius: 4, fontSize: 13, textColor: '#0f172a' },
        },
        {
          id: 's6', type: 'shape', position: { x: 95, y: 520 }, width: 120, height: 50,
          style: { width: 120, height: 50 },
          data: { shapeType: 'terminator', label: 'End', fill: '#ffffff', stroke: '#334155', strokeWidth: 2, cornerRadius: 999, fontSize: 13, textColor: '#0f172a' },
        },
      ],
      edges: [
        { id: 'fe1', source: 's1', target: 's2', type: 'architecture', data: { relationKind: 'association' } },
        { id: 'fe2', source: 's2', target: 's3', type: 'architecture', data: { relationKind: 'association' } },
        { id: 'fe3', source: 's3', target: 's4', type: 'architecture', data: { relationKind: 'association', label: 'yes' } },
        { id: 'fe4', source: 's3', target: 's5', type: 'architecture', data: { relationKind: 'association', label: 'no' } },
        { id: 'fe5', source: 's4', target: 's6', type: 'architecture', data: { relationKind: 'association' } },
      ],
    },
  },
  {
    id: 'lld-order-class',
    name: 'Order Class Model',
    description: 'Simple UML class diagram for orders and users',
    preview: 'User → Order → OrderItem',
    mode: 'lld',
    diagram: {
      name: 'Order Class Model',
      version: 1,
      viewport: { x: 0, y: 0, zoom: 0.95 },
      nodes: [
        {
          id: 'c1', type: 'umlClass', position: { x: 80, y: 80 }, width: 200, height: 160,
          style: { width: 200, height: 160 }, connectable: true,
          data: {
            name: 'User', stereotype: 'class',
            attributes: ['+ id: string', '+ email: string'],
            methods: ['+ placeOrder(): Order'],
            fill: '#ffffff', stroke: '#334155',
          },
        },
        {
          id: 'c2', type: 'umlClass', position: { x: 360, y: 80 }, width: 200, height: 160,
          style: { width: 200, height: 160 }, connectable: true,
          data: {
            name: 'Order', stereotype: 'class',
            attributes: ['+ id: string', '+ total: number', '+ status: Status'],
            methods: ['+ addItem(item)', '+ checkout()'],
            fill: '#ffffff', stroke: '#334155',
          },
        },
        {
          id: 'c3', type: 'umlClass', position: { x: 360, y: 300 }, width: 200, height: 140,
          style: { width: 200, height: 140 }, connectable: true,
          data: {
            name: 'OrderItem', stereotype: 'class',
            attributes: ['+ sku: string', '+ qty: number'],
            methods: [],
            fill: '#ffffff', stroke: '#334155',
          },
        },
        {
          id: 'c4', type: 'umlClass', position: { x: 620, y: 100 }, width: 160, height: 140,
          style: { width: 160, height: 140 }, connectable: true,
          data: {
            name: 'Status', stereotype: 'enum',
            attributes: ['PENDING', 'PAID', 'SHIPPED'],
            methods: [],
            fill: '#ffffff', stroke: '#334155',
          },
        },
      ],
      edges: [
        { id: 'ce1', source: 'c1', target: 'c2', type: 'architecture', data: { relationKind: 'association', label: 'places' } },
        { id: 'ce2', source: 'c2', target: 'c3', type: 'architecture', data: { relationKind: 'composition', label: 'contains' } },
        { id: 'ce3', source: 'c2', target: 'c4', type: 'architecture', data: { relationKind: 'dependency' } },
      ],
    },
  },
  {
    id: 'lld-checkout-seq',
    name: 'Checkout Sequence',
    description: 'Sequence diagram for checkout across actor, API, and payment',
    preview: 'Actor → API → Payment → API',
    mode: 'lld',
    diagram: {
      name: 'Checkout Sequence',
      version: 1,
      viewport: { x: 0, y: 0, zoom: 0.9 },
      nodes: [
        {
          id: 'l1', type: 'umlLifeline', position: { x: 80, y: 40 }, width: 120, height: 360,
          style: { width: 120, height: 360 }, connectable: true,
          data: { label: 'Customer', kind: 'actor', activations: [{ start: 110, end: 260 }], fill: '#ffffff', stroke: '#334155' },
        },
        {
          id: 'l2', type: 'umlLifeline', position: { x: 280, y: 40 }, width: 120, height: 360,
          style: { width: 120, height: 360 }, connectable: true,
          data: { label: 'CheckoutAPI', kind: 'boundary', activations: [{ start: 120, end: 280 }], fill: '#ffffff', stroke: '#334155' },
        },
        {
          id: 'l3', type: 'umlLifeline', position: { x: 480, y: 40 }, width: 120, height: 360,
          style: { width: 120, height: 360 }, connectable: true,
          data: { label: 'Payment', kind: 'control', activations: [{ start: 160, end: 240 }], fill: '#ffffff', stroke: '#334155' },
        },
      ],
      edges: [
        { id: 'se1', source: 'l1', target: 'l2', sourceHandle: 'right', targetHandle: 'left', type: 'architecture', data: { relationKind: 'message-sync', label: 'checkout()' } },
        { id: 'se2', source: 'l2', target: 'l3', sourceHandle: 'right', targetHandle: 'left', type: 'architecture', data: { relationKind: 'message-sync', label: 'charge()' } },
        { id: 'se3', source: 'l3', target: 'l2', sourceHandle: 'left', targetHandle: 'right', type: 'architecture', data: { relationKind: 'message-return', label: 'ok' } },
      ],
    },
  },
  {
    id: 'lld-users-orders-er',
    name: 'Users–Orders ER',
    description: 'Entity-relationship model for users and orders',
    preview: 'User 1—N Order',
    mode: 'lld',
    diagram: {
      name: 'Users–Orders ER',
      version: 1,
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: [
        {
          id: 'e1', type: 'umlEntity', position: { x: 100, y: 120 }, width: 180, height: 140,
          style: { width: 180, height: 140 }, connectable: true,
          data: {
            name: 'User',
            attributes: [
              { name: 'id', type: 'uuid', kind: 'pk' },
              { name: 'email', type: 'string', kind: 'attr' },
            ],
            fill: '#ffffff', stroke: '#334155',
          },
        },
        {
          id: 'e2', type: 'umlEntity', position: { x: 420, y: 120 }, width: 180, height: 160,
          style: { width: 180, height: 160 }, connectable: true,
          data: {
            name: 'Order',
            attributes: [
              { name: 'id', type: 'uuid', kind: 'pk' },
              { name: 'user_id', type: 'uuid', kind: 'fk' },
              { name: 'total', type: 'money', kind: 'attr' },
            ],
            fill: '#ffffff', stroke: '#334155',
          },
        },
      ],
      edges: [
        { id: 're1', source: 'e1', target: 'e2', type: 'architecture', data: { relationKind: 'one-to-many', label: 'places' } },
      ],
    },
  },
]

export function getTemplateById(id: string): Template | undefined {
  return templates.find((t) => t.id === id)
}

export function getTemplatesByMode(mode: 'hld' | 'lld'): Template[] {
  return templates.filter((t) => t.mode === mode)
}
