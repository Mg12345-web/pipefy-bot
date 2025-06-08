const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const https = require('https');

let rodando = false;

(async () => {
  if (rodando) {
    console.log('⏳ Robô já está em execução. Abortando novo disparo.');
    return;
  }
  rodando = true;

  const statusCampos = [];
  const log = (msg) => {
    statusCampos.push(msg);
    console.log(msg);
  };

  try {
    log('🚀 Iniciando robô automaticamente após deploy...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    log('🔐 Acessando login do Pipefy...');
    await page.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile');
    await page.fill('input[name="username"]', 'juridicomgmultas@gmail.com');
    await page.click('#kc-login');
    await page.fill('input[name="password"]', 'Mg.12345@');
    await page.click('#kc-login');
    await page.waitForNavigation({ waitUntil: 'load' });

    log('📁 Acessando banco Clientes...');
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
        log(`✅ ${campo}`);
      } catch {
        log(`❌ ${campo}`);
      }
    }

    const arquivos = [
      { url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', local: 'cnh_teste.pdf', label: '* CNH' },
      { url: 'https://www.africau.edu/images/default/sample.pdf', local: 'proc_teste.pdf', label: '* Procuração' }
    ];

    for (let i = 0; i < arquivos.length; i++) {
      const file = path.resolve(__dirname, arquivos[i].local);
      await baixarArquivo(arquivos[i].url, file);
      if (fs.existsSync(file)) {
        await enviarArquivoPorOrdem(page, i, arquivos[i].label, file, log);
      } else {
        log(`❌ Arquivo ${arquivos[i].label} não encontrado`);
      }
    }

    await page.screenshot({ path: 'print_antes_clique.png' });

    const botoes = await page.$$('button');
    let clicado = false;
    for (let i = 0; i < botoes.length; i++) {
      const texto = await botoes[i].innerText();
      const box = await botoes[i].boundingBox();

      if (texto.trim() === 'Criar registro' && box && box.width > 200 && box.height > 30) {
        const pai = await botoes[i].evaluateHandle(el => el.closest('[role="dialog"]'));
        if (pai) {
          await botoes[i].scrollIntoViewIfNeeded();
          await botoes[i].click();
          await botoes[i].screenshot({ path: 'print_botao_clicado.png' });
          log(`✅ Botão ${i + 1} clicado com sucesso (modal)`);
          clicado = true;
          break;
        }
      }
    }

    if (!clicado) log('❌ Nenhum botão "Criar registro" válido encontrado.');

    for (let i = 0; i < 15; i++) {
      const aindaAberto = await page.$('input[placeholder="Nome Completo"]');
      if (!aindaAberto) break;
      await page.waitForTimeout(800);
    }

    const aindaAberto = await page.$('input[placeholder="Nome Completo"]');
    if (aindaAberto) {
      log('⚠️ Formulário ainda aberto. Registro pode não ter sido criado.');
    } else {
      log('✅ Registro criado com sucesso');
    }

    await page.screenshot({ path: 'registro_final.png' });
    fs.writeFileSync('status.txt', statusCampos.join('\n'));
    await browser.close();
    log('🏁 Robô finalizado.');
  } catch (err) {
    log('❌ Erro durante execução: ' + err.message);
  }

  rodando = false;
})();

function baixarArquivo(url, destino) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destino);
    https.get(url, response => {
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', err => {
      fs.unlink(destino, () => reject(err));
    });
  });
}

async function enviarArquivoPorOrdem(page, index, labelTexto, arquivoLocal, log) {
  try {
    const nomeArquivo = path.basename(arquivoLocal);
    const botoesUpload = await page.locator('button[data-testid="attachments-dropzone-button"]');
    const botao = botoesUpload.nth(index);

    await botao.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      botao.evaluate(el => el.click())
    ]);

    await fileChooser.setFiles(arquivoLocal);
    await page.waitForTimeout(2000);

    const sucessoUpload = await page.locator(`text="${nomeArquivo}"`).first().isVisible({ timeout: 7000 });
    if (sucessoUpload) {
      await page.waitForTimeout(15000);
      log(`✅ ${labelTexto} enviado`);
    } else {
      log(`❌ ${labelTexto} falhou (não visível após envio)`);
    }
  } catch {
    log(`❌ Falha ao enviar ${labelTexto}`);
  }
}
