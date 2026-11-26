# Database and entity-relationship diagram

> Source of truth: `backend/app/database/schema.sql` (checked 27 Nov 2026). Neon PostgreSQL, 29 tables. The schema is applied automatically every time the API starts (`CREATE TABLE IF NOT EXISTS` plus `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).

## 1. The core tables of the main flow

This covers the 12 tables the main user flow touches. The other 17 hold portfolio, funding rounds, teams, firms, company updates and verification history. Only the columns that matter for the flow are shown.

```mermaid
erDiagram
    app_users ||--o| founder_profiles : "has (if FOUNDER)"
    app_users ||--o| investor_profiles : "has (if INVESTOR)"
    app_users ||--o| investor_preferences : "sets criteria"
    app_users ||--o{ projects : "founder_id"
    projects ||--o{ project_documents : "FK, cascade"
    projects ||--o{ project_analyses : "FK, cascade"
    projects ||--o{ matches : "project_id"
    app_users ||--o{ matches : "investor_id"
    projects ||--o{ project_interests : "project_id"
    app_users ||--o{ project_interests : "investor_id / founder_id"
    project_interests ||--o| deal_rooms : "interest_id"
    deal_rooms ||--o{ deal_room_messages : "FK, cascade"
    deal_rooms ||--o{ deal_room_audit_logs : "FK, cascade"
    app_users ||--o{ notifications : "user_id"

    app_users {
        text id PK "Neon Auth user id (JWT sub)"
        text email
        text role "FOUNDER or INVESTOR"
        bool is_admin
    }
    founder_profiles {
        text user_id PK
        text company
        text linkedin
        jsonb settings
    }
    investor_profiles {
        text user_id PK
        text firm
        text verification_status "unverified / pending / verified / rejected"
        jsonb portfolio
        bool listed_for_founders
    }
    investor_preferences {
        text investor_id PK
        jsonb preferred_industries
        jsonb preferred_stages
        float min_investment
        float max_investment
        jsonb thesis "full criteria incl. priorities"
    }
    projects {
        bigint id PK
        text founder_id
        text title
        text industry
        text stage
        float funding_required
        bool is_published
        float readiness_score
    }
    project_documents {
        bigint id PK
        bigint project_id FK
        text storage_path
        text extracted_text
    }
    project_analyses {
        bigint id PK
        bigint project_id FK
        text engine "claude / gemini / rules"
        float overall_score
        jsonb dimensions
        jsonb gaps
    }
    matches {
        text id PK
        bigint project_id
        text investor_id
        float match_score
        jsonb reasons
    }
    project_interests {
        text id PK
        bigint project_id
        text investor_id
        text founder_id
        text status "pending / accepted / declined / expired"
        text initiated_by "founder or investor"
        text pass_reason
    }
    deal_rooms {
        text id PK
        text interest_id
        text founder_id
        text investor_id
        text stage
        bool nda_signed
    }
    deal_room_messages {
        text id PK
        text room_id FK
        int sequence
        text previous_hash
        text integrity_hash
    }
    deal_room_audit_logs {
        text id PK
        text room_id FK
        text event_type
        text tamper_hash
    }
    notifications {
        bigint id PK
        text user_id
        text title
        bool read
    }
```

## 2. Things to know (and be honest about)

| Point | Detail |
|---|---|
| **Real foreign keys vs links in code** | Child tables of `projects` and `deal_rooms` use real `REFERENCES ... ON DELETE CASCADE` constraints (documents, analyses, messages, audit logs). But `projects.founder_id`, `matches`, `project_interests` and `deal_rooms.project_id` are **links kept by the service code, not database constraints**. Adding constraints there is open item O-10. |
| **Unique pairs** | `matches` and `project_interests` both have `UNIQUE (project_id, investor_id)`. That's why a second intro request for the same pair returns 409. |
| **Copied names** | `project_interests` and `deal_rooms` store copies of names and emails (e.g. `investor_name`). This makes lists fast but means a renamed user can show an old name there. |
| **Money types** | Portfolio and funding tables use `NUMERIC(18,2)` (exact). Older core tables use `DOUBLE PRECISION` for `funding_required`, `min_investment` and `max_investment`. That's fine for ranges and display, but not for ledgers. |
| **JSONB** | Used for lists and flexible settings (criteria, reasons, gaps). Easy to change, harder to query. |
| **Tamper evidence** | Each deal-room message stores the hash of the previous one (`previous_hash` → `integrity_hash`), so editing an old message breaks the chain. |
| **Admins** | `app_users.is_admin`, or a verified email listed in `ADMIN_EMAILS` in `backend/.env`. |

## 3. Practice queries (Stage 2)

```sql
-- Published startups with their founder's email (a JOIN through founder_id)
SELECT p.title, p.readiness_score, u.email
FROM projects p
JOIN app_users u ON u.id = p.founder_id
WHERE p.is_published = true
ORDER BY p.readiness_score DESC;

-- Intro requests by status
SELECT status, COUNT(*) FROM project_interests GROUP BY status;

-- Deal rooms with how many messages each has
SELECT r.id, r.project_title, COUNT(m.id) AS messages
FROM deal_rooms r LEFT JOIN deal_room_messages m ON m.room_id = r.id
GROUP BY r.id, r.project_title;

-- Investors who have not set criteria yet (LEFT JOIN + IS NULL)
SELECT u.email FROM app_users u
LEFT JOIN investor_preferences ip ON ip.investor_id = u.id
WHERE u.role = 'INVESTOR' AND ip.investor_id IS NULL;
```

Run these in the Neon console's SQL editor (read-only queries only). Our code always passes values as parameters (`%s`), never by joining strings, which prevents SQL injection.
