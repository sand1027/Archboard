# ArchBoard

A system design whiteboard that understands what you draw.

Most diagramming tools treat an architecture as shapes and arrows. ArchBoard treats it as a
system: every component carries a type, a size and a latency, so the diagram can be run. Push
traffic through it and it finds the bottleneck. Change the instance count and watch the number
move.

Run it and go to `/try` to use the whole editor with no account — it stores everything in your
browser.

---

## What it does

**Two boards.** HLD for architecture — 233 components across AWS and generic infrastructure,
grouped into frames, wired with typed connections. LLD for detail — 13 diagram types including
class, ER, sequence, state, activity, use case, component and deployment.

**Simulation.** Pick an entry point and send traffic. The engine walks the graph, queues
requests at each node against its concurrency, and reports utilisation, queue depth and p95
latency per component. Nodes over 70% utilisation are flagged as bottlenecks; the arithmetic is
Little's Law and an M/M/c-style queue, not a heuristic.

**Capacity estimation.** Back-of-envelope sizing from daily actives to storage, with every step
shown as substituted arithmetic — `100M × 10 = 1B requests/day` — and every derived value
overridable so downstream numbers recompute. An estimate you cannot check is an estimate you
should not trust.

**Per-component configuration.** An EC2 instance has an AMI, an EBS volume and a security
group; a Postgres instance has an engine version and a connection pool; a Kafka topic has
partitions. Each component type gets its own schema, and the values that matter feed the
simulation — a database with a pool of 20 serves 20 requests at a time no matter how many cores
it has.

**Diagrams as code.** A text DSL, in the spirit of Mermaid but carrying what Mermaid cannot:
the component type, its capacity, its pool, the workload. The text is runnable.

```
diagram "Photo Sharing" {
  workload { dau 100M, perUser 10, peak 3x, reads 9:1, cache 80% }

  group client "Clients" {
    web-browser web "Web"
    mobile-app mobile "Mobile"
  }

  load-balancer lb "Load Balancer" { instances 2, type m5.large }

  group dc "Data Center" : data-center {
    server api "API" { instances 4, type m5.large, service 25ms }
    redis cache "Cache" { type r5.large }
    postgresql db "Orders" { connectionPool 20, multiAz }
  }

  web    -> lb
  mobile -> lb
  lb     -> api
  api    -> cache
  api    -> db
  api    ~> events : Kafka "order.placed"

  shape todo "Add a rate limiter before launch" : note
}
```

Type it and the diagram draws itself — no coordinates in the text. Layout is derived and
deterministic, and anything you drag by hand is pinned in the document beside the source rather
than smeared through it. Existing diagrams generate their own code, so the editor is not a
second empty world.

**Real-time collaboration.** Presence cursors with names, per-diagram sharing capped at three
collaborators, or unlimited sharing through a team. Concurrent edits merge per field via
last-write-wins registers with Lamport clocks rather than clobbering each other.

**Export.** PNG, SVG and JSON.

---

## Running it

Requires Node 20+ and a [Supabase](https://supabase.com) project (free tier is fine).

```bash
git clone https://github.com/sand1027/Archboard
cd Archboard
npm install
```

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key
SUPABASE_SECRET_KEY=your-service-role-key

# Only needed for OAuth redirects in production.
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Both public keys are on the Supabase dashboard under **Project Settings → API**. The secret key
is on the same page — it bypasses row-level security, so keep it server-side.

Apply the schema. Paste each file in `supabase/migrations/` into the Supabase SQL editor in
order, or use the CLI:

```bash
supabase db push
```

Then:

```bash
npm run dev
```

Open [localhost:3000](http://localhost:3000). To skip the sign-in entirely, go straight to
[localhost:3000/try](http://localhost:3000/try).

### Without Supabase

`/try` needs no database and no keys — it stores everything in `localStorage`. Sharing,
version history and collaboration are the only things that require an account.

---

## Commands

```bash
npm run dev      # dev server
npm run build    # production build
npm start        # serve the build
npm test         # unit tests, once
npm run test:watch
npm run lint
```

---

## How it is put together

Next.js App Router, React 19, TypeScript, Tailwind 4. Canvas is
[React Flow](https://reactflow.dev). State is Zustand. Persistence and auth are Supabase.

```
app/                    routes — dashboard, diagram/[id], try, auth, api
components/
  canvas/               HLD canvas, nodes, edges, view controls
  lld/                  LLD canvas, palette, inspector
  dsl/                  code editor pane
  inspector/            per-node properties and configuration
  simulation/           run controls, packet layer, bottleneck report
  estimate/             capacity panel
  collab/               presence cursors, sharing
data/
  components/           the 233-component registry + behaviour hints
  lld/                  LLD palette catalogues
  templates/            HLD and LLD starters
lib/
  dsl/                  lexer, parser, compiler, printer, highlighter
  simulation/           engine, capacity, instance sizing, bottlenecks
  estimate/             workload derivation
  canvas/               geometry, auto-layout, inference
  persistence/          document versioning and migration
store/                  Zustand stores
```

### A few decisions worth knowing

**Frame membership is geometric, not stored.** A node is inside a frame when its centre falls
within the frame's rectangle. That means grouping needs no extra data and never disagrees with
what you see — but it also means anything that places nodes has to physically enclose them.

**Documents are versioned and migrate forward.** `diagrams.data` is a single `jsonb` column, so
new features are additive keys, and every historical shape is normalised on load by one function
rather than branching at each call site.

**The DSL layout is hand-written, not ELK or dagre.** Both re-solve the whole graph, so adding
one node rearranges the other twenty — unacceptable for a diagram someone has been editing for
an hour. Ranking is longest-path and ties break on declaration order, so appending appends.

**The code editor is a textarea, not CodeMirror.** Highlighting runs off the same tokenizer the
parser uses. A grammar written for an editor library would be a second definition of the
language, free to drift until text highlights as valid while failing to compile.

---

## Status

Working and usable, with rough edges. Known gaps:

- No CI yet — tests, types and lint run locally.
- 19 lint errors remain in older files.
- The LLD board has its own text DSL still to come; the language currently covers HLD only.
- GCP and Azure component catalogues are empty, so only the AWS provider tab appears.

## Licence

Not yet chosen. Without one, default copyright applies and nobody else may reuse the code — add
a `LICENSE` file if you want that to change.
