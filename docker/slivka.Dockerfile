ARG PYTHON_VERSION=3.12
ARG ALPINE_VERSION=3.21

FROM python:${PYTHON_VERSION}-alpine${ALPINE_VERSION} AS slivka

ARG SLIVKA_GIT_REPO=https://github.com/proteinverse/slivka.git
ARG SLIVKA_GIT_REF=8a70671

RUN apk add --no-cache docker-cli docker-cli-buildx git pigz bash

RUN python -m venv /opt/venv
RUN source /opt/venv/bin/activate && \
    pip install --upgrade pip setuptools wheel && \
    pip install git+${SLIVKA_GIT_REPO}@${SLIVKA_GIT_REF} && \
    pip install gunicorn && \
    pip install requests && \
    pip install tqdm

ADD --chmod=500 scripts/msa_from_collab_server.py  /usr/local/gyde-slivka/bin/msa_from_collab_server.py
ADD --chmod=400 scripts/collabfold-proxy.service.yaml  /usr/local/gyde-slivka/services/collabfold-proxy.service.yaml
ENV SLIVKA_DIR_SERVICES="/data/slivka/services:/usr/local/gyde-slivka/services"

WORKDIR /root
ADD --chmod=500 scripts/_venv_entrypoint.sh /usr/local/bin/_venv_entrypoint.sh
ENTRYPOINT ["/usr/local/bin/_venv_entrypoint.sh"]


FROM slivka AS slivka-bio-installer

ARG SLIVKA_INSTALLER_GIT_REPO=https://github.com/proteinverse/slivka-bio-installer.git
ARG SLIVKA_INSTALLER_GIT_BRANCH=main

ADD ${SLIVKA_INSTALLER_GIT_REPO}#${SLIVKA_INSTALLER_GIT_BRANCH} /usr/src/slivka-bio-installer
WORKDIR /usr/src/slivka-bio-installer

ENV PATH="/opt/venv/bin:$PATH"

ENTRYPOINT ["/opt/venv/bin/python", "install_cli.py", "--docker-exe", "autodetect", "--non-interactive", "--log-level", "DEBUG"]
