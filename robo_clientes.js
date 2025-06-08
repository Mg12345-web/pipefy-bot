// robo_clientes.js - Usa a aba logada para cadastrar cliente

const path = require('path');
const fs = require('fs');
const https = require('https');

async function cadastrarClientes(page) {
  const statusCampos = [];
  console.log('📁 Acessando banco Clientes...');
  await page.getByText('Databases', { exact: true }).click();
  await page.getByText('Clientes', { exact: true }).click();
  await page.click('button:has-text("Criar registro")');

  const dados = {
    'Nome Completo': 'ADRIANO ANTONIO DE SOUZA',
    'CPF OU CNPJ': '414.746.148-41',
    'Estado Civil Atual': 'Solteiro',
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
      console.log(`✅ ${campo}`);
      statusCampos.push(`✅ ${campo}`);
    } catch {
      console.log(`❌ ${campo}`);
      statusCampos.push(`❌ ${campo}`);
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
      await enviarArquivoPorOrdem(page, i, arquivos[i].label, file, statusCampos);
    } else {
      statusCampos.push(`❌ Arquivo ${arquivos[i].label} não encontrado`);
    }
  }

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
      break;
    }
  }

  await page.waitForTimeout(2000);

  const aindaAberto = await page.$('input[placeholder="Nome Completo"]');
  if (aindaAberto) {
    statusCampos.push('⚠️ Formulário ainda aberto. Registro pode não ter sido criado.');
  } else {
    statusCampos.push('✅ Registro criado com sucesso');
  }

  await page.screenshot({ path: 'registro_final.png' });
  fs.writeFileSync('status.txt', statusCampos.join('\n'));
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

module.exports = cadastrarClientes;
