const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json({ limit: '20mb' }));

// ─── Health Check ───────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    service: 'Thedico PDF Service',
    status: 'running',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      generatePdf: 'POST /generate-pdf'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── PDF Generation ─────────────────────────────────────────
app.post('/generate-pdf', async (req, res) => {
  const { html, filename, options } = req.body;

  if (!html) {
    return res.status(400).json({ error: 'html field is required' });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1280,900'
      ],
      headless: 'new'
    });

    const page = await browser.newPage();

    // Set viewport
    await page.setViewport({ width: 1280, height: 900 });

    // Block unnecessary resources to speed up
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const type = request.resourceType();
      if (type === 'media') {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Load HTML content
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    // Wait for Chart.js + Google Fonts to fully render
    await new Promise(resolve => setTimeout(resolve, 3000));

    // PDF options
    const pdfOptions = {
      format: options?.format || 'A4',
      printBackground: true,
      margin: {
        top: options?.marginTop || '15mm',
        bottom: options?.marginBottom || '15mm',
        left: options?.marginLeft || '10mm',
        right: options?.marginRight || '10mm'
      }
    };

    const pdf = await page.pdf(pdfOptions);

    const name = filename || `Thedico_Report_${Date.now()}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Content-Length': pdf.length,
      'Access-Control-Allow-Origin': '*'
    });

    res.send(pdf);

    console.log(`✅ PDF generated: ${name} (${pdf.length} bytes)`);

  } catch (err) {
    console.error('❌ PDF generation error:', err.message);
    res.status(500).json({
      error: err.message,
      hint: 'Check if HTML is valid and external resources are accessible'
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

// ─── Start Server ────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║   Thedico PDF Service — Running       ║
  ║   Port: ${PORT}                          ║
  ║   Health: GET /health                 ║
  ║   PDF:    POST /generate-pdf          ║
  ╚═══════════════════════════════════════╝
  `);
});
