
FROM mcr.microsoft.com/playwright:v1.52.0-jammy

WORKDIR /app

COPY package.json ./
COPY index.js ./

RUN npm install

CMD ["node", "index.js"]
