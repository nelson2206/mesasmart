# 📤 Cómo publicar este proyecto en GitHub + obtener link web

Tienes 2 opciones según cuánto quieras manejar git.

---

## ✨ Opción A · GitHub Pages (recomendada · 5 minutos)

Te da una URL pública tipo `https://TUUSUARIO.github.io/mesasmart/` que se actualiza cada vez que hagas push.

### Paso 1 · Crear el repo en GitHub

1. Entra a [github.com/new](https://github.com/new)
2. Nombre del repo: **`mesasmart`** (o el que prefieras)
3. Visibilidad: **Public** (necesario para Pages gratis · Pages funciona en privado solo en plan Pro)
4. **NO marques** "Add a README", "Add .gitignore", ni "Choose a license" — ya los tenemos en el proyecto
5. Click en **Create repository**

### Paso 2 · Subir el proyecto

Abre **Terminal** en tu Mac y pega los siguientes comandos uno por uno (reemplaza `TUUSUARIO` por tu usuario de GitHub):

```bash
cd ~/Library/Mobile\ Documents/com~apple~CloudDocs/Proyecto\ Restaurantes/MesaSmart

# Limpia cualquier git previo (por si acaso)
rm -rf .git

# Inicializa repositorio
git init -b main
git config user.email "minsait.business.consulting.pe@gmail.com"
git config user.name "Minsaiter"

# Primer commit
git add .
git commit -m "feat: MesaSmart MVP completo - sistema integral para restaurantes peruanos"

# Conecta con GitHub y sube
git remote add origin https://github.com/TUUSUARIO/mesasmart.git
git push -u origin main
```

> Si te pide credenciales: usa tu usuario de GitHub + un **Personal Access Token** (no tu contraseña).
> Crea uno aquí: [github.com/settings/tokens](https://github.com/settings/tokens) (con permiso `repo`).
> O configura SSH: [docs.github.com/en/authentication/connecting-to-github-with-ssh](https://docs.github.com/en/authentication/connecting-to-github-with-ssh).

### Paso 3 · Activar GitHub Pages

1. En tu repo en GitHub, ve a **Settings** (arriba a la derecha)
2. En el menú izquierdo, click en **Pages**
3. En "Source", elige **Deploy from a branch**
4. En "Branch", selecciona **`main`** y carpeta **`/ (root)`**
5. Click en **Save**

Espera ~1-2 minutos. GitHub te mostrará la URL pública arriba en la misma página:

```
https://TUUSUARIO.github.io/mesasmart/
```

Y los enlaces directos a cada vista:

- Hub: `https://TUUSUARIO.github.io/mesasmart/`
- Cliente: `https://TUUSUARIO.github.io/mesasmart/cliente.html`
- Cocina: `https://TUUSUARIO.github.io/mesasmart/cocina.html`
- Admin: `https://TUUSUARIO.github.io/mesasmart/admin.html`
- Mozo: `https://TUUSUARIO.github.io/mesasmart/mozo.html`
- ERP: `https://TUUSUARIO.github.io/mesasmart/erp.html`

### Para actualizar después

Cada vez que cambies algo:

```bash
cd ~/Library/Mobile\ Documents/com~apple~CloudDocs/Proyecto\ Restaurantes/MesaSmart
git add .
git commit -m "describe el cambio"
git push
```

GitHub Pages se actualiza solo en ~30 segundos.

---

## ⚡ Opción B · Netlify Drop (instantáneo · 0 git)

Si solo quieres un link público para mostrar **ahora mismo** sin manejar git:

1. Abre [app.netlify.com/drop](https://app.netlify.com/drop)
2. Arrastra la carpeta **`MesaSmart`** completa al navegador
3. En 10 segundos te dan una URL pública tipo `https://abc123-xyz.netlify.app`
4. Listo — comparte ese link

> Esa URL se mantiene activa mientras Netlify la sirva. Para una URL personalizada permanente, crea cuenta Netlify (también gratis).

---

## 🔐 Importante sobre el backend

El backend (`/backend`) **NO se publica en Pages** porque Pages solo sirve archivos estáticos.

Si quieres que el backend esté online también, las opciones gratuitas más simples son:

| Servicio | Para qué sirve | Tier gratis |
|---|---|---|
| **Render** | Backend Node.js + DB Postgres | 750h/mes free |
| **Railway** | Backend + DB en un click | $5/mes inicial |
| **Fly.io** | Backend en contenedores | 3 instancias free |
| **Supabase** | Postgres + auth managed | 500MB DB gratis |

El frontend en GitHub Pages puede consumir un backend en cualquiera de estos. Solo cambia las URLs en las vistas para que apunten al backend desplegado.

---

## 🎯 Lo que verán quienes abran tu link

El **hub** los recibe con stats, badges de cumplimiento y 5 cards de roles. Pueden navegar libremente entre todas las vistas. Cada una funciona con datos demo (mock) bien diseñados que muestran exactamente cómo se vería en producción.

Datos demo pre-cargados:
- Pollería **La Brasa Dorada** con 30 platos
- 6 tickets activos en cocina con diferentes prioridades
- 16 mesas en floor plan con estados variados
- 26 insumos con stock real, costos, expiraciones
- 5 campañas IA pre-generadas
- 4 proveedores con auto-pedido

Todo navegable, sin login, sin instalación.
