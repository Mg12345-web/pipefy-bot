const multer = require('multer');
const path = require('path');
const fs = require('fs');

const pastaUploads = path.resolve(__dirname, '../uploads');

// ✅ Garante que "uploads" seja uma pasta (e não um arquivo)
if (fs.existsSync(pastaUploads)) {
  const stat = fs.statSync(pastaUploads);
  if (!stat.isDirectory()) {
    fs.unlinkSync(pastaUploads); // remove o arquivo errado
    fs.mkdirSync(pastaUploads, { recursive: true }); // recria como pasta
  }
} else {
  fs.mkdirSync(pastaUploads, { recursive: true });
}

const nomesFixos = {
  cnh: 'cnh',
  procuracao: 'procuracao',
  contrato: 'contrato',
  crlv: 'crlv',
  autuacoes: 'autuacao'
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, pastaUploads),
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

const upload = multer({ storage });
module.exports = upload;
