import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ADVICE, RULES } from '../src/services/security-rules';

const dir = join(__dirname, '../../docs'); mkdirSync(dir, { recursive: true });
const rows = RULES.map(r => `| ${r.id} | ${r.category} | ${ADVICE[r.id] ?? ''} |`);
writeFileSync(join(dir, 'rule-catalog.md'), `# Security rule catalog\n\nGenerated from \`services/security-rules\`. Rules are deterministic and run on the normalized resource model.\n\n| Rule | Category | Recommended fix |\n|---|---|---|\n${rows.join('\n')}\n`);
writeFileSync(join(dir, 'ER.md'), `# Database ER diagram\n\n\`\`\`mermaid\nerDiagram\n  USERS ||--o{ PROJECTS : owns\n  USERS ||--o{ TEAM_MEMBERS : joins\n  USERS ||--o{ AUDIT_LOGS : performs\n  TEAMS ||--o{ TEAM_MEMBERS : has\n  TEAMS ||--o{ PROJECTS : groups\n  PROJECTS ||--o{ SCANS : has\n  PROJECTS ||--o{ FINDING_STATES : tracks\n  PROJECTS ||--o{ AUDIT_LOGS : records\n  USERS { string id PK string email UK string password_hash bool email_verified string google_id int token_version }\n  TEAMS { string id PK string name }\n  TEAM_MEMBERS { string id PK string team_id FK string user_id FK string role }\n  PROJECTS { string id PK string owner_id FK string team_id FK string name json environment datetime environment_updated_at }\n  SCANS { string id PK string project_id FK string status json result json summary datetime completed_at }\n  FINDING_STATES { string id PK string project_id FK string rule_id string resource_id string status string note }\n  AUDIT_LOGS { string id PK string user_id FK string project_id FK string action json details datetime created_at }\n\`\`\`\n`);
console.log(`wrote rule catalog (${RULES.length} rules) and ER diagram to docs/`);
