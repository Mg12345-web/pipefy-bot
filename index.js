const { chromium } = require('playwright');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

(async () => {
  console.log('🖥️ Servidor disponível em http://localhost:8080');
  console.log('🔓 Abrindo navegador e acessando o login do Pipefy...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile', { waitUntil: 'load' });

  await page.waitForSelector('input[name="username"]', { timeout: 60000 });
  await page.fill('input[name="username"]', 'juridicomgmultas@gmail.com');
  await page.click('#kc-login');

  await page.waitForSelector('input[name="password"]', { timeout: 60000 });
  await page.fill('input[name="password"]', 'Mg.12345@');
  await page.click('#kc-login');

  await page.waitForNavigation({ waitUntil: 'load' });
  console.log('✅ Login feito com sucesso. Aguardando para simular navegação humana...');

  await page.waitForTimeout(60000); // espera 1 minuto

  const content = await page.content();
  console.log('🧠 Texto lido após login:\n');
  console.log(content);

  await browser.close();
})();
