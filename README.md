# Civic AI

A lightweight Node.js civic reporting app for:

- Complaints
- Citizen queries
- SOS emergency alerts

It includes:

- Public submission page (`/`)
- Admin dashboard (`/dashboard.html`)
- File-backed API (`data/reports.json`)

## Run locally

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

## API

- `POST /api/report` create report
- `GET /api/stats` aggregate counters
- `GET /api/reports` list all reports
- `PATCH /api/report/:id` toggle status (`pending`/`resolved`)

## Notes

- SOS can be auto-detected from emergency keywords in the message.
- Basic input hardening and output escaping are implemented to reduce malformed input and XSS risks.
