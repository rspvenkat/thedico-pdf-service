# Thedico PDF Service

Common HTML → PDF generation service for all Thedico clients.

## Clients Using This
- RNTL.co — AI Agent reports
- Symatis — automation reports
- ZamZam — POS reports
- Any future Thedico client

## Endpoints

### GET /health
Returns service status.

### POST /generate-pdf
Converts HTML to PDF and returns binary file.

**Request Body:**
```json
{
  "html":     "<html>...</html>",
  "filename": "MyReport_12-04-2026.pdf",
  "options": {
    "format":        "A4",
    "marginTop":     "15mm",
    "marginBottom":  "15mm",
    "marginLeft":    "10mm",
    "marginRight":   "10mm"
  }
}
```

**Response:**
Binary PDF file (application/pdf)

## Deploy to Render.com (Free)

1. Push this repo to GitHub
2. Go to render.com → New → Web Service
3. Connect this GitHub repo
4. render.yaml auto-configures everything
5. Click Deploy
6. Get URL: https://thedico-pdf-service.onrender.com

## Use in n8n

**HTTP Request Node:**
```
Method:          POST
URL:             https://thedico-pdf-service.onrender.com/generate-pdf
Body Type:       JSON
Body:
{
  "html":     "{{ $json.output }}",
  "filename": "Report_{{ $now.toFormat('dd-MM-yyyy') }}.pdf"
}
Response Format: File
Output Field:    pdfData
```

**Gmail Node:**
```
Attachments: pdfData
```

## Notes
- First request after inactivity takes ~30 seconds (Render free tier cold start)
- Set n8n HTTP node timeout to 60 seconds
- Supports Chart.js, Google Fonts, dark themes
- Max HTML size: 20MB
