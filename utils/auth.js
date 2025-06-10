/**
 * Realiza o login no Pipefy.
 * @param {import('playwright').Page} page - A instância da página do Playwright.
 * @param {Function} log - Função de log.
 * @returns {Promise<void>}
 */
async function loginPipefy(page, log) {
  log('🔐 Fazendo login...');
  // ATENÇÃO: Credenciais hardcoded são um risco de segurança.
  // Em produção, use variáveis de ambiente ou um gerenciador de segredos.
  const username = 'juridicomgmultas@gmail.com'; // process.env.PIPEFY_USERNAME
  const password = 'Mg.12345@'; // process.env.PIPEFY_PASSWORD

  await page.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile');
  await page.fill('input[name="username"]', username);
  await page.click('#kc-login');
  await page.fill('input[name="password"]', password);
  await page.click('#kc-login');
  await page.waitForNavigation({ waitUntil: 'load' });
  log('✅ Login realizado com sucesso.');
}

module.exports = { loginPipefy };
