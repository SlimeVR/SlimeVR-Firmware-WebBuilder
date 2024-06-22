FROM ubuntu:22.04

RUN apt-get update \
	&& apt-get install -y build-essential libssl-dev libffi-dev python3 python3-pip python3-venv git curl ca-certificates curl gnupg

RUN python3 --version
RUN curl -fsSL https://raw.githubusercontent.com/platformio/platformio-core-installer/master/get-platformio.py -o get-platformio.py
RUN python3 get-platformio.py
ENV PATH="${PATH}:/root/.platformio/penv/bin"



RUN mkdir -p /etc/apt/keyrings && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
RUN echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
RUN apt-get update && apt-get install nodejs -y

WORKDIR /app



COPY package*.json ./
RUN npm install
COPY . .

CMD ["bash", "/app/docker/nest/run.sh"]
