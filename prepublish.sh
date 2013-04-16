#!/usr/bin/env bash

npm test
docco ./lib/multiproc-queue-flow.js
browserify ./lib/multiproc-queue-flow.js | uglifyjs > ./lib/mulitproc-queue-flow.min.js
git commit -am "Automatic documentation and minification for version $npm_package_version"
git tag $npm_package_version
git push
git push --tags