import fs from "node:fs";
import path from "node:path";

const generatedFile = path.resolve("src/types/backend.ts");
const outputDir = path.resolve("src/types/JsonModels");

if (!fs.existsSync(generatedFile)) {
  console.error(`Generated file not found: ${generatedFile}`);
  console.error(
    `Please build the server project first to generate TypeScript types.`
  );
  process.exit(1);
}

const content = fs.readFileSync(generatedFile, "utf8");

// Parse namespaces (both export namespace and module syntax)
const namespaceRegex =
  /export\s+(?:namespace|module)\s+([\w.]+)\s*\{([\s\S]*?)\n\}/g;

let match;
const namespaces = new Map();
const emittedTypes = [];

// Extract all namespaces
while ((match = namespaceRegex.exec(content)) !== null) {
  const namespaceName = match[1];
  const namespaceContent = match[2];

  const types = [];

  // Match interfaces
  const interfaceRegex =
    /export\s+interface\s+(\w+)(?:<[^>]+>)?(?:\s+extends\s+[^{]+)?\s*\{[\s\S]*?\n\t\}/g;
  let typeMatch;

  while ((typeMatch = interfaceRegex.exec(namespaceContent)) !== null) {
    const typeContent = typeMatch[0]
      .split("\n")
      .map((line) => (line.startsWith("\t") ? line.substring(1) : line))
      .join("\n");
    types.push({
      kind: "interface",
      name: typeMatch[1],
      content: typeContent,
    });
  }

  //Match classes
  const classRegex = /export\s+class\s+(\w+)(?:<[^>]+>)?\s*\{[\s\S]*?\n\t\}/g;

  while ((typeMatch = classRegex.exec(namespaceContent)) !== null) {
    const typeContent = typeMatch[0]
      .split("\n")
      .map((line) => (line.startsWith("\t") ? line.substring(1) : line))
      .join("\n");
    types.push({
      kind: "class",
      name: typeMatch[1],
      content: typeContent,
    });
  }

  //Match enums
  const enumRegex = /export\s+enum\s+(\w+)\s*\{[\s\S]*?\n\t\}/g;

  while ((typeMatch = enumRegex.exec(namespaceContent)) !== null) {
    const typeContent = typeMatch[0]
      .split("\n")
      .map((line) => (line.startsWith("\t") ? line.substring(1) : line))
      .join("\n");
    types.push({
      kind: "enum",
      name: typeMatch[1],
      content: typeContent,
    });
  }

  if (types.length > 0) namespaces.set(namespaceName, types);
}

// Also extract top-level interfaces/classes/enums (not in namespaces)
const topLevelTypes = [];

// interfaces
const topLevelInterfaceRegex =
  /^export\s+interface\s+(\w+)(?:<[^>]+>)?(?:\s+extends\s+[^{]+)?\s*\{[\s\S]*?\n\}/gm;
let topLevelMatch;

while ((topLevelMatch = topLevelInterfaceRegex.exec(content)) !== null) {
  topLevelTypes.push({
    kind: "interface",
    name: topLevelMatch[1],
    content: topLevelMatch[0],
  });
}

// classes
const topLevelClassRegex =
  /^export\s+class\s+(\w+)(?:<[^>]+>)?\s*\{[\s\S]*?\n\}/gm;

while ((topLevelMatch = topLevelClassRegex.exec(content)) !== null) {
  topLevelTypes.push({
    kind: "class",
    name: topLevelMatch[1],
    content: topLevelMatch[0],
  });
}

//enums
const topLevelEnumRegex = /^export\s+enum\s+(\w+)\s*\{[\s\S]*?\n\}/gm;

while ((topLevelMatch = topLevelEnumRegex.exec(content)) !== null) {
  topLevelTypes.push({
    kind: "enum",
    name: topLevelMatch[1],
    content: topLevelMatch[0],
  });
}

if (topLevelTypes.length > 0) {
  namespaces.set("__root__", topLevelTypes);
}

if (namespaces.size === 0) {
  console.error(
    "No namespaces or types found in generated file. Please check the Reinforced Typings configuration."
  );
  process.exit(1);
}

// Clean output directory (except index.ts)
if (fs.existsSync(outputDir)) {
  const cleanDir = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        cleanDir(fullPath);
        fs.rmdirSync(fullPath);
      } else if (entry.name !== "index.ts") {
        fs.unlinkSync(fullPath);
      }
    }
  };
  cleanDir(outputDir);
} else {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Helper: detect if file content references namespaces (models OR enums)
function hasNamespaceRefs(typeContent) {
  // Handles: JsonModels.X, JsonModels.Auth.UserDto, FitMate.X, etc.
  return /\b(?:JsonModels|FitMate)(?:\.[A-Za-z_]\w+)+\b/.test(
    typeContent
  );
}

function getEnumRefs(typeContent) {
  return [
    ...new Set(
      [...typeContent.matchAll(/\bEnums\.([A-Za-z_]\w+)\b/g)].map(
        (match) => match[1]
      )
    ),
  ];
}

function toImportPath(fromDir, toPathWithoutExtension) {
  const relative = path
    .relative(fromDir, toPathWithoutExtension)
    .replace(/\\/g, "/");
  return relative.startsWith(".") ? relative : `./${relative}`;
}

// Create files for each type
let totalFiles = 0;
namespaces.forEach((types, namespaceName) => {
  let relativePath = "";

  if (namespaceName === "__root__") {
    relativePath = "";
  } else if (namespaceName.startsWith("JsonModels.")) {
    relativePath = namespaceName
      .substring("JsonModels.".length)
      .replace(/\./g, "/");
  } else {
    relativePath = namespaceName.replace(/\./g, "/");
  }

  const targetDir = relativePath ? path.join(outputDir, relativePath) : outputDir;

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Write each type to a separate file
  types.forEach((typeDef) => {
    const typeName = typeDef.name;
    const fileName = `${typeName}.ts`;
    const filePath = path.join(targetDir, fileName);

    const enumRefs = getEnumRefs(typeDef.content);
    const needsJsonModelsImport = hasNamespaceRefs(typeDef.content);
    let finalContent = typeDef.content.trim();
    const importStatements = [];

    if (enumRefs.length > 0) {
      finalContent = finalContent.replace(/\bEnums\.([A-Za-z_]\w+)\b/g, "$1");
    }

    if (needsJsonModelsImport) {
      const relative = path.relative(targetDir, path.dirname(generatedFile));
      const importPath = (relative.replace(/\\/g, "/") || ".") + "/backend";
      importStatements.push(`import type { JsonModels } from "${importPath}";`);
    }

    if (enumRefs.length > 0) {
      for (const enumName of enumRefs.sort((a, b) => a.localeCompare(b))) {
        if (namespaceName === "Enums" && enumName === typeName) {
          continue;
        }

        const enumImportPath = toImportPath(
          targetDir,
          path.join(outputDir, "Enums", enumName)
        );
        importStatements.push(
          `import type { ${enumName} } from "${enumImportPath}";`
        );
      }
    }

    if (importStatements.length > 0) {
      finalContent = importStatements.join("\n") + "\n\n" + finalContent;
    }

    fs.writeFileSync(filePath, finalContent + "\n", "utf8");
    totalFiles++;
    emittedTypes.push({
      namespaceName,
      typeName,
      kind: typeDef.kind,
    });
  });
});

// Generate barrel file (index.ts) with named exports (no wildcard exports).
const indexExports = emittedTypes
  .map((typeDef) => {
    let relativePath = "";
    if (typeDef.namespaceName === "__root__") {
      relativePath = `./${typeDef.typeName}`;
    } else if (typeDef.namespaceName.startsWith("JsonModels.")) {
      const namespacePath = typeDef.namespaceName
        .substring("JsonModels.".length)
        .replace(/\./g, "/");
      relativePath = `./${namespacePath}/${typeDef.typeName}`;
    } else {
      relativePath = `./${typeDef.namespaceName.replace(/\./g, "/")}/${typeDef.typeName}`;
    }

    if (typeDef.kind === "enum") {
      return `export { ${typeDef.typeName} } from "${relativePath}";`;
    }

    return `export type { ${typeDef.typeName} } from "${relativePath}";`;
  })
  .sort((a, b) => a.localeCompare(b));

fs.writeFileSync(path.join(outputDir, "index.ts"), indexExports.join("\n") + "\n", "utf8");

// Generate app-level type aliases for ergonomic imports.
const appTypesFile = path.resolve("src/types/index.ts");
const aliasNames = new Set(emittedTypes.map((t) => t.typeName));
const aliases = [];

for (const typeDef of emittedTypes) {
  if (!typeDef.namespaceName.startsWith("JsonModels.") || typeDef.kind === "enum") {
    continue;
  }

  if (!typeDef.typeName.endsWith("Model")) {
    continue;
  }

  const aliasName = typeDef.typeName.slice(0, -"Model".length);
  if (!aliasName || aliasNames.has(aliasName)) {
    continue;
  }

  const namespacePath = typeDef.namespaceName.replace("JsonModels.", "");
  aliases.push({
    aliasName,
    target: `JsonModels.${namespacePath}.${typeDef.typeName}`,
  });
  aliasNames.add(aliasName);
}

const appTypeLines = ['export * from "./JsonModels";'];
if (aliases.length > 0) {
  appTypeLines.push("");
  appTypeLines.push('import type { JsonModels } from "./backend";');
  appTypeLines.push("");

  for (const alias of aliases.sort((a, b) => a.aliasName.localeCompare(b.aliasName))) {
    appTypeLines.push(`export type ${alias.aliasName} = ${alias.target};`);
  }
}

appTypeLines.push("");
fs.writeFileSync(appTypesFile, appTypeLines.join("\n"), "utf8");
