const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json({ limit: '20mb' }));

app.get('/', (req, res) => {
  res.json({
    service: 'Thedico PDF Service',
    status: 'running',
    version: '1.0.0'
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/generate-pdf', async (req, res) => {
  const { html, filename, options } = req.body;

  if (!html) {
    return res.status(400).json({ error: 'html is required' });
  }

  let browser;
  try {
    const launchOptions = {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-zygote'
      ],
      headless: 'new'
    };

    // Use env variable if set (Render.com)
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();

    await page.setViewport({ width: 1280, height: 900 });

    // Block unnecessary resources
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (request.resourceType() === 'media') {
        request.abort();
      } else {
        request.continue();
      }
    });

    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    // Wait for charts and fonts
    await new Promise(resolve => setTimeout(resolve, 3000));

    const pdf = await page.pdf({
      format: options?.format || 'A4',
      printBackground: true,
      margin: {
        top: options?.marginTop || '15mm',
        bottom: options?.marginBottom || '15mm',
        left: options?.marginLeft || '10mm',
        right: options?.marginRight || '10mm'
      }
    });

    const name = filename || `Thedico_Report_${Date.now()}.pdf`;

    console.log(`✅ PDF generated: ${name} (${pdf.length} bytes)`);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Content-Length': pdf.length,
      'Access-Control-Allow-Origin': '*'
    });

    res.send(pdf);

  } catch (err) {
    console.error('❌ PDF error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Thedico PDF Service running on port ${PORT}`);
});
