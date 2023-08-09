# xssLint.js
Check the code for the presence of code using v-html and innerHTML, as this code may lead to XSS injection issues.

how to use
in package.json
"lint-staged": {
    "*.{js,vue}": "ts-node ./xssLint.js",
}
