const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const appRoot = path.join(root, 'app');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  }).filter((file) => /\.(ts|tsx)$/.test(file));
}

function resolveLocal(fromFile, specifier) {
  const base = specifier.startsWith('@/')
    ? path.join(root, specifier.slice(2))
    : path.resolve(path.dirname(fromFile), specifier);
  for (const candidate of [base + '.ts', base + '.tsx', path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

const files = walk(appRoot);
const definitions = new Map();

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  for (const statement of sf.statements) {
    if (!ts.isFunctionDeclaration(statement) || !statement.name || !statement.parameters[0]) continue;
    if (!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
    const parameter = statement.parameters[0];
    if (!ts.isObjectBindingPattern(parameter.name) || !parameter.type || !ts.isTypeLiteralNode(parameter.type)) continue;
    const props = new Set(
      parameter.type.members
        .filter(ts.isPropertySignature)
        .map((member) => member.name?.getText(sf).replace(/^['"]|['"]$/g, ''))
        .filter(Boolean),
    );
    definitions.set(`${path.resolve(file)}#${statement.name.text}`, props);
  }
}

const failures = [];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports = new Map();

  for (const statement of sf.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier.text;
    if (!specifier.startsWith('.') && !specifier.startsWith('@/')) continue;
    const target = resolveLocal(file, specifier);
    if (!target) continue;
    const bindings = statement.importClause.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      const imported = (element.propertyName || element.name).text;
      imports.set(element.name.text, `${path.resolve(target)}#${imported}`);
    }
  }

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const componentName = node.tagName.getText(sf);
      const definitionKey = imports.get(componentName);
      const allowedProps = definitionKey && definitions.get(definitionKey);
      if (allowedProps) {
        for (const attribute of node.attributes.properties) {
          if (!ts.isJsxAttribute(attribute)) continue;
          const prop = attribute.name.text;
          if (prop === 'key' || prop === 'ref') continue;
          if (!allowedProps.has(prop)) {
            const line = sf.getLineAndCharacterOfPosition(attribute.pos).line + 1;
            failures.push(`${path.relative(root, file)}:${line} <${componentName}> unsupported prop '${prop}'`);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
}

if (failures.length) {
  console.error(`Component contract audit FAILED (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Component contract audit PASSED: ${files.length} app TypeScript files checked; 0 unsupported typed component props.`);
