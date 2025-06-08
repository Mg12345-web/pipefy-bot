// robo_login.js - Login com logs visíveis no Railway

const { chromium } = require('playwright');

let browser, context, page;

async function iniciarLogin() {
  console.log('🔐 Iniciando robô de login no Pipefy...');

  browser = await chromium.launch({ headless: true });
  console.log('🧠 Navegador iniciado');

  context = await browser.newContext();
  page = await context.newPage();
  console.log('📄 Nova aba aberta');

  console.log('🌐 Acessando página de login...');
  await page.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile');

  console.log('📥 Preenchendo e-mail...');
  await page.fill('input[name="username"]', 'juridicomgmultas@gmail.com');

  console.log('🔘 Avançando para o campo de senha...');
  await page.click('#kc-login');

  console.log('🔐 Preenchendo senha...');
  await page.fill('input[name="password"]', 'Mg.12345@');

  console.log('📤 Enviando login...');
  await page.click('#kc-login');

  console.log('⏳ Aguardando carregamento pós-login...');
  await page.waitForNavigation({ waitUntil: 'load' });

  console.log('✅ Login realizado com sucesso!');
}

function getPage() {
  return page;
}

function getContext() {
  return context;
}

function getBrowser() {
  return browser;
}

module.exports = {
  iniciarLogin,
  getPage,
  getContext,
  getBrowser
};
