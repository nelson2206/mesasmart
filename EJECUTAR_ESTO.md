# 🚀 Ejecutar publicación · 1 paso

## Antes de empezar (30 segundos)

Crea el repo VACÍO en GitHub:
1. Abre [github.com/new](https://github.com/new)
2. Nombre: `mesasmart`
3. Visibilidad: **Public**
4. **No** marques nada de "Initialize this repository"
5. Click **Create repository**

## El comando (cópialo entero y pégalo en Terminal de tu Mac)

Reemplaza `TU_USUARIO` por tu usuario real de GitHub al inicio de la línea, después solo pega y dale Enter:

```bash
TU_USUARIO=cambiame && cd ~/Library/Mobile\ Documents/com~apple~CloudDocs/Proyecto\ Restaurantes/MesaSmart && rm -rf .git && git init -b main && git config user.email "minsait.business.consulting.pe@gmail.com" && git config user.name "Minsaiter" && git add . && git commit -m "feat: MesaSmart MVP completo" && git remote add origin https://github.com/$TU_USUARIO/mesasmart.git && git push -u origin main
```

Te va a pedir credenciales. Tu user de GitHub + un **Personal Access Token** (no tu password). Genera uno gratis en [github.com/settings/tokens](https://github.com/settings/tokens) con permiso `repo`.

## Activar GitHub Pages (1 minuto más)

1. En tu repo: `https://github.com/TU_USUARIO/mesasmart/settings/pages`
2. Source: **Deploy from a branch**
3. Branch: **main** + **/ (root)**
4. Click **Save**

En ~90 segundos tu link público estará vivo en:

```
https://TU_USUARIO.github.io/mesasmart/
```

Y los enlaces directos:
- Hub → `/`
- Cliente → `/cliente.html`
- Cocina → `/cocina.html`
- Admin → `/admin.html`
- Mozo → `/mozo.html`
- ERP → `/erp.html`

---

## Si algo falla

**Error: `.git/objects/.../tmp_obj_...: Operation not permitted`**
Es del intento previo desde mi sandbox. Tu Mac SÍ puede borrarlo:
```bash
rm -rf ~/Library/Mobile\ Documents/com~apple~CloudDocs/Proyecto\ Restaurantes/MesaSmart/.git
```

**Error: `remote origin already exists`**
```bash
git remote set-url origin https://github.com/TU_USUARIO/mesasmart.git
```

**Te pide password y rechaza tu password normal**
GitHub no acepta passwords desde 2021. Necesitas Personal Access Token:
1. Ve a [github.com/settings/tokens](https://github.com/settings/tokens)
2. **Generate new token (classic)**
3. Marca **`repo`** (Full control of private repositories)
4. Genera y copia el token
5. Úsalo como password en Terminal

---

## Alternativa instantánea sin Git

Si solo quieres el link AHORA mismo:

1. [app.netlify.com/drop](https://app.netlify.com/drop)
2. Arrastra la carpeta MesaSmart al navegador
3. URL pública en 10 segundos: `https://xxx-yyy.netlify.app`
