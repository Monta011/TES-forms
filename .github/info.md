# Public Forms Digitization Web App — Full Specification & Build Plan

## 0) Purpose & Context

The company currently uses 3 application forms stored as Word files (DOCX) and one as PDF. Employees fill them manually (handwritten or typed in Word), print, and submit. The goal is to digitize these forms into a lightweight public website where anyone can:

1. View all submitted applications
2. Create a new application
3. Edit any application at any time
4. Export any application as a print-ready PDF (generated on demand; PDFs are not stored)

No authentication or authorization is required. All pages and data are public.

---

## 1) Core Requirements (MVP)

### 1.1 Form Types

The system supports exactly 3 application types:

1. **Re-Joining Form**
2. **Leave Application – Expats**
3. **Leave Application – Omani**

Each form has its own “List” and “Create/Edit” UI, and its own PDF export template matching the original Word/PDF layout (logo, tables, sections, etc.).

---

### 1.2 Navigation / Pages

#### Page A — Home

**Route:** `GET /`

**UI:**

* Simple landing page with three large cards/buttons:

  * Re-Joining Form
  * Leave Application – Expats
  * Leave Application – Omani
* Clicking a card goes to that form’s list page.

**Mobile-first layout** (cards stacked vertically on phones).

---

#### Page B — List Applications (per form type)

**Route:** `GET /forms/:type`

`:type` ∈ `{rejoining, leave-expats, leave-omani}`

**UI features:**

* Header with title + description
* “New Application” button
* Filter/search panel
* Table/list of submitted applications

**Filtering (minimum):**

* Text search (employee name OR employee ID OR department)
* Date range filter (created_at)
* Optional filters specific to form type (only if easy; otherwise omit MVP)

**Table columns (minimum):**

* Application ID (short)
* Employee Name
* Employee ID
* Created Date
* Last Updated Date
* Status/Leave type if applicable
* Actions:

  * **Edit**
  * **Export PDF**

**Empty state:**

* If no submissions, show friendly message + “New Application” CTA.

---

#### Page C — New Application

**Route:** `GET /forms/:type/new`

**UI:**

* Mobile-first form with sections matching original template.
* Field validation (required/format).
* Buttons at bottom:

  * **Save & Close** (creates record and redirects to list)
  * **Save & Export PDF** (creates record then exports PDF immediately)
  * **Cancel** (returns to list without saving)

---

#### Page D — Edit Application

**Route:** `GET /forms/:type/:id/edit`

**UI:**

* Same layout as New.
* Pre-filled with existing data.
* Buttons:

  * **Save & Close**
  * **Save & Export PDF**
  * **Export PDF** (without saving changes)
  * **Back to List**

All records are editable by anyone.

---

#### Page E — PDF Export (download)

**Route:** `GET /forms/:type/:id/pdf`

**Behavior:**

* Server loads record by ID
* Renders an HTML “print template” matching the Word/PDF design
* Converts HTML → PDF using Puppeteer
* Streams PDF to browser as a download response
* **No PDF file stored on disk**
* Generate in memory / temp store then delete

---

## 2) Non-Functional Requirements

### 2.1 Performance / Hosting

* Very low traffic expected.
* Must be lightweight and compatible with free-tier hosting.
* Single server app preferred.

### 2.2 Responsiveness

* Mobile-first UX is required.
* Must work well on:

  * phone (primary)
  * tablet
  * desktop

### 2.3 Accessibility & UX

* Large touch targets
* Clear sectioning
* Minimal typing where possible (selects/date pickers)
* Friendly validation messages

### 2.4 Data Persistence

* Save applications in database.
* PDFs are not saved.

### 2.5 Security Notes

Even though data is public:

* Still protect against:

  * SQL injection
  * XSS
  * CSRF on save endpoints
* Rate limit basic writes to avoid accidental spamming.

---

## 3) Tech Stack (final)

### Runtime

* **Node.js (LTS)**

### Server / API

* **Express.js**

### Views (Server-rendered UI)

* **EJS templates**
* Layout + partials for shared header/footer

### Styling

* **Tailwind CSS** (preferred) OR Bootstrap
  (Tailwind recommended for mobile-first speed)

### Database

* **PostgreSQL**
* **Prisma ORM** for schema + migrations + easy querying

### PDF Generation

* **Puppeteer**

  * Render HTML print view
  * Print to PDF
  * Stream response

### Deployment

* Any free-tier Node+Postgres host (Render/Railway/Fly.io/etc.)
* .env config for DB URL and app base URL

---

## 4) Data Model

### 4.1 Applications table

Single unified table for all 3 types.

**Table:** `applications`

| Column     | Type      | Notes                                      |
| ---------- | --------- | ------------------------------------------ |
| id         | UUID (PK) | server-generated                           |
| type       | enum      | `rejoining`, `leave_expats`, `leave_omani` |
| data       | JSONB     | full form payload                          |
| created_at | timestamp | default now                                |
| updated_at | timestamp | auto-updated                               |

**Reason:** forms may differ; JSONB keeps schema flexible and avoids multiple tables.

---

### 4.2 Prisma Schema (example)

```prisma
model Application {
  id        String   @id @default(uuid())
  type      ApplicationType
  data      Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum ApplicationType {
  rejoining
  leave_expats
  leave_omani
}
```

