#!/usr/bin/env node

const child_process = require('child_process')
const path = require('path');
const fs = require('fs');

const package = require('../../package');

function usage() {
    console.log(`
advplcli
========

Faz a compilação pela linha de comando utilizando o compilador advpl para vscode.

parametros
----------

    geral:
    -help       Mensgaem de ajuda
    -debug      Exibe as configurações enviadas para o bridge
    --param     Adiciona/sobreescreve um parâmetro de compilação
    --env.param Adiciona/sobreescreve um parâmetro de compilação na sessão environments

    acoes:
    -compile    Faz a compilação de um fonte ou diretório
    -patch      Faz a geração do patch com arquivos do source
    -apply      Aplica um patch no repositorio no appserver

    facilitadores:
    -server     Facilitador para --env.server
    -port       Facilitador para --env.port
    -guara      Facilitador para --env.serverVersion 170117A
    -env        Facilitador para --env.name e --selectedEnvironment
    -include    Facilitador para --env.includeList
    -password   Facilitador para Cipher do password

exemplos
--------

identificando parametro padrao
$ advplcli -debug

compilando arquivos no ng (includes em \${PWD}/includes):
$ advplcli -host exemple.com -port 1234 -compile \${PWD}/src

compilando arquivos no guara (includes em \${PWD}/includes):
$ advplcli -host exemple.com -port 1234 -compile \${PWD}/src -guara

gerando patch (output do ptm em \${PWD}):
$ advplcli -patch lista.txt

aplicando patch:
$ advplcli -apply tttp120.ptm
    `);
}

function Compiler(configure) {
    var self = this;
    var root = path.join(path.dirname(process.mainModule.filename), '..', '..');

    if (process.platform.search('win') >= 0) {
        self.filepath = path.join(root, "bin", "alpha", "win", "AdvplDebugBridgeC.exe");
    }

    if (process.platform.search('linux') >= 0) {
        self.filepath = path.join(root, "bin", "alpha", "linux", "AdvplDebugBridgeC");
    }

    if (process.platform.search('darwin') >= 0) {
        self.filepath = path.join(root, "bin", "alpha", "mac", "AdvplDebugBridgeC");
    }

    self.configure = configure;

    self.cipher = function(password) {
        return new Promise((resolve, reject) => {
            if (password) {
                child_process.exec(`${self.filepath} --CipherPassword=${password}`, (error, stdout, stderr) => {
                    if (error) {
                        reject(error);
                    }
                    resolve(stdout.toString());
                });
            } else {
                child_process.exec(`${self.filepath} --CipherPasswordEmpty`, (error, stdout, stderr) => {
                    if (error) {
                        reject(error);
                    }
                    resolve(stdout.toString());
                });
            }
        });
    };

    self.compile = function(fileOrDir) {
        return new Promise((resolve, reject) => {
            fs.lstat(fileOrDir, (error, stat) => {
                if (error) reject(error);
                
                if (stat.isFile()) {
                    self.compileFile(fileOrDir)
                        .then((output) => {
                            resolve(output);
                        }).catch((error) => {
                            reject(error);
                        });
                } else if (stat.isDirectory()) {
                    self.compileDirectory(fileOrDir)
                        .then((output) => {
                            resolve(output);
                        }).catch((error) => {
                            reject(error);
                        });
                } else {
                    reject("O que esta tentando compilar não é arquivo nem diretório!");
                }
            });
        });
    };

    self.compileFile = function(file) {
        return new Promise((resolve, reject) => {
            let parameters = [];
            let stdout = "";

            parameters.push("--compileType=0");
            parameters.push("--compileInfo=" + JSON.stringify(self.configure));
            parameters.push("--source=" + file);

            let child = child_process.spawn(self.filepath, parameters);

            child.stdout.on("data", (data) => {
                stdout += data;
            });

            child.on("exit", (returnCode) => {
                if (returnCode) reject(data);
                resolve(stdout);
            });
        });
    };

    self.compileDirectory = function(directory) {
        return new Promise((resolve, reject) => {
            let parameters = [];
            let stdout = "";

            parameters.push("--compileType=1");
            parameters.push("--compileInfo=" + JSON.stringify(self.configure));
            parameters.push("--source=" + directory);

            let child = child_process.spawn(self.filepath, parameters);

            child.stdout.on("data", (data) => {
                stdout += data;
            });

            child.on("exit", (returnCode) => {
                if (returnCode) reject(data);
                resolve(stdout);
            });
        });
    };

    self.patch = function(patchFile) {
        return new Promise((resolve, reject) => {
            let parameters = [];
            let stdout = "";

            parameters.push("--compileInfo=" + JSON.stringify(self.configure));
            parameters.push("--patchBuild=" + patchFile);
            
            let child = child_process.spawn(self.filepath, parameters);

            child.stdout.on("data", (data) => {
                stdout += data;
            });

            child.on("exit", (returnCode) => {
                if (returnCode) reject(data);
                resolve(stdout);
            });
        });
    }

    self.apply = function(patchFile) {
        return new Promise((resolve, reject) => {
            let parameters = [];
            let stdout = "";

            parameters.push("--compileInfo=" + JSON.stringify(self.configure));
            parameters.push("--patchApply=" + patchFile);
            
            let child = child_process.spawn(self.filepath, parameters);

            child.stdout.on("data", (data) => {
                stdout += data;
            });

            child.on("exit", (returnCode) => {
                if (returnCode) reject(data);
                resolve(stdout);
            });
        });
    }
}

