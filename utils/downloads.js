const fs = require('fs');
const https = require('https');

/**
 * Baixa um arquivo de uma URL e o salva em um destino local.
 * @param {string} url - A URL do arquivo a ser baixado.
 * @param {string} destino - O caminho completo para salvar o arquivo.
 * @returns {Promise<void>} Uma promessa que resolve quando o download é concluído.
 */
function baixarArquivo(url, destino) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destino);
    https.get(url, response => {
      if (response.statusCode >= 400) {
        fs.unlink(destino, () => reject(new Error(`Falha ao baixar arquivo: Status ${response.statusCode}`)));
        return;
      }
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', err => {
      fs.unlink(destino, () => reject(err));
    });
  });
}

module.exports = { baixarArquivo };
