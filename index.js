const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true }); // ou false para ver
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🔐 Acessando o login real do Pipefy...');
  await page.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile', { waitUntil: 'load' });

  // Passo 1: Preenche e-mail
  await page.waitForSelector('input[name="username"]', { timeout: 60000 });
  await page.fill('input[name="username"]', 'juridicomgmultas@gmail.com');

  await page.waitForSelector('button:has-text("Continuar")', { timeout: 60000 });
  await page.click('button:has-text("Continuar")');

  // Passo 2: Espera o campo de senha
  await page.waitForSelector('input[name="password"]', { timeout: 60000 });
  await page.fill('input[name="password"]', 'Mg.12345@');

  await page.waitForSelector('button:has-text("Acessar o Pipefy")', { timeout: 60000 });
  await page.click('button:has-text("Acessar o Pipefy")');

  // Espera redirecionar
  await page.waitForNavigation({ waitUntil: 'networkidle' });

  console.log('✅ Login feito com sucesso. Acessando o Pipe...');
  await page.goto('https://app.pipefy.com/pipes/304722696');
  await page.waitForTimeout(3000);

  await page.screenshot({ path: 'print_pipefy.png' });
  console.log('📸 Print tirado com sucesso!');

  await browser.close();
})();
