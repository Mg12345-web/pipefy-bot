// ARQUIVO ATUALIZADO: Cadastro simultâneo de Cliente e CRLV (SEM LINK DIRETO PARA CRLV)

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const https = require('https');
const os = require('os');
const express = require('express');

const LOCK_PATH = path.join(os.tmpdir(), 'pipefy_robo.lock');
const statusCampos = [];

async function executarRobo() {
  console.log('🧠 Função executarRobo() iniciada...');
  try {
    const lockFd = fs.openSync(LOCK_PATH, 'wx');
    fs.writeFileSync(lockFd, String(process.pid));
    fs.closeSync(lockFd);
    console.log(`🔒 Lock criado com sucesso em: ${LOCK_PATH} (PID: ${process.pid})`);
  } catch (e) {
    console.log('⛔ Robô já está em execução. Lock já existe.');
    return;
  }

  try {
    console.log('🔄 Iniciando robô automaticamente após deploy...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();

    const pageLogin = await context.newPage();
    console.log('🔐 Acessando login...');
    await pageLogin.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile');
    await pageLogin.fill('input[name="username"]', 'juridicomgmultas@gmail.com');
    await pageLogin.click('#kc-login');
    await pageLogin.fill('input[name="password"]', 'Mg.12345@');
    await pageLogin.click('#kc-login');
    await pageLogin.waitForNavigation({ waitUntil: 'load' });

    const paginaCliente = await context.newPage();
    const paginaCRLV = await context.newPage();

    await Promise.all([
      cadastrarCliente(paginaCliente),
      cadastrarCRLVManual(paginaCRLV)
    ]);

    await browser.close();
  } catch (err) {
    const msg = '❌ Erro durante execução: ' + err.message;
    console.log(msg);
    statusCampos.push(msg);
    fs.writeFileSync('status.txt', statusCampos.join('\n'));
  }

  if (fs.existsSync(LOCK_PATH)) fs.unlinkSync(LOCK_PATH);
}

async function cadastrarCRLVManual(page) {
  console.log('📄 Acessando banco CRLV via navegação manual...');
  await page.goto('https://app.pipefy.com/');
  await page.waitForTimeout(2000);
  await page.getByText('Databases', { exact: true }).click();
  await page.getByText('CRLV', { exact: true }).click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'crlv_manual_01_tela_banco.png' });

  try {
    await page.waitForSelector('button:has-text("Criar registro")', { timeout: 10000 });
    await page.click('button:has-text("Criar registro")');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'crlv_manual_02_formulario.png' });
  } catch (err) {
    console.log('❌ Erro ao abrir formulário CRLV manual');
    statusCampos.push('❌ Erro ao abrir formulário CRLV manual');
    return;
  }

  // ... (mantém preenchimento e upload como já está no seu código anterior)
}

// As demais funções (cadastrarCliente, baixarArquivo, enviarArquivoPorOrdem, express app) continuam iguais
