const { chromium } = require('playwright');
const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const app = express();
const PORT = process.env.PORT || 8080;

let rodando = false;

app.get('/', async (req, res) => {
  if (rodando) {
    process.stdout.write('⏳ Robô já está em execução. Aguardando finalizar...\n');
    return res.send('<h2>⚠️ Robô já está em execução. Aguarde a finalização.</h2>');
  }

  rodando = true;
  const statusCampos = [];

  try {
    process.stdout.write('🔄 Robô iniciado...\n');

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    process.stdout.write('🌐 Acessando página de login...\n');
    await page.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile');
    await page.fill('input[name="username"]', 'juridicomgmultas@gmail.com');
    await page.click('#kc-login');
    await page.fill('input[name="password"]', 'Mg.12345@');
    await page.click('#kc-login');
    await page.waitForNavigation({ waitUntil: 'load' });
    process.stdout.write('✅ Login realizado\n');

    await page.getByText('Databases', { exact: true }).click();
    await page.getByText('Clientes', { exact: true }).click();
    await page.click('button:has-text("Criar registro")');

    const dados = {
      'Nome Completo': 'ADRIANO ANTONIO DE SOUZA',
      'CPF OU CNPJ': '414.746.148-41',
      'Profissão': 'Vigilante',
      'Email': 'jonas1gui@gmail.com',
      'Número de telefone': '31988429016',
      'Endereço Completo': 'Rua Luzia de Jesus, 135, Jardim dos Comerciários, Ribeirão das Neves - MG'
    };

    for (const [campo, valor] of Object.entries(dados)) {
      try {
        const label = await page.getByLabel(campo);
        await label.scrollIntoViewIfNeeded();
        await label.fill(valor);
        statusCampos.push(`✅ ${campo}`);
        process.stdout.write(`✅ Campo preenchido: ${campo}\n`);
      } catch {
        statusCampos.push(`❌ ${campo}`);
        process.stdout.write(`❌ Erro ao preencher: ${campo}\n`);
      }
    }

    // Estado civil
    try {
      const dropdown = await page.locator('div[role="button"]:has-text("Escolha uma opção")').first();
      await dropdown.scrollIntoViewIfNeeded();
      await dropdown.click();
      await page.waitForTimeout(1000);
      const opcoes = await page.locator('div[role="option"]').all();
      for (const opcao of opcoes) {
        const texto = await opcao.textContent();
        if (texto && texto.toLowerCase().includes('solteiro')) {
          await opcao.click();
          statusCampos.push(`✅ Estado Civil selecionado: ${texto.trim()}`);
          process.stdout.write(`✅ Estado Civil selecionado: ${texto.trim()}\n`);
          break;
        }
      }
    } catch (err) {
      statusCampos.push('❌ Estado Civil não selecionado');
      process.stdout.write(`❌ Erro ao selecionar Estado Civil: ${err.message}\n`);
    }

    // Finalizar
    process.stdout.write('🚀 Clicando em Criar registro...\n');
    const botoes = await page.$$('button');
    for (let i = 0; i < botoes.length; i++) {
      const texto = await botoes[i].innerText();
      const box = await botoes[i].boundingBox();
      if (texto.trim() === 'Criar registro' && box && box.width > 200) {
        await botoes[i].scrollIntoViewIfNeeded();
        await botoes[i].click();
        statusCampos.push('✅ Registro enviado');
        process.stdout.write('✅ Botão Criar registro clicado\n');
        break;
      }
    }

    await page.waitForTimeout(5000);
    const aindaAberto = await page.$('input[placeholder="Nome Completo"]');
    if (aindaAberto) {
      statusCampos.push('⚠️ Formulário ainda aberto');
    } else {
      statusCampos.push('✅ Registro criado com sucesso');
    }

    await browser.close();
    process.stdout.write('🏁 Robô finalizado.\n');
    statusCampos.forEach(item => process.stdout.write(item + '\n'));
  } catch (err) {
    process.stdout.write(`❌ Erro durante execução: ${err.message}\n`);
  }

  rodando = false;
  res.send('<h2>✅ Robô executado (confira o log do deploy para detalhes)</h2>');
});

app.listen(PORT, () => {
  process.stdout.write(`🖥️ Servidor escutando em http://localhost:${PORT}\n`);
});
