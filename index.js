#!/usr/bin/env node
"use strict";

process.title = "jstyle";

const fs = require("fs");
const path = require("path");
const mkdirp = require("mkdirp");
const minimist = require("minimist");
const resolve = require("resolve");

let jstylePath;
try {
    jstylePath = resolve.sync("jstyle", { basedir: process.cwd() });
} catch (e) {
    process.stdout.write("Unable to find local jstyle module.\n");
    process.exit(1);
}
const jstyle = require(jstylePath);

const args = minimist(process.argv.slice(2), {
    alias: {
        "d": "define",
        "c": "config",
        "o": "output",
    },
    string: ["define", "config", "output"],
});

function usage() {
    process.stdout.write("Usage: jstyle -c jstyle.conf.js\n\n");
    process.stdout.write("\t-c --config\t\t\tConfig file [string]\n");
    process.stdout.write("\t-o --output\t\t\tOutput directory [string]\n");
    process.stdout.write("\t-d --define\t\t\tDefine variable [key:string=value:string]\n");
}

let configPath = args["config"] || "jstyle.conf.js";
let outputPath = args["output"] || ".";

if (!path.isAbsolute(configPath)) {
    configPath = path.join(process.cwd(), configPath);
}

if (!fs.existsSync(configPath)) {
    process.stdout.write(`Cannot find config file: ${configPath}\n\n`);
    usage();
    process.exit(1);
}

if (!path.isAbsolute(outputPath)) {
    outputPath = path.join(process.cwd(), outputPath);
}

const defs = {};
if (args["define"] !== undefined) {
    if (Array.isArray(args["define"])) {
        args["define"].map((d) => d.split("=")).forEach((v) => {
            const [key, value] = v;
            defs[key] = value;
        });
    } else {
        const [key, value] = args["define"].split("=");
        defs[key] = value;
    }
}

class CompiledEntry {
    constructor(fileName, result) {
        this.fileName = fileName;
        this.result = result;
    }
}

function compile(chunks, env, postcss, baseChunkFileName) {
    return jstyle.compile(chunks, env, postcss, baseChunkFileName)
        .then((artifact) => {
            return new Promise((resolve, reject) => {
                let i = 0;
                const next = () => {
                    if (i < artifact.chunks.length) {
                        const compiledChunk = artifact.chunks[i++];

                        const fullDirPath = path.join(outputPath, path.dirname(compiledChunk.fileName));
                        mkdirp(fullDirPath, (err) => {
                            if (err) {
                                reject(err);
                            } else {
                                fs.writeFile(
                                    path.join(outputPath, compiledChunk.fileName),
                                    compiledChunk.content,
                                    next);
                            }
                        });
                    } else {
                        resolve(this);
                    }
                };
                next();
            });
        });
}

const configModule = require(configPath);
const config = (typeof configModule === "function") ? configModule(defs) : configModule;
let env = config.env;
if (env !== undefined) {
    if (typeof env === "function") {
        env = env(defs);
    }
}

if (config.chunks) {
    compile(config.chunks, env, config.postcss, config.baseChunkFileName)
        .then(() => process.exit(0));
} else {
    process.exit(0);
}
