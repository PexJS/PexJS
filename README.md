Pex: Flash Player Runtime Engine
===

You can download pre-built Pex from bin directory.

### To build:

    npm install -g jake
    npm install
    git submodule update --init --recursive
    jake

### To develop Pex:

    jake

You can get HTML files in "output" directory for each SWF in target directory without obfuscating.

If you want to check your output, set output files at your local web server.
Or try following command:

    jake server

and open http://localhost:8080/ from your browser.


To continuous build, try

    jake watch

This automatically build Pex whenever you change source files.

Included External Libraries
---------------------------
This project is using [zlib.js](https://github.com/imaya/zlib.js) by Imaya inside Pex distribution under MIT License.

Documents and Tutorials
-----------------------
Currently only Japanese texts are available.

Pex Documentation Project is [here](https://github.com/PexJS/PexJS-Documentation). You can see it directly from [this site](https://docs.mobage.com/public/pex/docs/index.html).

Pex Tutorial can be found at [this site](https://docs.mobage.com/public/pex/tutorial/index.html).


Unofficial supports available on Twitter [@uupaa](https://twitter.com/uupaa) [@tkihira](https://twitter.com/tkihira).  
非公式のサポートをTwitter上で提供しております [@uupaa](https://twitter.com/uupaa) [@tkihira](https://twitter.com/tkihira)
