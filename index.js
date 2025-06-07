const { chromium } = require('playwright');
const express = require('express');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 8080;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🔐 Acessando o login real do Pipefy...');
  await page.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile');

  await page.waitForSelector('input[name="username"]', { timeout: 60000 });
  await page.fill('input[name="username"]', 'juridicomgmultas@gmail.com');

  await page.click('#kc-login');

  await page.waitForSelector('input[name="password"]', { timeout: 60000 });
  await page.fill('input[name="password"]', 'Mg.12345@');

  await page.click('#kc-login');

  await page.waitForNavigation({ waitUntil: 'load' });

  console.log('✅ Login feito com sucesso. Acessando o Pipe...');
  await page.goto('https://app.pipefy.com/pipes/304722696');
  await page.waitForTimeout(3000);

  await page.screenshot({ path: 'print_pipefy.png' });
  console.log('📸 Print tirado com sucesso!');
})();

// Servidor Express separado
app.get('/', (req, res) => {
  if (fs.existsSync('print_pipefy.png')) {
    res.send(`<h2>✅ Robô executado com sucesso</h2><p><a href="/print">📥 Clique aqui para baixar o print</a></p>`);
  } else {
    res.send(`<h2>⏳ O robô ainda está executando...</h2>`);
  }
});

app.get('/print', (req, res) => {
  const file = 'print_pipefy.png';
  if (fs.existsSync(file)) {
    res.download(file);
  } else {
    res.status(404).send('Print ainda não foi gerado.');
  }
});

app.listen(PORT, () => {
  console.log(`🖥️ Servidor disponível em http://localhost:${PORT}`);
});
