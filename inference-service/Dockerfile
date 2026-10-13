FROM node:22-slim

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.mjs ./

ENV HOST=0.0.0.0
ENV PORT=8080
ENV TRANSFORMERS_CACHE_DIR=/data/models
EXPOSE 8080

CMD ["npm", "start"]
