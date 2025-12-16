# TES Public Forms

Public-facing web application for digitizing 3 company application forms: Re-Joining, Leave Expats, and Leave Omani. No authentication required—all data is public. Users can view, create, edit any application, and export as print-ready PDF.

## Tech Stack

- **Backend:** Node.js + Express.js
- **View Engine:** EJS (server-rendered)
- **Database:** PostgreSQL with Prisma ORM
- **PDF Generation:** Puppeteer
- **Styling:** Tailwind CSS (CDN)

## Local Setup

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd TES-forms
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set your PostgreSQL connection string:
   ```
   DATABASE_URL="postgresql://username:password@localhost:5432/tes_forms?schema=public"
   ```

4. **Run database migrations**
   ```bash
   npx prisma migrate dev
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Access application**
   Open browser to `http://localhost:3000`

## Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with auto-reload
- `npm run build` - Production build (generates Prisma client + configures Puppeteer)
- `npm run prisma:migrate` - Run database migrations (development)
- `npm run prisma:deploy` - Apply migrations (production)
- `npm run prisma:generate` - Regenerate Prisma client
- `npm run prisma:studio` - Open Prisma Studio (database GUI)

## Application Structure

```
TES-forms/
├── controllers/          # Business logic
│   └── formsController.js
├── prisma/              # Database schema and migrations
│   └── schema.prisma
├── public/              # Static assets
│   ├── css/
│   └── images/
├── routes/              # Express routes
│   └── forms.js
├── services/            # Utilities
│   └── pdfService.js
├── views/               # EJS templates
│   ├── forms/
│   │   ├── partials/   # Form input partials
│   │   ├── list.ejs
│   │   ├── new.ejs
│   │   └── edit.ejs
│   ├── pdf/            # PDF export templates
│   ├── partials/       # Shared UI components
│   ├── layout.ejs
│   └── home.ejs
└── server.js           # Express app entry point
```

## Form Types

1. **Re-Joining** (`/forms/rejoining`)
2. **Leave Application - Expats** (`/forms/leave-expats`)
3. **Leave Application - Omani** (`/forms/leave-omani`)

## API Routes

- `GET /` - Home page
- `GET /forms/:type` - List all applications of a type
- `GET /forms/:type/new` - New application form
- `GET /forms/:type/:id/edit` - Edit existing application
- `POST /forms/:type` - Create new application
- `POST /forms/:type/:id` - Update existing application
- `GET /forms/:type/:id/pdf` - Export application as PDF

## Deployment

### Quick Deploy to Render (Free)

See [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md) for complete guide.

**Quick Steps:**
1. Push code to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Create "New Blueprint" → Connect repository
4. Render auto-detects `render.yaml` and provisions:
   - Web service with Puppeteer support
   - PostgreSQL database (1 GB free)
5. Set environment variables (DATABASE_URL copied from database)
6. Deploy (automatic migrations included)

**Your app will be live at:** `https://your-app-name.onrender.com`

### Manual Deployment (Any Host)

1. Set `DATABASE_URL` in production environment
2. Install Chromium dependencies for Puppeteer
3. Run `npm run build` (generates Prisma client)
4. Run `npx prisma migrate deploy` (apply migrations)
5. Verify logo image exists at `/public/images/Picture.png`
6. Set `NODE_ENV=production`
7. Start server: `npm start`

## License

ISC
