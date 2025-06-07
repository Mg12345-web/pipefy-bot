const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  console.log('🔓 Abrindo navegador e acessando o login do Pipefy...');
  const browser = await chromium.launch({ headless: false }); // visível!
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://app.pipefy.com');

  console.log('🕒 Aguardando login manual...');
  try {
    await page.waitForSelector('button:has-text("Criar registro")', { timeout: 0 }); // sem limite de tempo
    console.log('✅ Login detectado com sucesso. Acessando Pipe...');
  } catch (err) {
    console.error('❌ Erro ao detectar login:', err);
    await browser.close();
    return;
  }

  await page.screenshot({ path: 'print_pipefy.png' });
  console.log('📸 Print tirado com sucesso!');

  await browser.close();
})();
