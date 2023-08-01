FROM ubuntu:22.04

RUN apt-get update \
	&& apt-get install -y build-essential libssl-dev libffi-dev python3 python3-pip python3-venv git curl

RUN python3 --version
RUN curl -fsSL https://raw.githubusercontent.com/platformio/platformio-core-installer/master/get-platformio.py -o get-platformio.py
RUN python3 get-platformio.py
ENV PATH="${PATH}:/root/.platformio/penv/bin"




RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
RUN apt install -y nodejs

WORKDIR /app



COPY package*.json ./
RUN npm install
COPY . .

CMD ["bash", "/app/docker/nest/run.sh"]
