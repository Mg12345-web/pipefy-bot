const { chromium } = require('playwright');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

(async () => {
  console.log(`🖥️ Servidor disponível em http://localhost:${PORT}`);
  console.log('🔐 Acessando o login do Pipefy...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile');

  await page.waitForSelector('input[name="username"]', { timeout: 60000 });
  await page.fill('input[name="username"]', 'juridicomgmultas@gmail.com');
  await page.click('#kc-login');

  await page.waitForSelector('input[name="password"]', { timeout: 60000 });
  await page.fill('input[name="password"]', 'Mg.12345@');
  await page.click('#kc-login');

  await page.waitForNavigation({ waitUntil: 'load' });
  console.log('✅ Login feito com sucesso.');

  // Role até o menu Databases e clique
  await page.evaluate(() => window.scrollBy(0, 1000));
  await page.waitForSelector('text=Databases', { timeout: 60000 });
  await page.click('text=Databases');

  // Aguarde carregar a lista e clique em "Clientes"
  await page.waitForSelector('text=Clientes', { timeout: 60000 });
  await page.click('text=Clientes');

  // Espera o botão “Criar registro”
  const botaoCriar = await page.waitForSelector('button:has-text("Criar registro")', { timeout: 60000 });

  if (botaoCriar) {
    console.log('🟢 Botão "Criar registro" encontrado com sucesso.');

    // Clica no botão
    await botaoCriar.click();
    await page.waitForTimeout(4000); // Aguarda a nova tela carregar

    // Lê o conteúdo da tela após o clique
    const conteudo = await page.content();
    console.log('🧠 Conteúdo após clicar em "Criar registro":\n');
    console.log(conteudo);
  } else {
    console.log('🔴 Botão "Criar registro" não encontrado.');
  }

  await browser.close();
})();

app.get('/', (req, res) => {
  res.send(`<h2>✅ Robô executado</h2>`);
});

app.listen(PORT, () => {
  console.log(`🖥️ Servidor escutando em http://localhost:${PORT}`);
});
