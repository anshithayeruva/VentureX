# User data flow

> What happens to the data a user types, from the screen to the database and back. Checked against `project_service.py`, `analysis_service.py`, `match_service.py`, `founder_outreach_service.py`, `routes/interests.py` and `deal_room_service.py` on 27 Nov 2026.

## 1. A founder saves a startup

All of this runs **synchronously inside the one request**. There is no background queue, so the founder waits until it finishes.

```mermaid
flowchart TD
    F["Founder fills the form<br/>/founder/projects/new"] --> V{"Pydantic validation<br/>(schemas/)"}
    V -- invalid --> E422[422 shown next to the field]
    V -- ok --> INS[(INSERT into projects)]
    INS --> RB["Rule-based readiness check<br/>(free, no AI, notify=False)"]
    RB --> RS[(projects.readiness_score<br/>+ project_analyses row)]
    RS --> PUB{is_published?}
    PUB -- "no (draft)" --> DEL["delete any matches<br/>for this project"]
    PUB -- yes --> CM["compute_matches_for_project:<br/>score against every investor's criteria"]
    CM --> KEEP[(store fits ≥ 45% in matches)]
    KEEP --> ALERT{fit ≥ 90%?}
    ALERT -- yes --> N[(notifications row for that investor)]
    ALERT -- no --> DONE
    N --> DONE["201 + project JSON → page shows readiness"]
    DEL --> DONE
```

## 2. Readiness with AI (when the founder clicks Re-analyze)

```mermaid
flowchart LR
    IN["Inputs: profile fields, documents<br/>(PDF/images sent directly,<br/>others as extracted_text),<br/>GitHub repo, demo link"] --> ENG["Claude → Gemini → rules<br/>(first one configured)"]
    ENG --> CHK{"JSON matches the<br/>fixed schema?"}
    CHK -- no --> KEEP[error shown, previous report kept]
    CHK -- yes --> OUT[(project_analyses: 5 dimension scores,<br/>gaps, suggestions)]
    OUT --> SC[(projects.readiness_score)]
    SC --> UI[Founder sees the report.<br/>Private: investors never see the gaps.]
```

The five dimensions are problem/solution fit, market sizing and competition, business model clarity, traction and validation, and product and technology.

## 3. Matching: how one score is made

```mermaid
flowchart TD
    C{Investor has criteria?} -- no --> NS[No score. We don't invent one.]
    C -- yes --> X{"Hard exclusion?<br/>excluded industry or country,<br/>unmet required traction/team bar"}
    X -- yes --> HIDE[Startup removed for this investor]
    X -- no --> S["Score each criterion 0–100:<br/>industry, stage (one step away = 78),<br/>cheque size, business model,<br/>+ geography, traction, team if set"]
    S --> W["Weight by the investor's priority:<br/>High 3 · Medium 2 · Low 1 · Ignore 0"]
    W --> AVG["Weighted average,<br/>kept between 40 and 98.8"]
    AVG --> R["Each criterion returns one sentence<br/>(the 'why' shown on screen)"]
    AVG --> T{"< 45?"}
    T -- yes --> NR[Not recommended]
```

Code: `backend/app/services/match_service.py` (`calculate_match`) and `backend/app/services/criteria.py`. No AI is involved, so the same inputs always give the same score.

## 4. Intro request to deal room (the main flow)

```mermaid
sequenceDiagram
    autonumber
    actor F as Founder
    participant API as FastAPI
    participant DB as Neon
    actor I as Investor

    F->>API: POST /api/founders/investors/{id}/intro-requests
    API->>API: _eligibility(): published? readiness ≥ 50?<br/>not already asked? under the daily limit (5, or 10 verified)?
    alt a rule fails
        API-->>F: 422 / 409 / 429 with the reason
    else all ok
        API->>DB: INSERT project_interests (status pending, initiated_by founder)
        API->>DB: notification for the investor
        API-->>F: 201 (investor email hidden until Interested)
    end
    I->>API: GET /api/investors/deal-flow
    I->>API: POST /api/interests/{id}/respond (interested)
    API->>API: investor verified? else 403
    API->>DB: UPDATE status = accepted
    API->>DB: INSERT deal_rooms (stage INTRO_ACCEPTED) and link it to the interest
    API->>DB: notification for the founder: "Your deal room is open"
    F->>API: WebSocket /api/dealrooms/ws/{room}
    I->>API: WebSocket /api/dealrooms/ws/{room}
    F->>API: POST message
    API->>DB: INSERT deal_room_messages (previous_hash → integrity_hash)
    API-->>I: pushed live over the WebSocket
```

If the investor chooses **Pass**, a reason is required (otherwise 422). The founder sees the reason, which is the "you learn why" part of our pitch. A request with no reply expires after 14 days.

## 5. Where each piece of data lives and who can see it

| Data | Stored in | Who can see it |
|---|---|---|
| Password | Neon Auth only | nobody in our code |
| Profile, role | `app_users`, `founder_profiles`, `investor_profiles` | the user; parts shown to the other side |
| Startup details | `projects` | the founder; investors once published |
| Readiness gaps | `project_analyses` | **the founder only** |
| Uploaded files | `backend/private_uploads/` + `project_documents` | the founder; deal-room files only the two parties |
| Criteria | `investor_preferences` | the investor |
| Intro requests | `project_interests` | the founder and that investor |
| Deal-room chat | `deal_room_messages` | the two parties only |
| Audit log | `deal_room_audit_logs` | the two parties |
