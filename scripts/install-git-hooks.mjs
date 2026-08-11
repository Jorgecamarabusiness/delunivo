/**
 * Instala el hook de pre-push: antes de cada `git push` se corren el lint y los
 * unit tests, y si algo falla el push se cancela.
 *
 * Los hooks viven en .git/hooks/, que NO se sube al repositorio — por eso hacen
 * falta este script y el `npm run hooks:install`: cada persona que clone el
 * repositorio tiene que instalarlos una vez en su máquina.
 *
 * Uso:  node scripts/install-git-hooks.mjs
 */
import { writeFileSync, chmodSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const HOOKS_DIR = join(process.cwd(), ".git", "hooks");

if (!existsSync(join(process.cwd(), ".git"))) {
  console.error("Esto no parece un repositorio de git (no hay carpeta .git).");
  process.exit(1);
}

mkdirSync(HOOKS_DIR, { recursive: true });

// Solo lint + unit tests: son ~2 segundos. Los tests e2e tardan minutos y
// necesitan levantar la aplicación entera, así que esos se dejan para el
// servidor (GitHub Actions), no para cada push.
const prePush = `#!/bin/sh
echo "→ Comprobando el código antes de subirlo..."

npm run lint || {
  echo ""
  echo "✖ El lint ha fallado. Arregla los errores de arriba y vuelve a hacer push."
  echo "  Si necesitas subirlo igualmente: git push --no-verify"
  exit 1
}

npm run test:unit || {
  echo ""
  echo "✖ Han fallado unit tests. Arriba tienes cuáles y en qué línea."
  echo "  Si necesitas subirlo igualmente: git push --no-verify"
  exit 1
}

echo "✔ Todo correcto, subiendo."
`;

const hookPath = join(HOOKS_DIR, "pre-push");
writeFileSync(hookPath, prePush, "utf8");

// En Windows git-bash ignora el bit de permiso, pero en Mac y Linux hace falta.
try {
  chmodSync(hookPath, 0o755);
} catch {
  // En Windows puede fallar y no pasa nada.
}

console.log("Hook de pre-push instalado en .git/hooks/pre-push");
console.log("A partir de ahora, cada `git push` corre antes lint + unit tests.");
