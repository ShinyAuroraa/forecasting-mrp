# 9. Integration Patterns

## 9.1 Email Integration (FR-050)

```mermaid
flowchart LR
    GMAIL["Gmail / IMAP Server"]
    LISTENER["Email Listener Worker<br/>(NestJS @Cron)"]
    PARSER["Attachment Parser<br/>(CSV/XLSX/PDF)"]
    ETL["ETL Pipeline"]
    DB["PostgreSQL"]

    GMAIL -->|"IMAP / Gmail API<br/>Filter: sender + subject + date"| LISTENER
    LISTENER -->|"Download attachment"| PARSER
    PARSER -->|"Apply saved mapping"| ETL
    ETL -->|"Clean data"| DB

    subgraph "Retry Strategy (R-A02)"
        R1["06:00 Attempt 1"]
        R2["06:30 Attempt 2"]
        R3["07:00 Attempt 3"]
        R4["07:30 Attempt 4"]
        DLQ["Dead Letter -> Admin alert"]
    end
```

**Adapters (Strategy pattern):**
- `GmailAdapter`: Google OAuth2 + Gmail API (recommended)
- `ImapAdapter`: IMAP connection via `imapflow` (Node.js)
- `SftpAdapter`: SFTP folder monitoring (fallback)

## 9.2 ERP Connector Pattern (FR-051)

The ERP connector uses the **Adapter pattern** -- three implementations behind a common interface:

```typescript
interface ErpConnector {
  fetchDailyData(date: Date): Promise<RawMovementData[]>;
  testConnection(): Promise<boolean>;
}

class RestApiConnector implements ErpConnector { ... }
class DirectDbConnector implements ErpConnector { ... }   // Read-only (NFR-020)
class SftpConnector implements ErpConnector { ... }
```

**Configuration:** The active connector is selected via `config_sistema` (`automacao.erp.tipo`). Multiple connectors can be configured as primary + fallback.

## 9.3 Export Patterns (FR-058)

| Format | Library | Generation | Delivery |
|--------|---------|-----------|----------|
| **Excel (.xlsx)** | `exceljs` (NestJS) | Server-side streaming | Download endpoint |
| **PDF** | `@react-pdf/renderer` or `puppeteer` | Server-side rendering | Download endpoint |
| **CSV** | Native streaming | Server-side | Download endpoint |

**For large exports:** Backend generates the file asynchronously via BullMQ job, stores in temp directory (or S3 in production), and returns a download URL.

## 9.4 Webhook Patterns for Notifications (FR-062)

Internal notification system using Redis pub/sub + WebSocket:

```
Event Source (any module)
  -> NotificacaoService.create({ type, severity, message, entityId })
    -> PostgreSQL (persist alert)
    -> Redis pub/sub (real-time channel)
      -> WebSocket Gateway (push to connected clients)
        -> Frontend (toast notification + alert badge update)
```

---
