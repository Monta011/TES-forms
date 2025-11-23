# TES Public Forms - Copilot Instructions

## Project Overview

Public-facing web app for digitizing 3 company application forms (Re-Joining, Leave Expats, Leave Omani). No authentication—all data is public. Users can view, create, edit any application, and export as print-ready PDF.

**Tech Stack:** Node.js, Express, EJS templates, Prisma ORM, PostgreSQL, Puppeteer, Tailwind CSS

## Architecture Patterns

### Single-Table JSONB Design
All 3 form types share one `applications` table with type discriminator and JSONB data column:
```prisma
model Application {
  id        String          @id @default(uuid())
  type      ApplicationType  // rejoining | leave_expats | leave_omani
  data      Json             // flexible form payload
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt
}
```

**Why:** Form structures differ significantly. JSONB avoids schema fragmentation while enabling PostgreSQL JSON queries for filters.

### Server-Rendered + RESTful Routes
- **Human pages:** `GET /`, `GET /forms/:type`, `GET /forms/:type/new`, `GET /forms/:type/:id/edit`
- **CRUD:** `POST /forms/:type`, `POST /forms/:type/:id`
- **PDF:** `GET /forms/:type/:id/pdf` (ephemeral generation, no storage)

EJS templates render all UI server-side. No SPA framework.

### PDF Generation Flow
1. Load application data from Prisma
2. Render EJS PDF template (`views/pdf/{type}.ejs`) with data
3. Puppeteer converts HTML → PDF in-memory
4. Stream as download, no disk persistence
5. Template MUST match original Word/PDF layout exactly (logo, tables, spacing)

## Critical Conventions

### Form Type Routing
`:type` parameter must match enum: `rejoining`, `leave-expats`, `leave-omani`
- Controller uses `type` to determine which EJS partial and PDF template to load
- Invalid types → 404 with home link

### Data Storage Pattern
Store form fields in `data` JSON using stable camelCase keys:
```json
{
  "employeeName": "John Doe",
  "employeeId": "12345",
  "department": "HR",
  "leaveStart": "2025-11-01",
  "leaveEnd": "2025-11-10"
}
```

### Mapping Word/PDF Fields to JSONB
When implementing forms, extract fields from original Word/PDF documents following these rules:

**Field Naming Convention:**
- Convert field labels to camelCase: "Employee Name" → `employeeName`
- Use descriptive keys: "Date From" → `leaveStartDate`, "Date To" → `leaveEndDate`
- For signature fields: `employeeSignature`, `managerSignature`, `dateOfSignature`
- For checkbox groups: use arrays → `selectedDays: ["Monday", "Wednesday"]`

**Field Type Mapping:**
```javascript
// Text inputs → strings
"employeeName": "John Doe"

// Dates → ISO date strings (YYYY-MM-DD)
"leaveStartDate": "2025-11-01"

// Numbers → store as numbers
"totalLeaveDays": 10

// Checkboxes (single) → boolean
"isUrgent": true

// Radio buttons / Select → string value
"leaveType": "Annual Leave"

// Checkboxes (multiple) → array
"daysOfWeek": ["Monday", "Tuesday", "Friday"]

// Tables/repeating sections → array of objects
"previousLeaveRecords": [
  { "year": "2024", "days": 15, "type": "Annual" },
  { "year": "2023", "days": 10, "type": "Sick" }
]

// Signatures → string (signature text or base64 if drawing)
"employeeSignature": "John Doe"
```

**Implementation Steps:**
1. Open original Word/PDF in split view with code editor
2. List all fields/sections top to bottom
3. Create JSON schema comment in controller with expected fields
4. Map each field ensuring names are queryable for search filters
5. Add validation rules matching original form requirements (required, formats)

### Validation Strategy
- **Client-side:** HTML5 required/pattern attributes + minimal JS
- **Server-side:** Final authority in `formsController.js`
- Re-render form with errors + preserved values on failure

### Mobile-First UI
Tailwind CSS required. All layouts must work on phone first, then tablet/desktop. Use:
- Responsive grid/flex utilities
- Large touch targets (`py-3`, `px-4` minimum)
- Stacked cards on mobile (`flex-col md:flex-row`)

## Developer Workflows

### Local Setup
```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit DATABASE_URL to local Postgres

# Run migrations
npx prisma migrate dev

# Start dev server
npm run dev
```

### Adding a New Form Field
1. Update form partial: `views/forms/partials/{type}_form.ejs`
2. Update PDF template: `views/pdf/{type}.ejs`
3. Add validation in `formsController.js` create/update handlers
4. Update field in original Word/PDF mapping comments

### Testing PDF Output
```bash
# Generate test PDF via curl
curl http://localhost:3000/forms/rejoining/{uuid}/pdf -o test.pdf

# Verify against original Word/PDF template in /docs
```

### Prisma Workflow
```bash
# After schema changes
npx prisma migrate dev --name descriptive_name

# Regenerate client
npx prisma generate

# View data
npx prisma studio
```

## Key Files & Responsibilities

- **`routes/forms.js`**: All HTTP route definitions, delegates to controller
- **`controllers/formsController.js`**: Business logic (CRUD, validation, filters)
- **`services/pdfService.js`**: Puppeteer wrapper, handles HTML → PDF conversion
- **`views/forms/partials/{type}_form.ejs`**: Form field markup (shared by new/edit pages)
- **`views/pdf/{type}.ejs`**: Print templates matching original documents exactly
- **`prisma/schema.prisma`**: Single source of truth for database schema

## Common Patterns

### Filter Implementation (List Page)
Query params on `GET /forms/:type?search=term&from=2025-01-01&to=2025-12-31`

Prisma where clause:
```javascript
where: {
  type: formType,
  AND: [
    search ? {
      OR: [
        { data: { path: ['employeeName'], string_contains: search } },
        { data: { path: ['employeeId'], string_contains: search } },
        { data: { path: ['department'], string_contains: search } }
      ]
    } : {},
    from ? { createdAt: { gte: new Date(from) } } : {},
    to ? { createdAt: { lte: new Date(to) } } : {}
  ]
}
```

### Save & Export Pattern
Both "Save & Close" and "Save & Export PDF" buttons POST to same endpoint. Controller checks `action` field:
```javascript
if (req.body.action === 'export') {
  res.redirect(`/forms/${type}/${application.id}/pdf`);
} else {
  res.redirect(`/forms/${type}`);
}
```

### Error Handling
- Missing records → 404 page with back-to-home link
- Validation errors → re-render form with `errors` object and `formData` to preserve input
- PDF failures → catch Puppeteer errors, show retry message

## Security (Public Context)

Even without auth, protect against:
- **SQL injection:** Use Prisma parameterized queries only
- **XSS:** EJS auto-escapes by default, use `<%- %>` only for known-safe HTML
- **CSRF:** Express CSRF middleware on POST routes
- **Rate limiting:** Basic express-rate-limit on write endpoints (10 req/min per IP)

## Deployment Checklist

1. Set `DATABASE_URL` in production .env
2. Run `npx prisma migrate deploy`
3. Ensure Puppeteer dependencies installed (Chrome in container)
4. Verify logo image in `/public/images/logo.png`
5. Test all 3 PDF exports match original templates
6. Confirm mobile responsiveness on real device

## What NOT to Do

- ❌ Don't add authentication—requirements explicitly state public access
- ❌ Don't store PDFs on disk—generate on-demand only
- ❌ Don't create separate tables per form type—use single `applications` table
- ❌ Don't use client-side framework—server-rendered EJS only
- ❌ Don't deviate from original form layouts in PDF templates
