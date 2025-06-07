const { chromium } = require('playwright');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🔐 Acessando o login real do Pipefy...');
  await page.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile', { waitUntil: 'load' });

  // Preenche usuário
  await page.waitForSelector('input[name="username"]', { timeout: 60000 });
  await page.fill('input[name="username"]', 'juridicomgmultas@gmail.com');

  // Clica em "Continuar"
  await page.waitForSelector('#kc-login', { timeout: 60000 });
  await page.click('#kc-login');

  // Preenche senha
  await page.waitForSelector('input[name="password"]', { timeout: 60000 });
  await page.fill('input[name="password"]', 'Mg.12345@');

  // Clica em "Login"
  await page.waitForSelector('#kc-login', { timeout: 60000 });
  await page.click('#kc-login');

  // Aguarda redirecionamento após login
  await page.waitForNavigation({ waitUntil: 'load', timeout: 60000 });

  console.log('✅ Login feito com sucesso. Acessando o Pipe...');

  // Vai direto para o Pipe
  await page.goto('https://app.pipefy.com/pipes/304722696');
  await page.waitForTimeout(3000);

  // Tenta ler algum conteúdo visível no painel do Pipefy
  const texto = await page.textContent('h1, h2, .title, .pipe-name').catch(() => '❓ Nenhum texto visível encontrado');

  console.log('🧠 Texto lido após login:');
  console.log(texto);

  await browser.close();
})();

// Servidor Express simples
app.get('/', (req, res) => {
  res.send(`<h2>✅ Robô executado com sucesso</h2><p>Verifique os logs para ver o conteúdo da página após login.</p>`);
});

app.listen(PORT, () => {
  console.log(`🖥️ Servidor disponível em http://localhost:${PORT}`);
});
