const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');
const os = require('os');

const app = express();
app.use(express.json({ limit: '20mb' }));

// ── Helper: find Chrome executable ──────────────────────────
function getChromePath() {
  // 1. Explicit env variable
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  // 2. Render.com cache path
  const renderPath = '/opt/render/.cache/puppeteer/chrome/linux-127.0.6533.88/chrome-linux64/chrome';
  try {
    require('fs').accessSync(renderPath);
    return renderPath;
  } catch (e) {}

  // 3. Try puppeteer built-in executablePath
  try {
    return puppeteer.executablePath();
  } catch (e) {}

  // 4. Common Linux paths
  const linuxPaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium'
  ];
  for (const p of linuxPaths) {
    try {
      require('fs').accessSync(p);
      return p;
    } catch (e) {}
  }

  return null;
}

// ── Routes ───────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    service: 'Thedico PDF Service',
    status: 'running',
    version: '2.0.0',
    chromePath: getChromePath() || 'not found'
  });
});

app.get('/health', (req, res) => {
  const chromePath = getChromePath();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    chromePath: chromePath || 'not found',
    chromeFound: !!chromePath
  });
});

app.post('/generate-pdf', async (req, res) => {
  const { html, filename, options } = req.body;

  if (!html) {
    return res.status(400).json({ error: 'html is required' });
  }

  const chromePath = getChromePath();
  console.log(`🔍 Using Chrome: ${chromePath}`);

  if (!chromePath) {
    return res.status(500).json({
      error: 'Chrome not found. Run: npx puppeteer browsers install chrome'
    });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: chromePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-zygote',
        '--disable-extensions',
        '--disable-software-rasterizer'
      ],
      headless: 'new',
      timeout: 30000
    });

    const page = await browser.newPage();

    await page.setViewport({ width: 1280, height: 900 });

    // Block media to speed up
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

    // Wait for Chart.js + Google Fonts
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
  console.log(`Chrome path: ${getChromePath() || 'not found'}`);
});
