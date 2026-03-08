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

// Extract all namespaces
while ((match = namespaceRegex.exec(content)) !== null) {
  const namespaceName = match[1];
  const namespaceContent = match[2];

  const types = [];

  // Match interfaces
  const interfaceRegex =
    /export\s+interface\s+(\w+)(?:<[^>]+>)?\s*\{[\s\S]*?\n\t\}/g;
  let typeMatch;

  while ((typeMatch = interfaceRegex.exec(namespaceContent)) !== null) {
    const typeContent = typeMatch[0]
      .split("\n")
      .map((line) => (line.startsWith("\t") ? line.substring(1) : line))
      .join("\n");
    types.push(typeContent);
  }

  //Match classes
  const classRegex = /export\s+class\s+(\w+)(?:<[^>]+>)?\s*\{[\s\S]*?\n\t\}/g;

  while ((typeMatch = classRegex.exec(namespaceContent)) !== null) {
    const typeContent = typeMatch[0]
      .split("\n")
      .map((line) => (line.startsWith("\t") ? line.substring(1) : line))
      .join("\n");
    types.push(typeContent);
  }

  //Match enums
  const enumRegex = /export\s+enum\s+(\w+)\s*\{[\s\S]*?\n\t\}/g;

  while ((typeMatch = enumRegex.exec(namespaceContent)) !== null) {
    const typeContent = typeMatch[0]
      .split("\n")
      .map((line) => (line.startsWith("\t") ? line.substring(1) : line))
      .join("\n");
    types.push(typeContent);
  }

  if (types.length > 0) namespaces.set(namespaceName, types);
}

// Also extract top-level interfaces/classes/enums (not in namespaces)
const topLevelTypes = [];

// interfaces
const topLevelInterfaceRegex =
  /^export\s+interface\s+(\w+)(?:<[^>]+>)?\s*\{[\s\S]*?\n\}/gm;
let topLevelMatch;

while ((topLevelMatch = topLevelInterfaceRegex.exec(content)) !== null) {
  topLevelTypes.push(topLevelMatch[0]);
}

// classes
const topLevelClassRegex =
  /^export\s+class\s+(\w+)(?:<[^>]+>)?\s*\{[\s\S]*?\n\}/gm;

while ((topLevelMatch = topLevelClassRegex.exec(content)) !== null) {
  topLevelTypes.push(topLevelMatch[0]);
}

//enums
const topLevelEnumRegex = /^export\s+enum\s+(\w+)\s*\{[\s\S]*?\n\}/gm;

while ((topLevelMatch = topLevelEnumRegex.exec(content)) !== null) {
  topLevelTypes.push(topLevelMatch[0]);
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

// Helper: detect if file content references Enums namespace
function hasEnumsRefs(typeContent) {
  return /\bEnums\.[A-Za-z_]\w+\b/.test(typeContent);
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
  types.forEach((typeContent) => {
    //include enums too
    const typeNameMatch = typeContent.match(
      /export\s+(?:interface|class|enum)\s+(\w+)/
    );
    if (!typeNameMatch) return;

    const typeName = typeNameMatch[1];
    const fileName = `${typeName}.ts`;
    const filePath = path.join(targetDir, fileName);

    const needsJsonModelsImport = hasNamespaceRefs(typeContent);
    const needsEnumsImport = hasEnumsRefs(typeContent);

    let finalContent = typeContent.trim();

    if (needsJsonModelsImport || needsEnumsImport) {
      const relative = path.relative(targetDir, path.dirname(generatedFile));
      const importPath = (relative.replace(/\\/g, "/") || ".") + "/backend";

      const imports = [];
      if (needsJsonModelsImport) imports.push("JsonModels");
      if (needsEnumsImport) imports.push("Enums");

      const importStatement = `import type { ${imports.join(", ")} } from "${importPath}";\n\n`;
      finalContent = importStatement + finalContent;
    }

    fs.writeFileSync(filePath, finalContent + "\n", "utf8");
    totalFiles++;
  });
});

// Generate barrel file (index.ts)
function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full));
    else if (e.isFile() && e.name.endsWith(".ts") && e.name !== "index.ts")
      out.push(full);
  }
  return out;
}

const files = walk(outputDir);
const exports =
  files
    .map(
      (f) =>
        "./" +
        path
          .relative(outputDir, f)
          .replace(/\\/g, "/")
          .replace(/\.ts$/, "")
    )
    .map((p) => `export * from "${p}";`)
    .join("\n") + "\n";

fs.writeFileSync(path.join(outputDir, "index.ts"), exports, "utf8");
