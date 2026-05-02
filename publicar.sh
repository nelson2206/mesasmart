#!/usr/bin/env bash
# ─────────────────────────────────────────────────────
#  MesaSmart · Script de publicación a GitHub
# ─────────────────────────────────────────────────────
#  Uso desde Terminal en tu Mac:
#    bash publicar.sh
#
#  Te guía paso a paso para subir el proyecto a GitHub
#  y activar GitHub Pages.
# ─────────────────────────────────────────────────────

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

clear
echo -e "${BOLD}${CYAN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║      MesaSmart · Publicar a GitHub             ║${NC}"
echo -e "${BOLD}${CYAN}╚════════════════════════════════════════════════╝${NC}"
echo

# Verificar git
if ! command -v git &> /dev/null; then
  echo -e "${RED}✗ Git no está instalado.${NC}"
  echo -e "  Instálalo con: ${BOLD}brew install git${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Git instalado$(git --version | sed 's/git version //')${NC}"
echo

# Pedir datos
echo -e "${BOLD}Necesito 2 datos:${NC}"
echo
read -p "Tu usuario de GitHub: " GH_USER
read -p "Nombre del repo (sugerido: mesasmart): " GH_REPO
GH_REPO=${GH_REPO:-mesasmart}

echo
echo -e "${YELLOW}Importante:${NC} Antes de continuar, abre tu navegador y crea un repo VACÍO en:"
echo -e "  ${BOLD}https://github.com/new${NC}"
echo -e "  Nombre: ${BOLD}$GH_REPO${NC}"
echo -e "  Visibilidad: ${BOLD}Public${NC}"
echo -e "  ${RED}NO marques${NC} 'Add a README' ni '.gitignore' ni 'license'"
echo
read -p "Cuando hayas creado el repo, presiona ENTER para continuar..."
echo

# Limpiar git previo si existe
if [ -d .git ]; then
  echo -e "${YELLOW}⚠ Hay un .git previo. Lo elimino.${NC}"
  rm -rf .git
fi

# Init
echo -e "${CYAN}→ Inicializando repositorio git${NC}"
git init -b main 2>&1 | tail -1
git config user.email "minsait.business.consulting.pe@gmail.com"
git config user.name "Minsaiter"

# Add y commit
echo -e "${CYAN}→ Agregando archivos${NC}"
git add .
FILES_COUNT=$(git status --short | wc -l | xargs)
echo -e "  ${GREEN}$FILES_COUNT archivos staged${NC}"

echo -e "${CYAN}→ Creando primer commit${NC}"
git commit -m "feat: MesaSmart MVP completo · sistema integral para restaurantes peruanos

5 vistas + ERP visual + backend completo:
- Cliente (tablet): foto-first menu, modificación con confirmación
- Cocina KDS: Smart Priority IA, semáforo de tiempos
- Admin: floor plan, KPIs vivos
- Mozo: plano del salón, unión de mesas, quejas
- ERP: inventario foto-IA, recetas, P&L, campañas IA

Backend: Node.js + TypeScript + Prisma + Socket.io
Cumple SUNAT, Ley 29733 PDP, INDECOPI." 2>&1 | tail -2

# Conectar y push
echo
echo -e "${CYAN}→ Conectando con GitHub${NC}"
git remote add origin "https://github.com/$GH_USER/$GH_REPO.git"

echo -e "${CYAN}→ Subiendo (puede pedirte usuario y token)${NC}"
echo -e "  ${YELLOW}Si te pide password, usa un Personal Access Token, NO tu contraseña.${NC}"
echo -e "  ${YELLOW}Genera uno en: https://github.com/settings/tokens${NC}"
echo

if git push -u origin main; then
  echo
  echo -e "${BOLD}${GREEN}╔════════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${GREEN}║                  ¡PUBLICADO!                   ║${NC}"
  echo -e "${BOLD}${GREEN}╚════════════════════════════════════════════════╝${NC}"
  echo
  echo -e "Tu repo está en:"
  echo -e "  ${BOLD}${CYAN}https://github.com/$GH_USER/$GH_REPO${NC}"
  echo
  echo -e "${BOLD}Último paso · Activar GitHub Pages:${NC}"
  echo -e "  1. Ve a ${CYAN}https://github.com/$GH_USER/$GH_REPO/settings/pages${NC}"
  echo -e "  2. En 'Source' elige: ${BOLD}Deploy from a branch${NC}"
  echo -e "  3. En 'Branch' elige: ${BOLD}main${NC} y ${BOLD}/ (root)${NC}"
  echo -e "  4. Click en Save"
  echo
  echo -e "En 1-2 minutos tu app estará en:"
  echo -e "  ${BOLD}${GREEN}https://$GH_USER.github.io/$GH_REPO/${NC}"
  echo
  echo -e "Vistas individuales:"
  echo -e "  ${CYAN}https://$GH_USER.github.io/$GH_REPO/cliente.html${NC}"
  echo -e "  ${CYAN}https://$GH_USER.github.io/$GH_REPO/cocina.html${NC}"
  echo -e "  ${CYAN}https://$GH_USER.github.io/$GH_REPO/admin.html${NC}"
  echo -e "  ${CYAN}https://$GH_USER.github.io/$GH_REPO/mozo.html${NC}"
  echo -e "  ${CYAN}https://$GH_USER.github.io/$GH_REPO/erp.html${NC}"
  echo
else
  echo
  echo -e "${RED}✗ El push falló.${NC} Causas comunes:"
  echo -e "  • El repo ya tiene contenido (úsalo: ${BOLD}git push -u origin main --force${NC} con cuidado)"
  echo -e "  • Credenciales incorrectas (usa un Personal Access Token)"
  echo -e "  • Repo no existe en GitHub (créalo primero)"
  echo
fi
