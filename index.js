const { chromium } = require('playwright');

(async () => {
  console.log('🔐 Iniciando login no Pipefy...');

  const browser = await chromium.launch({ headless: false }); // manter guia aberta
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🌐 Acessando página de login...');
  await page.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile');

  console.log('✉️ Preenchendo e-mail...');
  await page.fill('input[type="email"]', 'juridicomgmultas@gmail.com');
  await page.click('button[type="submit"]');

  console.log('🔐 Aguardando campo de senha...');
  await page.waitForSelector('input[type="password"]', { timeout: 10000 });

  console.log('🔑 Preenchendo senha...');
  await page.fill('input[type="password"]', 'Mg.12345@');

  console.log('🚪 Clicando para acessar o Pipefy...');
  await page.click('button[type="submit"]');

  console.log('✅ Login concluído. Robô em espera...');
})();