function parseConfiguration(configuration, object) {
    // processa todas as chaves do objeto recursivamente
    if (configuration.type == 'object') {
        object = {};

        for (key in configuration.properties) {
            let realKey = key.replace('advpl.', '');
            object[realKey] = parseConfiguration(
                    configuration.properties[key], object);
        }

        return object
    }
    
    // processa todas as chaves recursivamente e coloca em um array
    if (configuration.type == 'array') {
        return [parseConfiguration(configuration.items, object)];
    }

    // apenas devolve o valor padrao
    return configuration.default;
}

function extractCompiler(compilerPath) {
    return new Promise((resolve, reject) => {
        // processando a lista de arquivos no diretorio
        fs.readdir(compilerPath, (error, files) => {
            if (error) {
                reject(error);
            }

            // caso seja um arquivo compactado incrementa contador de execução
            let running = 0;
            for (let i = 0; i < files.length; i++) {
                if (files[i].search('.tar.gz') >= 0 ||
                        files[i].search('.zip') >= 0) {
                    running += 1;
                }
            }

            // caso não tenha arquivos para descompactar resolve
            if (running == 0) {
                resolve();
            }
            
            // avalia todos os arquivos e busca por compactados
            for (let i = 0; i < files.length; i++) {
                let filename = path.join(compilerPath, files[i]);

                // descompacta tar.gz
                if (filename.search('.tar.gz') >= 0) {
                    child_process.exec(`tar xzf ${filename} -C ${compilerPath}`, (error) => {
                        if (error) {
                            reject(error);
                        }
    
                        // remove tar.gz descompactado
                        fs.unlinkSync(filename);
                        
                        // caso nao exita mais arquivos para extrair resolve
                        running -= 1;
                        if (!running) resolve();
                    });
                }

                // descompacta arquivos zip
                if (filename.search('.zip') >= 0) {
                    child_process.exec(`unzip ${filename} -d ${compilerPath}`, (error) => {
                        if (error) {
                            reject(error);
                        }
    
                        // remove zip descompactado
                        fs.unlinkSync(filename);
                        
                        // caso nao exita mais arquivos para extrair resolve
                        running -= 1;
                        if (!running) resolve();
                    });
                }
            }
        });
    });
}

function detectAndExtractCompiler(packagePath) {
    let platform = process.platform;

    // descompacta linux
    if (platform.toLowerCase().indexOf('linux') >= 0) {
        return extractCompiler(path.join(packagePath, 'bin', 'alpha', 'linux'));
    }

    // descompacta windows (nao vai acontecer)
    if (platform.toLowerCase().indexOf('win') >= 0) {
        return extractCompiler(path.join(packagePath, 'bin', 'alpha', 'win'));;
    }
    
    // descompacta mac
    if (platform.toLowerCase().indexOf('darwin') >= 0) {
        return extractCompiler(path.join(packagePath, 'bin', 'alpha', 'mac'));;
    }
}

