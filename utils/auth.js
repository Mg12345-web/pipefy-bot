/**
 * Realiza o login no Pipefy com Playwright.
 * @param {import('playwright').Page} page - Instância da página do navegador.
 * @param {Function} log - Função para registrar etapas no console ou na resposta HTTP.
 */
async function loginPipefy(page, log) {
  log('🔐 Iniciando login no Pipefy...');

  // ⚠️ Em produção, substitua por variáveis de ambiente seguras.
  const username = process.env.PIPEFY_USERNAME || 'juridicomgmultas@gmail.com';
  const password = process.env.PIPEFY_PASSWORD || 'Mg.12345@';

  await page.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile');
  
  await page.fill('input[name="username"]', username);
  await page.click('#kc-login');

  await page.fill('input[name="password"]', password);
  await page.click('#kc-login');

  await page.waitForNavigation({ waitUntil: 'load' });

  log('✅ Login realizado com sucesso.');
}

module.exports = { loginPipefy };
