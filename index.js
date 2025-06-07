from pathlib import Path

codigo = """
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

  // Acesso à página de login
  await page.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile', { waitUntil: 'load' });

  // Preenche login
  await page.waitForSelector('input[name="username"]', { timeout: 60000 });
  await page.fill('input[name="username"]', 'juridicomgmultas@gmail.com');
  await page.click('#kc-login');

  // Preenche senha
  await page.waitForSelector('input[name="password"]', { timeout: 60000 });
  await page.fill('input[name="password"]', 'Mg.12345@');
  await page.click('#kc-login');

  // Aguarda login
  await page.waitForNavigation({ waitUntil: 'load' });
  console.log('✅ Login feito com sucesso. Aguardando página principal...');

  await page.waitForTimeout(5000); // Aguarda a dashboard carregar

  // Role até o fim da página (para garantir que os botões apareçam)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(3000);

  // Clica em "Databases"
  await page.click('text=Databases');
  await page.waitForTimeout(5000);

  // Clica em "Clientes"
  await page.click('text=Clientes');
  await page.waitForTimeout(5000);

  // Verifica se o botão "Criar registro" está visível
  const botaoCriar = await page.locator('button:has-text("Criar registro")').isVisible();

  if (botaoCriar) {
    console.log('🟢 Botão "Criar registro" encontrado.');
  } else {
    console.log('🔴 Botão "Criar registro" NÃO encontrado.');
  }

  await browser.close();
})();

app.listen(PORT, () => {
  console.log(`🖥️ Servidor disponível em http://localhost:${PORT}`);
});
"""

Path("/mnt/data/index.js").write_text(codigo, encoding="utf-8")
"/mnt/data/index.js"

