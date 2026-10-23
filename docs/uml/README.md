# UML diagrams (source of truth = Prisma schema + API roles)

Files:
- `erd.mmd` / `erd.png` — Entity Relationship Diagram
- `usecase.mmd` / `usecase.png` — Use Case Diagram

Enums used by the ERD:
- `Role`: CITIZEN | RESIDENT | SUPERVISOR | ORGANIZATION
- `PropertyType`: HOUSE | APARTMENT | BUILDING | COMMERCIAL | OTHER
- `DamageLevel`: LOW | MEDIUM | HIGH | CRITICAL
- `ReportStatus`: DRAFT | SUBMITTED | UNDER_REVIEW | APPROVED | REJECTED
- `ReviewAction`: APPROVE | REJECT | EDIT
- `AidType`: FOOD | SHELTER | MEDICAL | CASH | RECONSTRUCTION | OTHER
- `AidStatus`: PLANNED | IN_PROGRESS | DELIVERED | CANCELLED
- `VisionStatus`: READY | UNAVAILABLE | FAILED
