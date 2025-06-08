const { chromium } = require('playwright');

(async () => {
  console.log('🔐 Iniciando login com sessão persistente...');

  const browser = await chromium.launchPersistentContext('./session', {
    headless: true, // Railway exige headless
  });

  const page = await browser.newPage();

  await page.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile');

  await page.fill('input[type="email"]', 'juridicomgmultas@gmail.com');
  await page.click('button[type="submit"]');

  await page.waitForSelector('input[type="password"]', { timeout: 10000 });
  await page.fill('input[type="password"]', 'Mg.12345@');
  await page.click('button[type="submit"]');

  await page.waitForNavigation();
  console.log('✅ Login efetuado com sucesso. Sessão salva.');

  // NÃO fecha o browser para manter a sessão ativa (opcional)
  // await browser.close();
})();
