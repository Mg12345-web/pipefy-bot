const { chromium } = require('playwright');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🔐 Acessando a página de login do Pipefy...');
  await page.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile', { waitUntil: 'load' });

  await page.waitForTimeout(2000); // Espera 2 segundos para a página carregar

  const textoPagina = await page.evaluate(() => document.body.innerText);
  console.log('📄 Conteúdo da página de login:\n');
  console.log(textoPagina);

  await browser.close();
})();

// Servidor Express apenas como base
app.get('/', (req, res) => {
  res.send('<h2>🧪 Teste de leitura da página de login iniciado. Verifique os logs para ver o conteúdo carregado.</h2>');
});

app.listen(PORT, () => {
  console.log(`🖥️ Servidor disponível em http://localhost:${PORT}`);
});
