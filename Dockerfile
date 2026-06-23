FROM node:20

WORKDIR /root
COPY package.json ./
RUN npm install && npm i -g @quasar/cli

CMD cd code && bash run.sh