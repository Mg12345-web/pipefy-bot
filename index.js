const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const https = require('https');

const os = require('os');
const LOCK_PATH = path.join(os.tmpdir(), 'pipefy_robo.lock');
const statusCampos = [];

async function executarRobo() {
  console.log('🧠 Função executarRobo() iniciada...');
  try {
  const lockFd = fs.openSync(LOCK_PATH, 'wx'); // wx = write, fail if exists
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
    const page = await context.newPage();

    console.log('🔐 Acessando login...');
    await page.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile');
    await page.fill('input[name="username"]', 'juridicomgmultas@gmail.com');
    await page.click('#kc-login');
    await page.fill('input[name="password"]', 'Mg.12345@');
    await page.click('#kc-login');
    await page.waitForNavigation({ waitUntil: 'load' });

    console.log('📁 Acessando banco Clientes...');
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

    // Preenchimento do campo "Estado Civil" de forma dinâmica
try {
  const estadoCivil = 'Solteiro(a)'; // Aqui você pode substituir por variável vinda da procuração

  await page.getByText('Escolha uma opção').click(); // Abre o dropdown
  await page.waitForTimeout(500); // Aguarda carregar as opções
  await page.getByText(estadoCivil, { exact: true }).click(); // Seleciona a opção

  console.log(`✅ Estado Civil (${estadoCivil}) selecionado`);
  statusCampos.push(`✅ Estado Civil (${estadoCivil})`);
} catch (e) {
  console.log(`❌ Erro ao selecionar Estado Civil: ${e.message}`);
  statusCampos.push('❌ Erro ao selecionar Estado Civil');
}

    const arquivos = [
      { url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', local: 'cnh_teste.pdf', label: '* CNH' },
      { url: 'https://www.africau.edu/images/default/sample.pdf', local: 'proc_teste.pdf', label: '* Procuração' }
    ];

    for (let i = 0; i < arquivos.length; i++) {
      const file = path.resolve(__dirname, arquivos[i].local);
      await baixarArquivo(arquivos[i].url, file);
      if (fs.existsSync(file)) {
        await enviarArquivoPorOrdem(page, i, arquivos[i].label, file, statusCampos);
      } else {
        statusCampos.push(`❌ Arquivo ${arquivos[i].label} não encontrado`);
      }
    }

    // Espera 5 segundos após envio da procuração
    console.log('⏳ Aguardando carregamento de anexos...');
    await page.waitForTimeout(5000);

    await page.screenshot({ path: 'print_antes_clique.png' });

    const botoes = await page.$$('button');
    for (let i = 0; i < botoes.length; i++) {
      const texto = await botoes[i].innerText();
      const box = await botoes[i].boundingBox();
      if (texto.trim() === 'Criar registro' && box && box.width > 200) {
        await botoes[i].scrollIntoViewIfNeeded();
        await botoes[i].click();
        await botoes[i].screenshot({ path: 'print_botao_clicado.png' });
        statusCampos.push(`✅ Botão ${i + 1} clicado com sucesso.`);
        console.log(`✅ Botão ${i + 1} clicado com sucesso.`);
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

    await page.screenshot({ path: 'registro_final.png' });
    fs.writeFileSync('status.txt', statusCampos.join('\n'));
    await browser.close();
  } catch (err) {
    const msg = '❌ Erro durante execução: ' + err.message;
    console.log(msg);
    statusCampos.push(msg);
    fs.writeFileSync('status.txt', statusCampos.join('\n'));
  }

  if (fs.existsSync(LOCK_PATH)) fs.unlinkSync(LOCK_PATH);
}

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

async function enviarArquivoPorOrdem(page, index, labelTexto, arquivoLocal, statusCampos) {
  try {
    const nomeArquivo = path.basename(arquivoLocal);
    const botoesUpload = await page.locator('button[data-testid="attachments-dropzone-button"]');
    const botao = botoesUpload.nth(index);

    await botao.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      botao.click()
    ]);

    await fileChooser.setFiles(arquivoLocal);
    await page.waitForTimeout(3000);

    const sucessoUpload = await page.locator(`text="${nomeArquivo}"`).first().isVisible({ timeout: 7000 });
    if (sucessoUpload) {
      await page.waitForTimeout(5000);
      console.log(`✅ ${labelTexto} enviado`);
      statusCampos.push(`✅ ${labelTexto} enviado`);
    } else {
      statusCampos.push(`❌ ${labelTexto} falhou (não visível após envio)`);
    }
  } catch {
    statusCampos.push(`❌ Falha ao enviar ${labelTexto}`);
  }
}

const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
  res.send(`
    <h2>🚀 Robô Pipefy</h2>
    <p>Para iniciar o robô, acesse: <a href="/start">/start</a></p>
  `);
});

app.get('/start', async (req, res) => {
  console.log('🌐 Rota /start acessada. Iniciando execução...');
  res.send('<h3>✅ Robô iniciado. Acompanhe os logs no Railway.</h3>');
  await executarRobo();
});

app.listen(PORT, () => {
  console.log(`🖥️ Servidor escutando em http://localhost:${PORT}`);
});
