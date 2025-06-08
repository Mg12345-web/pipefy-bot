// robo_login.js - Responsável apenas por login e manter a sessão aberta

const { chromium } = require('playwright');

let browser, context, page;

async function iniciarLogin() {
  console.log('🔐 Iniciando login no Pipefy...');

  browser = await chromium.launch({ headless: true });
  context = await browser.newContext();
  page = await context.newPage();

  await page.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile');
  await page.fill('input[name="username"]', 'juridicomgmultas@gmail.com');
  await page.click('#kc-login');
  await page.fill('input[name="password"]', 'Mg.12345@');
  await page.click('#kc-login');
  await page.waitForNavigation({ waitUntil: 'load' });

  console.log('✅ Login concluído com sucesso!');
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