---

## 5) Form Field Definitions (Agent must map from original docs)

**Important:** Agent must recreate fields from the Word/PDF templates exactly, including labels, sections, and table structure.

### 5.1 Field storage convention

Store form fields inside `data` JSON using stable keys.

Example:

```json
{
  "employeeName": "John Doe",
  "employeeId": "12345",
  "department": "HR",
  "leaveStart": "2025-11-01",
  "leaveEnd": "2025-11-10",
  ...
}
```

### 5.2 Validation rules

Per form:

* Required fields as in original form
* Date fields must be valid dates
* Numeric IDs must be numeric
* Basic max length limits (e.g., 150 chars)

Validation occurs:

* Client-side (HTML5 + small JS)
* Server-side (final authority)

---

## 6) API / Server Routes

### 6.1 Human pages

* `GET /`
* `GET /forms/:type`
* `GET /forms/:type/new`
* `GET /forms/:type/:id/edit`

### 6.2 CRUD endpoints

* `POST /forms/:type`

  * Create new application
* `POST /forms/:type/:id`

  * Update existing application

### 6.3 PDF

* `GET /forms/:type/:id/pdf`

  * Generate & download

### 6.4 Filters

Filters implemented as query params on list route:
`GET /forms/:type?search=ahmed&from=2025-11-01&to=2025-11-21`

Backend uses Prisma where clause:

* search across known key fields in JSON (employeeName, employeeId, department)
* date range on createdAt

---

## 7) UI / Template Structure

### 7.1 Layouts

* `views/layout.ejs` — base HTML structure, imports Tailwind + navbar.
* `views/partials/navbar.ejs`
* `views/partials/footer.ejs`

### 7.2 Pages

* `views/home.ejs`
* `views/forms/list.ejs`
* `views/forms/new.ejs`
* `views/forms/edit.ejs`

### 7.3 Shared form partials

Create reusable form sections for DRY code:

* `views/forms/partials/rejoining_form.ejs`
* `views/forms/partials/leave_expats_form.ejs`
* `views/forms/partials/leave_omani_form.ejs`

Each partial renders all fields for that type.

---

## 8) PDF Templates

### 8.1 Templates location

* `views/pdf/rejoining.ejs`
* `views/pdf/leave_expats.ejs`
* `views/pdf/leave_omani.ejs`

### 8.2 Requirements

* Must visually match original Word/PDF:

  * company logo at top
  * same headings and section order
  * same tables and alignment
  * A4 portrait
  * print-friendly fonts and spacing

### 8.3 Puppeteer flow

1. Render EJS HTML with record data.
2. Launch Puppeteer headless Chrome.
3. Load HTML string.
4. `page.pdf({ format: "A4", printBackground: true })`
5. Stream output to client with:

   * `Content-Type: application/pdf`
   * `Content-Disposition: attachment; filename="TYPE-ID.pdf"`

No file persistence.

---

## 9) Folder Structure (target)

```
/app
  server.js
  /routes
    forms.js
  /controllers
    formsController.js
  /services
    pdfService.js
  /views
    layout.ejs
    home.ejs
    /forms
      list.ejs
      new.ejs
      edit.ejs
      /partials
        rejoining_form.ejs
        leave_expats_form.ejs
        leave_omani_form.ejs
    /pdf
      rejoining.ejs
      leave_expats.ejs
      leave_omani.ejs
  /public
    /css
    /images
      logo.png
/prisma
  schema.prisma
  migrations/
.env
package.json
```

---

## 10) Business Logic Details

### 10.1 Create

* Parse form body → build `data` JSON.
* Insert `applications` row with type + data.
* Redirect:

  * Save & Close → list
  * Save & Export PDF → pdf route

### 10.2 Edit

* Load record.
* Render prefilled fields.
* On save: update `data`, set updatedAt automatically.

### 10.3 List

* Filter by `type`.
* Apply optional search/date filters.
* Sort descending by `updatedAt`.

---

## 11) Error Handling & Edge Cases

* Invalid `:type` → 404 page with link home.
* Record missing ID → 404.
* PDF generation failure → show message + allow retry.
* Form validation errors → re-render same page with entered values and error messages.
* Concurrent edits: last save wins (acceptable for no-auth MVP).

---

## 12) Testing Requirements

Agent should implement:

### 12.1 Unit tests

* JSON validation per type
* filter logic
* pdfService returns Buffer

### 12.2 Integration tests

* create → list → edit → export flow

### 12.3 Manual checklist

* Mobile layout good on iPhone/Android sizes
* Desktop layout ok
* PDF matches printed Word/PDF structure
* No PDFs stored after export

---

## 13) Deployment Steps (agent deliverable)

1. Configure `.env`:

   * `DATABASE_URL=postgres://...`
   * `PORT=3000`
2. Prisma migrate deploy
3. Start server
4. Confirm public URL works

---

## 14) Deliverables

Agent must deliver:

1. Full working Node/Express app per spec
2. Prisma schema + migrations
3. Complete UI templates for 3 forms
4. Complete PDF templates for 3 forms matching originals
5. Deployment-ready repo
6. Short README:

   * setup
   * env vars
   * how to run locally
   * how to deploy on free tier

---