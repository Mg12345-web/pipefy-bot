const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🔐 Acessando o login do Pipefy...');
  await page.goto('https://app.pipefy.com/login', { waitUntil: 'load' });

  // Espera o campo de e-mail aparecer
  await page.waitForSelector('input[name=email]', { timeout: 60000 });

  await page.fill('input[name=email]', 'juridicomgmultas@gmail.com');
  await page.click('button[type=submit]');
  await page.waitForTimeout(1500);

  await page.fill('input[name=password]', 'Mg.12345@');
  await page.click('button[type=submit]');
  await page.waitForNavigation({ waitUntil: 'networkidle' });

  console.log('✅ Login feito com sucesso. Indo para o Pipe...');
  await page.goto('https://app.pipefy.com/pipes/304722696');
  await page.waitForTimeout(3000);

  await page.screenshot({ path: 'print_pipefy.png' });
  console.log('📸 Print tirado com sucesso!');

  await browser.close();
})();
