const { chromium } = require('playwright');

(async () => {
  console.log('🔐 Iniciando login com sessão persistente...');

  const context = await chromium.launchPersistentContext('./session', {
    headless: true
  });

  const page = await context.newPage();

  await page.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile');

  console.log('📨 Preenchendo e-mail...');
  await page.fill('input[name="username"]', 'juridicomgmultas@gmail.com');
  await page.click('#kc-login');

  console.log('🔒 Preenchendo senha...');
  await page.waitForSelector('input[name="password"]', { timeout: 10000 });
  await page.fill('input[name="password"]', 'Mg.12345@');
  await page.click('#kc-login');

  await page.waitForNavigation({ waitUntil: 'load' });
  console.log('✅ Login efetuado com sucesso. Sessão salva em ./session');

  // Mantém o navegador aberto se quiser reaproveitar no futuro
  // await context.close(); // Remova isso se quiser manter a aba viva
})();
