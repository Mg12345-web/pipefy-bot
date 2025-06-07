const { chromium } = require('playwright');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🔐 Acessando o login real do Pipefy...');
  await page.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile', { waitUntil: 'load' });

  await page.waitForSelector('input[name="username"]', { timeout: 60000 });
  await page.fill('input[name="username"]', 'juridicomgmultas@gmail.com');

  await page.waitForSelector('#kc-login', { timeout: 60000 });
  await page.click('#kc-login');

  await page.waitForSelector('input[name="password"]', { timeout: 60000 });
  await page.fill('input[name="password"]', 'Mg.12345@');

  await page.waitForSelector('#kc-login', { timeout: 60000 });
  await page.click('#kc-login');

  await page.waitForNavigation({ waitUntil: 'load' });

  console.log('✅ Login feito com sucesso. Acessando o Pipe...');
  await page.goto('https://app.pipefy.com/pipes/304722696');
  await page.waitForTimeout(3000);

  await page.screenshot({ path: 'print_pipefy.png' });
  console.log('📸 Print tirado com sucesso!');

  await browser.close();

  // Após fechar o navegador, inicia o servidor Express
  app.get('/', (req, res) => {
    res.send(`<h2>✅ Robô executado com sucesso</h2><p><a href="/print">📥 Clique aqui para baixar o print</a></p>`);
  });

  app.get('/print', (req, res) => {
    res.download('print_pipefy.png');
  });

  app.listen(PORT, () => {
    console.log(`🖥️ Servidor disponível em http://localhost:${PORT}`);
  });
})();
