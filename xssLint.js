const compilerSFC = require('@vue/compiler-sfc')
const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default
const templateCompiler = require('@vue/compiler-core')
const fs = require('fs')

function getHtmlXssCodePos(code, fileType, file) {
  const xssCodePosList = []
  let jsSource = ''
  let templateSource = ''
  let jsLine = 0
  let jsStart = 0
  if (fileType === 'vue') {
    const sourceAst = compilerSFC.parse(code).descriptor // vueCompiler.parseComponent(code)
    jsSource = sourceAst.script && sourceAst.script.content
    templateSource = sourceAst.template && sourceAst.template.content
    jsLine = sourceAst.script ? sourceAst.script.loc.start.line : 0
    jsStart = sourceAst.script ? sourceAst.script.loc.start.offset : 0
  } else if (fileType === 'js') {
    jsSource = code
  }
  if (jsSource) {
    const jsAst = parser.parse(jsSource, {
      allowImportExportEverywhere: true,
      attachComment: true,
      plugins: ['typescript', 'decorators-legacy']
    })
    traverse(jsAst, {
      AssignmentExpression(path) {
        const operator = path.node.operator
        if (operator === '=') {
          const left = path.node.left
          const right = path.node.right
          if (left.type === 'MemberExpression' && left.property && left.property.name === 'innerHTML') {
            xssCodePosList.push({
              source: code.substring(path.node.start + jsStart, path.node.end + jsStart),
              line: path.node.loc.start.line + jsLine,
              column: path.node.loc.start.column,
              file: file
            })
          }
        }
      }
    })
  }
  if (templateSource) {
    const templateAst = templateCompiler.baseParse(templateSource)
    getTemplateXssPos(templateAst, xssCodePosList, file)
  }
  return xssCodePosList
}

function getTemplateXssPos(templateAst, xssCodePosList, file) {
  if (templateAst.children) {
    templateAst.children.forEach((t) => {
      getTemplateXssPos(t, xssCodePosList, file)
    })
  }
  templateAst.props &&
    templateAst.props.forEach((p) => {
      if (p.loc.source.substring(0, 7) === 'v-html=') {
        xssCodePosList.push({
          source: templateAst.loc.source,
          line: templateAst.loc.start.line,
          column: templateAst.loc.start.column,
          file: file
        })
      }
    })
}

var fileList = process.argv.splice(2)
let allXssCodePosList = []
for (const file of fileList) {
  try {
    const content = fs.readFileSync(file, {
      encoding: 'utf-8'
    })
    let fileType = ''
    if (file.endsWith('.vue')) {
      fileType = 'vue'
    } else if (file.endsWith('.js')) {
      fileType = 'js'
    }
    allXssCodePosList = allXssCodePosList.concat(getHtmlXssCodePos(content, fileType, file))
  } catch (err) {}
}
if (allXssCodePosList.length > 0) {
  console.log(
    '你的提交代码中包含v-html 或 innerHTML，该方法具有XSS注入的风险，在本项目中禁止使用，请使用v-safe-html 和 innerSafeHTML替代，如果疑问，咨询yumiluo，\n 危险代码如下：'
  )
  allXssCodePosList.forEach((pos) => {
    console.log(`${pos.source} \n file name： ${pos.file},line：${pos.line}, column: ${pos.column}`)
  })
  process.exitCode = 1
}