function parseParameters() {
    let defaultConfigure = parseConfiguration(package.contributes.configuration);

    let rootConfigure = {
        'workspaceFolders': process.cwd(), 
        "alpha_compile": true, 
        'pathPatchBuild': process.cwd(),
        'debug': false,
        'selectedEnvironment': 'environment'
    };

    let environmentConfigure = {
        'smartClientPath': path.join(process.cwd(), 'smartclient', path.sep),
        'includeList': path.join(process.cwd(), 'includes', path.sep),
        'server': 'localhost',
        'port': '1234',
        'user': 'admin',
        'environment': 'environment'
    };

    for (let i = 2; i < process.argv.length; i++) {
        let current = process.argv[i];
        let param = null;

        switch(true) {
            case /--help$/.test(current):
            case /-help$/.test(current):
            case /-h$/.test(current):
            case /\/\?$/.test(current):
                usage();
                process.exit(0);
            case /-guara$/.test(current):
                environmentConfigure['serverVersion'] = '170117A';
                break;
            case /-env$/.test(current):
                rootConfigure['selectedEnvironment'] = process.argv[i+1];
                environmentConfigure['environment'] = process.argv[i+1];
                i += 1;
                break;
            case /-compile$/.test(current):
                rootConfigure['action'] = 'compile';
                rootConfigure['sources'] = process.argv[i+1];
                i += 1;
                break;
            case /-patch$/.test(current):
                rootConfigure['action'] = 'patch';
                rootConfigure['sources'] = process.argv[i+1];
                i += 1;
                break;
            case /-apply$/.test(current):
                rootConfigure['action'] = 'apply';
                rootConfigure['sources'] = process.argv[i+1];
                i += 1;
                break;
            case /-server$/.test(current):
                environmentConfigure['server'] = process.argv[i+1];
                i += 1;
                break;
            case /-port$/.test(current):
                environmentConfigure['port'] = process.argv[i+1];
                i += 1;
                break;
            case /-include$/.test(current):
                environmentConfigure['includeList'] = process.argv[i+1];
                i += 1;
                break;
            case /-debug$/.test(current):
                rootConfigure['debug'] = true;
                break;
            case /-password$/.test(current):
                rootConfigure['password'] = process.argv[i+1];
                i += 1;
                break;
            case /--env\.environment$/.test(current):
                rootConfigure['selectedEnvironment'] = process.argv[i+1];
                environmentConfigure['environment'] = process.argv[i+1];
                i += 1;
                break;
            case /--selectedEnvironment$/.test(current):
                rootConfigure['selectedEnvironment'] = process.argv[i+1];
                environmentConfigure['environment'] = process.argv[i+1];
                i += 1
                break;
            case /--env\./.test(current):
                param = current.slice(6);
                environmentConfigure[param] = process.argv[i+1];
                i += 1
                break;
            case /--/.test(current):
                param = current.slice(2);
                rootConfigure[param] = process.argv[i+1];
                i += 1;
                break;
            default:
                console.log(`parametro ${current} não é valido`);
                usage();
                process.exit(1);
        }
    }

    Object.assign(defaultConfigure, rootConfigure);
    Object.assign(defaultConfigure['environments'][0], environmentConfigure);

    return defaultConfigure;
}

var packagePath = path.join(path.dirname(process.mainModule.filename), '..', '..');
detectAndExtractCompiler(packagePath).then(() => {
    let configure = parseParameters();
    let compiler = new Compiler(configure);

    compiler.cipher(configure['password']).then((output) => {
        let sources = configure['sources'];
        let action = configure['action'];
        let debug = configure['debug'];

        if (!configure['environments'][0]['name']) {
            delete configure['environments'][0]['name'];
        }

        delete configure['sources'];
        delete configure['password'];
        delete configure['action'];
        delete configure['debug'];

        configure['environments'][0]['passwordCipher'] = output;

        if (debug)
            console.log(configure);

        if (action === 'compile') {
            compiler.compile(sources).then((output) => {
                console.log(output);
            }).catch((error) => {
                console.log(error);
            });
        }

        if (action === 'patch') {
            compiler.patch(sources).then((output) => {
                console.log(output);
            }).catch((error) => {
                console.log(error);
            });
        }

        if (action === 'apply') {
            compiler.apply(sources).then((output) => {
                console.log(output);
            }).catch((error) => {
                console.log(error);
            });
        }
    });
}).catch((error) => {
    console.log(error);
});
