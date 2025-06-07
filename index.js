const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true }); // Mude para true se quiser invisível
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🔐 Acessando o login real do Pipefy...');
  await page.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile', { waitUntil: 'load' });

  // Espera o campo de e-mail aparecer e preenche
  await page.waitForSelector('input[name="username"]', { timeout: 60000 });
  await page.fill('input[name="username"]', 'juridicomgmultas@gmail.com');
  await page.click('button[type="submit"]');

  // Espera o campo de senha aparecer e preenche
  await page.waitForSelector('input[name="password"]', { timeout: 60000 });
  await page.fill('input[name="password"]', 'Mg.12345@');
  await page.click('button[type="submit"]');

  // Aguarda redirecionamento
  await page.waitForNavigation({ waitUntil: 'networkidle' });

  console.log('✅ Login feito com sucesso. Acessando o Pipe...');
  await page.goto('https://app.pipefy.com/pipes/304722696');
  await page.waitForTimeout(3000);

  await page.screenshot({ path: 'print_pipefy.png' });
  console.log('📸 Print tirado com sucesso!');

  await browser.close();
})();
