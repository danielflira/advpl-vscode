FROM alpine
RUN apk update && apk add \
    curl
RUN mkdir node
RUN curl -sL https://nodejs.org/dist/v10.15.1/node-v10.15.1-linux-x64.tar.xz \
    | tar xJf - --strip 1 -C node

FROM debian
COPY --from=0 /node/ /usr/local/
RUN dpkg --add-architecture i386 && apt-get update && apt-get install -y \
   libstdc++6:i386 \
   libgcc1:i386

ADD . /src
RUN npm pack /src \
    && rm -rf /src \
    && npm i -g advpl-vscode* \
    && rm -rf advpl-vscode*

ENTRYPOINT ["advplcli"]
CMD ["-h"]
