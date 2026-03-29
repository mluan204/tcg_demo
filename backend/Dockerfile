FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY requirements.txt ./

RUN npm ci --omit=dev \
    && pip3 install --no-cache-dir -r requirements.txt

COPY . .

ENV NODE_ENV=production
ENV PORT=4000
ENV PYTHON_BIN=python3
ENV ARTIFACT_DIR=/artifacts

EXPOSE 4000

CMD ["npm", "run", "start"]

