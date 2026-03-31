# Civic AI Flagship

A flagship-ready Node.js civic operations platform for:

- Complaints
- Citizen queries
- SOS emergency alerts
- Python-powered AI decision engine for chat guidance

It includes:

- Public flagship submission page (`/`)
- Flagship command dashboard (`/dashboard.html`)
- File-backed API (`data/reports.json`)

## Run locally

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

> Requires `python3` in your PATH for `/api/chat` intelligent decision mode.

## API

- `POST /api/report` create report
- `POST /api/chat` chat with Civic AI Flagship helper
- `GET /api/stats` aggregate counters
- `GET /api/reports` list all reports
- `PATCH /api/report/:id` toggle status (`pending`/`resolved`)

## Notes

- Civic AI Flagship auto-classifies each report as SOS, complaint, or query from the message text (manual selection is optional for API clients).
- Basic input hardening and output escaping are implemented to reduce malformed input and XSS risks.
