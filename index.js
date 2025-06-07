const { chromium } = require('playwright');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🔓 Abrindo navegador e acessando o login do Pipefy...');
  await page.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile', { waitUntil: 'load' });

  await page.waitForSelector('input[name="username"]', { timeout: 60000 });
  await page.fill('input[name="username"]', 'juridicomgmultas@gmail.com');

  await page.waitForSelector('#kc-login', { timeout: 60000 });
  await page.click('#kc-login');

  await page.waitForSelector('input[name="password"]', { timeout: 60000 });
  await page.fill('input[name="password"]', 'Mg.12345@');

  await page.waitForSelector('#kc-login', { timeout: 60000 });
  await page.click('#kc-login');

  console.log('⏳ Aguardando 1 minuto após o login...');
  await page.waitForTimeout(60000); // espera 1 minuto

  console.log('✅ Login feito com sucesso. Acessando o Pipe...');

  await page.goto('https://app.pipefy.com/pipes/304722696', { waitUntil: 'domcontentloaded' });

  const texto = await page.textContent('body');
  console.log('🧠 Texto lido após login:\n');
  console.log(texto);

  await browser.close();
})();

// Servidor para visualização
app.get('/', (req, res) => {
  res.send(`<h2>✅ Robô executado com sucesso</h2><p>Confira o terminal para o conteúdo da página após login.</p>`);
});

app.listen(PORT, () => {
  console.log(`🖥️ Servidor disponível em http://localhost:${PORT}`);
});
