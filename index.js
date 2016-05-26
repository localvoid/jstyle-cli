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
  jstylePath = resolve.sync("jstyle", { baseDir: process.cwd() })
} catch (e) {
  process.stdout.write("Unable to find local jstyle.");
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

class Compiler {
  constructor(context) {
    this.context = context;
    this.passes = [jstyle.flattenProperties, jstyle.uniqueProperties, jstyle.cleanTree];
  }

  compile(chunks, baseChunkFileName) {
    const artifact = jstyle.compile(chunks, this.context, jstyle.DefaultCompilationPasses, baseChunkFileName);

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
              fs.writeFile(path.join(outputPath, compiledChunk.fileName), compiledChunk.content, next);
            }
          });
        } else {
          resolve(this);
        }
      };
      next();
    });
  }

  writeTagNames(outFile) {
    return new Promise((resolve, reject) => {
      const outDir = path.dirname(outFile);
      mkdirp(outDir, (err) => {
        if (err) {
          reject(err);
        } else {
          const result = JSON.stringify(this.context.tagNameRegistry);
          fs.writeFile(outFile, result, () => resolve(this));
        }
      });
    });
  }

  writeClassNames(outFile) {
    return new Promise((resolve, reject) => {
      const outDir = path.dirname(outFile);
      mkdirp(outDir, (err) => {
        if (err) {
          reject(err);
        } else {
          const result = JSON.stringify(this.context.classNameRegistry);
          fs.writeFile(outFile, result, () => resolve(this));
        }
      });
    });
  }
}

const configModule = require(configPath);
const config = (typeof configModule === "function") ? configModule(defs) : configModule;
let env = config.env;
if (env !== undefined) {
  if (typeof env === "function") {
    env = env(defs);
  }
}
const context = new jstyle.Context({
  minifyTagNames: config.minifyTagNames,
  minifyClassNames: config.minifyClassNames,
  tagNamePrefix: config.tagNamePrefix,
  env: env,
});
const compiler = new Compiler(context);

if (config.chunks) {
  let next = compiler.compile(config.chunks, config.baseChunkFileName || "base.css");

  if (config.minifyTagNames !== undefined) {
    const fileName = (typeof config.minifyTagNames === "string") ?
      config.minifyTagNames :
      "tag_names.json";
    next = next.then((c) => c.writeTagNames(path.join(outputPath, fileName)));
  }

  if (config.minifyClassNames !== undefined) {
    const fileName = (typeof config.minifyClassNames === "string") ?
      config.minifyClassNames :
      "class_names.json";
    next = next.then((c) => c.writeClassNames(path.join(outputPath, fileName)));
  }

  next.then(() => process.exit(0));
} else {
  process.exit(0);
}
