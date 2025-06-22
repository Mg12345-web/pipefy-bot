const multer = require('multer');
const path = require('path');
const fs = require('fs');

const pastaUploads = path.resolve(__dirname, '../uploads');

if (!fs.existsSync(pastaUploads)) {
  fs.mkdirSync(pastaUploads, { recursive: true });
}

const nomesFixos = {
  cnh: 'cnh',
  procuracao: 'procuracao',
  contrato: 'contrato',
  crlv: 'crlv',
  autuacoes: 'autuacao'
};

const tiposPermitidos = ['.pdf', '.jpg', '.jpeg', '.png'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Extrai a AIT do primeiro item, se vier múltiplas autuações
    let ait = '';
    if (Array.isArray(req.body?.autuacoes) && req.body.autuacoes.length > 0) {
      ait = req.body.autuacoes[0]?.ait || '';
    } else {
      ait = req.body?.ait || req.body?.dados?.AIT || '';
    }

    // Usa AIT como nome da subpasta, ou um fallback genérico
    const identificador = ait.toString().trim() || `sem_ait_${Date.now()}`;
    const destinoCliente = path.join(pastaUploads, identificador);

    fs.mkdirSync(destinoCliente, { recursive: true });

    req._uploadFolder = destinoCliente; // para deletar depois
    cb(null, destinoCliente);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = nomesFixos[file.fieldname] || 'arquivo';

    if (!req._fileCount) req._fileCount = {};
    req._fileCount[file.fieldname] = (req._fileCount[file.fieldname] || 0) + 1;

    const count = req._fileCount[file.fieldname];
    const nomeFinal = (count > 1) ? `${base}_${count}${ext}` : `${base}${ext}`;
    cb(null, nomeFinal);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (tiposPermitidos.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('❌ Tipo de arquivo não permitido. Apenas PDF, JPG, JPEG e PNG são aceitos.'));
  }
};

const upload = multer({ storage, fileFilter });

module.exports = upload;
