# Usa a imagem oficial do Playwright na versão compatível com seu projeto
FROM mcr.microsoft.com/playwright:v1.52.0-jammy

# Define o diretório de trabalho dentro do container
WORKDIR /app

# Instala o GraphicsMagick e ImageMagick (necessários para OCR de PDFs com imagem)
RUN apt-get update && apt-get install -y graphicsmagick imagemagick

# Copia apenas os arquivos de dependência para otimizar cache
COPY package*.json ./

# Instala as dependências do Node.js
RUN npm install

# Copia o restante do código-fonte
COPY . .

# Garante que a pasta de uploads exista
RUN mkdir -p /app/uploads

# Instala navegadores e dependências do Playwright
RUN npx playwright install --with-deps

# Variável de ambiente para produção
ENV NODE_ENV=production

# Expõe a porta usada pelo Express
EXPOSE 8080

# Inicia o app
CMD ["node", "index.js"]
