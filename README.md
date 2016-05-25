# jstyle-cli

CLI for [jstyle](https://github.com/localvoid/jstyle).

## Usage example

```sh
$ jstyle -c css/jstyle.conf.js -o build/css -d myvar1=a -d myvar2=b
```

## Options

#### Config

```
Param:   -c --config
Type:    string
Default: jstyle.conf.js
```

#### Output directory

```
Param:   -o --output
Type:    string
Default: .
```

#### Define variable

```
Param: -d --define`
Type:  key=value`
```
