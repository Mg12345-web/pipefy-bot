// ARQUIVO AJUSTADO: Login primeiro, depois execução simultânea de Clientes e CRLV

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

    // LOGIN ANTES DE ABRIR NOVAS ABAS
    const pageLogin = await context.newPage();
    console.log('🔐 Acessando login...');
    await pageLogin.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile');
    await pageLogin.fill('input[name="username"]', 'juridicomgmultas@gmail.com');
    await pageLogin.click('#kc-login');
    await pageLogin.fill('input[name="password"]', 'Mg.12345@');
    await pageLogin.click('#kc-login');
    await pageLogin.waitForNavigation({ waitUntil: 'load' });

    // AGORA O CONTEXTO ESTÁ LOGADO — PODE ABRIR AS DUAS ABAS
    const paginaCliente = await context.newPage();
    const paginaCRLV = await context.newPage();

    // EXECUÇÃO PARALELA
    await Promise.all([
      cadastrarCliente(paginaCliente),
      cadastrarCRLV(paginaCRLV)
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

// As funções cadastrarCliente, cadastrarCRLV, baixarArquivo, enviarArquivoPorOrdem, etc., permanecem inalteradas
