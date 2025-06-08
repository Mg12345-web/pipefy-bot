const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  process.stdout.write('🔄 Iniciando robô automaticamente após deploy...
');

  const statusCampos = [];
  let browser;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile');
    await page.fill('input[name="username"]', 'juridicomgmultas@gmail.com');
    await page.click('#kc-login');
    await page.fill('input[name="password"]', 'Mg.12345@');
    await page.click('#kc-login');
    await page.waitForNavigation({ waitUntil: 'load' });
    process.stdout.write('✅ Login realizado com sucesso\n');

    await page.getByText('Databases', { exact: true }).click();
    await page.getByText('Clientes', { exact: true }).click();
    await page.click('button:has-text("Criar registro")');
    process.stdout.write('📋 Formulário de cliente aberto\n');

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
        process.stdout.write(`✅ ${campo} preenchido\n`);
      } catch {
        statusCampos.push(`❌ ${campo}`);
        process.stdout.write(`❌ Falha ao preencher ${campo}\n`);
      }
    }

    // Seleção flexível de Estado Civil: Solteiro
    try {
      await page.getByText('Escolha uma opção').click();
      const opcoes = await page.$$('div[role="option"]');
      for (let opcao of opcoes) {
        const texto = await opcao.innerText();
        if (texto.toLowerCase().includes('solteiro')) {
          await opcao.click();
          statusCampos.push('✅ Estado civil selecionado: ' + texto);
          process.stdout.write(`✅ Estado civil: ${texto}\n`);
          break;
        }
      }
    } catch {
      statusCampos.push('❌ Estado civil não selecionado');
      process.stdout.write('❌ Falha ao selecionar Estado civil\n');
    }

    // Finalização
    await page.waitForTimeout(1000);
    const botoes = await page.$$('button');
    for (let i = 0; i < botoes.length; i++) {
      const texto = await botoes[i].innerText();
      const box = await botoes[i].boundingBox();
      if (texto.trim() === 'Criar registro' && box && box.width > 200) {
        await botoes[i].scrollIntoViewIfNeeded();
        await botoes[i].click();
        statusCampos.push(`✅ Botão Criar registro clicado`);
        process.stdout.write('✅ Clique no botão Criar registro\n');
        break;
      }
    }

    for (let i = 0; i < 15; i++) {
      const aindaAberto = await page.$('input[placeholder="Nome Completo"]');
      if (!aindaAberto) break;
      await page.waitForTimeout(800);
    }

    const aindaAberto = await page.$('input[placeholder="Nome Completo"]');
    if (aindaAberto) {
      statusCampos.push('⚠️ Formulário ainda aberto. Registro pode não ter sido criado.');
    } else {
      statusCampos.push('✅ Registro criado com sucesso');
    }

    fs.writeFileSync('status.txt', statusCampos.join('\n'));
    process.stdout.write('\n📄 Execução concluída:\n' + statusCampos.join('\n') + '\n');
    await browser.close();
  } catch (err) {
    statusCampos.push('❌ Erro durante execução: ' + err.message);
    fs.writeFileSync('status.txt', statusCampos.join('\n'));
    process.stdout.write('❌ Erro: ' + err.message + '\n');
    if (browser) await browser.close();
  }
})();
