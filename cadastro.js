const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Iniciando robô de cadastro (sessão persistente)...');

  const browser = await chromium.launchPersistentContext('./session', {
    headless: true
  });

  const page = await browser.newPage();

  await page.goto('https://app.pipefy.com/apollo_databases/304722696');

  await page.waitForSelector('button:has-text("Criar registro")', { timeout: 15000 });
  await page.click('button:has-text("Criar registro")');

  console.log('📋 Cadastro iniciado (adicione os campos de preenchimento aqui)');

  // Exemplo:
  // await page.fill('input[placeholder="Nome"]', 'Fulano de Tal');

  await browser.close();
})();
