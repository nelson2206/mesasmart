import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding MesaSmart database...");

  // Clean (in dev only)
  await prisma.modificationRequest.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.comprobante.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.call.deleteMany();
  await prisma.recipeIngredient.deleteMany();
  await prisma.inventoryCountLine.deleteMany();
  await prisma.inventoryCount.deleteMany();
  await prisma.purchaseOrderLine.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.expirationLot.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.ingredientCategory.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.campaignSuggestion.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.menuCategory.deleteMany();
  await prisma.table.deleteMany();
  await prisma.user.deleteMany();
  await prisma.restaurant.deleteMany();

  // ─────────── RESTAURANT ───────────
  const restaurant = await prisma.restaurant.create({
    data: {
      name: "La Brasa Dorada",
      ruc: "20512345678",
      address: "Av. Larco 845, Miraflores - Lima",
      phone: "+51 1 445 6789",
      taxRate: 0.18,
      tipDefaultPct: 0.10
    }
  });

  // ─────────── USERS ───────────
  const pwd = await bcrypt.hash("demo1234", 10);
  const [admin, mariaWaiter, juanWaiter, carlosWaiter, kitchenChef, cashier] = await Promise.all([
    prisma.user.create({ data: { restaurantId: restaurant.id, email: "admin@labrasa.pe", passwordHash: pwd, role: "ADMIN", name: "Marcos Vidal", avatarColor: "#C8941F" } }),
    prisma.user.create({ data: { restaurantId: restaurant.id, email: "maria@labrasa.pe", passwordHash: pwd, role: "WAITER", name: "María Quispe", avatarColor: "#A0322B" } }),
    prisma.user.create({ data: { restaurantId: restaurant.id, email: "juan@labrasa.pe", passwordHash: pwd, role: "WAITER", name: "Juan Cárdenas", avatarColor: "#C8941F" } }),
    prisma.user.create({ data: { restaurantId: restaurant.id, email: "carlos@labrasa.pe", passwordHash: pwd, role: "WAITER", name: "Carlos Mendoza", avatarColor: "#2D7D5A" } }),
    prisma.user.create({ data: { restaurantId: restaurant.id, email: "cocina@labrasa.pe", passwordHash: pwd, role: "KITCHEN", name: "Enrique Ruiz (Chef)", avatarColor: "#1F1A17" } }),
    prisma.user.create({ data: { restaurantId: restaurant.id, email: "caja@labrasa.pe", passwordHash: pwd, role: "CASHIER", name: "Lucía Vargas", avatarColor: "#3B82F6" } }),
  ]);

  console.log(`✓ Created restaurant + 6 users`);

  // ─────────── TABLES (16 in floor plan) ───────────
  const tableSeed = [
    { number: 1, x: 0, y: 0, seats: 4, zone: "Ventana" },
    { number: 2, x: 1, y: 0, seats: 4, zone: "Ventana" },
    { number: 3, x: 2, y: 0, seats: 6, zone: "Centro" },
    { number: 4, x: 3, y: 0, seats: 2, zone: "Centro" },
    { number: 5, x: 4, y: 0, seats: 4, zone: "Pared" },
    { number: 6, x: 0, y: 1, seats: 2, zone: "Ventana" },
    { number: 7, x: 1, y: 1, seats: 4, zone: "Centro" },
    { number: 8, x: 2, y: 1, seats: 8, zone: "Centro" },
    { number: 9, x: 3, y: 1, seats: 2, zone: "Centro" },
    { number: 10, x: 4, y: 1, seats: 4, zone: "Pared" },
    { number: 11, x: 0, y: 2, seats: 4, zone: "Ventana" },
    { number: 12, x: 1, y: 2, seats: 6, zone: "Centro" },
    { number: 13, x: 2, y: 2, seats: 2, zone: "Centro" },
    { number: 14, x: 3, y: 2, seats: 4, zone: "Pared" },
    { number: 15, x: 4, y: 2, seats: 4, zone: "Pared" },
    { number: 16, x: 5, y: 0, seats: 4, zone: "Terraza" }
  ];

  await prisma.table.createMany({
    data: tableSeed.map(t => ({ ...t, restaurantId: restaurant.id }))
  });
  console.log(`✓ Created ${tableSeed.length} tables`);

  // ─────────── MENU CATEGORIES ───────────
  const cats = [
    { name: "Pollos a la Brasa", displayOrder: 1 },
    { name: "Parrillas", displayOrder: 2 },
    { name: "Para Compartir", displayOrder: 3 },
    { name: "Sándwiches", displayOrder: 4 },
    { name: "Ensaladas", displayOrder: 5 },
    { name: "Acompañamientos", displayOrder: 6 },
    { name: "Bebidas", displayOrder: 7 },
    { name: "Postres", displayOrder: 8 }
  ];

  const categories = await Promise.all(
    cats.map(c => prisma.menuCategory.create({ data: { ...c, restaurantId: restaurant.id } }))
  );
  const cat = (name: string) => categories.find(c => c.name === name)!;

  // ─────────── MENU ITEMS ───────────
  const items = [
    // Pollos
    { cat: "Pollos a la Brasa", name: "1/4 de Pollo a la Brasa", desc: "Cuarto de pollo macerado 24h, asado al carbón. Con papas fritas y ensalada.", priceCents: 2290, prep: 15, station: "brasa", popular: true, calories: 580 },
    { cat: "Pollos a la Brasa", name: "1/2 Pollo a la Brasa", desc: "Medio pollo entero al carbón con papas y ensalada.", priceCents: 3890, prep: 18, station: "brasa", popular: true, recommended: true, calories: 920 },
    { cat: "Pollos a la Brasa", name: "Pollo Entero a la Brasa", desc: "Pollo entero asado a la leña, con papas familiares y ensalada.", priceCents: 6590, prep: 22, station: "brasa", popular: true, calories: 1820 },
    { cat: "Pollos a la Brasa", name: "Combo Familiar", desc: "1 pollo + 4 gaseosas + papas familiares + ensalada grande.", priceCents: 7990, prep: 22, station: "brasa", calories: 2400 },
    { cat: "Pollos a la Brasa", name: "Combo Pareja", desc: "1/2 pollo + 2 gaseosas + papas + ensalada.", priceCents: 4990, prep: 18, station: "brasa", recommended: true, calories: 1280 },

    // Parrillas
    { cat: "Parrillas", name: "Anticuchos de Corazón", desc: "4 brochetas marinadas en ají panca con papa y choclo.", priceCents: 2800, prep: 15, station: "parrilla", spicy: 2, popular: true, tags: ["picante"], calories: 480 },
    { cat: "Parrillas", name: "Parrilla Mixta Personal", desc: "Bife, chorizo, alitas y anticucho.", priceCents: 4200, prep: 20, station: "parrilla", spicy: 1, calories: 1100 },
    { cat: "Parrillas", name: "Alitas BBQ x10", desc: "10 alitas crocantes con salsa BBQ ahumada.", priceCents: 3200, prep: 17, station: "parrilla", spicy: 1, calories: 720 },
    { cat: "Parrillas", name: "Brochetas de Pollo", desc: "Brochetas de pechuga marinada, pimientos y cebolla.", priceCents: 2400, prep: 14, station: "parrilla", tags: ["sin_gluten"], calories: 540 },

    // Compartir
    { cat: "Para Compartir", name: "Piqueo Brasa", desc: "Tabla con alitas, anticuchos, salchipapa, mollejitas y chicharrón.", priceCents: 5800, prep: 18, station: "parrilla", spicy: 2, popular: true, recommended: true, tags: ["picante"], calories: 1850 },
    { cat: "Para Compartir", name: "Salchipapa Familiar", desc: "Papas fritas con salchichas y queso.", priceCents: 2500, prep: 12, station: "parrilla", calories: 980 },
    { cat: "Para Compartir", name: "Mollejitas al Ajo", desc: "Mollejitas salteadas con ajo y perejil.", priceCents: 2200, prep: 13, station: "parrilla", tags: ["sin_gluten"], calories: 420 },

    // Sándwiches
    { cat: "Sándwiches", name: "Sándwich de Pollo a la Brasa", desc: "Pan francés con pollo deshilachado, lechuga, tomate y mayonesa.", priceCents: 1800, prep: 10, station: "parrilla", calories: 620 },
    { cat: "Sándwiches", name: "Sándwich de Chicharrón de Pollo", desc: "Pan francés con chicharrón, salsa criolla y mayonesa.", priceCents: 1600, prep: 11, station: "parrilla", spicy: 1, tags: ["picante"], calories: 580 },

    // Ensaladas
    { cat: "Ensaladas", name: "Ensalada César con Pollo", desc: "Lechuga, croutons, parmesano, pollo y aderezo César.", priceCents: 2400, prep: 8, station: "frio", calories: 380 },
    { cat: "Ensaladas", name: "Ensalada de la Casa", desc: "Mix de lechugas, palta, tomate cherry y vinagreta de maracuyá.", priceCents: 1800, prep: 6, station: "frio", tags: ["vegetariano", "sin_gluten", "sin_lacteos"], calories: 240 },

    // Acompañamientos
    { cat: "Acompañamientos", name: "Papas Fritas", desc: "Papas amarillas frescas, fritas al momento.", priceCents: 1200, prep: 7, station: "parrilla", tags: ["vegetariano", "sin_lacteos"], calories: 420 },
    { cat: "Acompañamientos", name: "Yuca Frita", desc: "Yuca peruana frita con salsa huancaína.", priceCents: 1000, prep: 8, station: "parrilla", tags: ["vegetariano", "sin_gluten"], calories: 380 },
    { cat: "Acompañamientos", name: "Choclo con Queso", desc: "Choclo serrano con queso fresco andino.", priceCents: 1400, prep: 9, station: "frio", tags: ["vegetariano", "sin_gluten"], calories: 320 },
    { cat: "Acompañamientos", name: "Ensalada Fresca", desc: "Mix de hojas, tomate, pepino y cebolla.", priceCents: 800, prep: 5, station: "frio", tags: ["vegetariano", "sin_gluten", "sin_lacteos"], calories: 120 },

    // Bebidas
    { cat: "Bebidas", name: "Chicha Morada · Jarra 1L", desc: "Bebida tradicional de maíz morado, piña y canela.", priceCents: 1400, prep: 3, station: "bebidas", popular: true, recommended: true, tags: ["vegetariano", "sin_gluten", "sin_lacteos"], calories: 180 },
    { cat: "Bebidas", name: "Limonada Frozen", desc: "Limón fresco licuado con hielo.", priceCents: 1200, prep: 4, station: "bebidas", tags: ["vegetariano", "sin_gluten", "sin_lacteos"], calories: 90 },
    { cat: "Bebidas", name: "Inca Kola 1.5L", desc: "Botella familiar 1.5 litros.", priceCents: 1100, prep: 2, station: "bebidas", tags: ["vegetariano", "sin_gluten", "sin_lacteos"], calories: 240 },
    { cat: "Bebidas", name: "Coca Cola Personal", desc: "Coca Cola fría 500ml.", priceCents: 600, prep: 2, station: "bebidas", tags: ["vegetariano", "sin_gluten", "sin_lacteos"], calories: 200 },
    { cat: "Bebidas", name: "Cerveza Cusqueña", desc: "Cerveza dorada 620ml. +18 años.", priceCents: 1200, prep: 2, station: "bebidas", calories: 220 },
    { cat: "Bebidas", name: "Agua Sin Gas", desc: "Botella 625ml.", priceCents: 500, prep: 1, station: "bebidas", tags: ["vegetariano", "sin_gluten", "sin_lacteos"], calories: 0 },

    // Postres
    { cat: "Postres", name: "Suspiro a la Limeña", desc: "Manjar blanco con merengue al oporto y canela.", priceCents: 1400, prep: 5, station: "postres", recommended: true, tags: ["vegetariano"], calories: 480 },
    { cat: "Postres", name: "Torta de Chocolate", desc: "Torta húmeda con ganache y helado de vainilla.", priceCents: 1200, prep: 4, station: "postres", tags: ["vegetariano"], calories: 540 },
    { cat: "Postres", name: "Mazamorra Morada", desc: "Postre típico peruano de maíz morado, frutas y especias.", priceCents: 1000, prep: 4, station: "postres", tags: ["vegetariano", "sin_gluten", "sin_lacteos"], calories: 280 },
    { cat: "Postres", name: "Cheesecake de Fresa", desc: "Cheesecake clásico cremoso con coulis de fresas.", priceCents: 1400, prep: 4, station: "postres", tags: ["vegetariano"], calories: 460 }
  ];

  for (const it of items) {
    await prisma.menuItem.create({
      data: {
        categoryId: cat(it.cat).id,
        name: it.name,
        description: it.desc,
        priceCents: it.priceCents,
        prepMinutes: it.prep,
        kitchenStation: it.station,
        spicy: it.spicy ?? 0,
        calories: it.calories,
        tags: JSON.stringify(it.tags ?? []),
        popular: it.popular ?? false,
        recommended: it.recommended ?? false
      }
    });
  }
  console.log(`✓ Created ${items.length} menu items`);

  // ═══════════════════════════════════════════════════════════
  //                ERP MODULE — Suppliers
  // ═══════════════════════════════════════════════════════════
  const [proveedorAves, proveedorAbarrotes, proveedorVerduras, proveedorBebidas] = await Promise.all([
    prisma.supplier.create({ data: { restaurantId: restaurant.id, name: "Avícola San Fernando", contactName: "Pedro Gómez", phone: "+51 987 654 321", email: "ventas@sanfernando.pe", ruc: "20100100100", paymentTerms: "CREDITO_15", deliveryDays: JSON.stringify([1, 4]), autoOrderEnabled: true } }),
    prisma.supplier.create({ data: { restaurantId: restaurant.id, name: "Distribuidora La Despensa", contactName: "Rosa Torres", phone: "+51 999 111 222", email: "pedidos@ladespensa.pe", ruc: "20200200200", paymentTerms: "CONTADO", deliveryDays: JSON.stringify([2, 5]), autoOrderEnabled: true } }),
    prisma.supplier.create({ data: { restaurantId: restaurant.id, name: "Frutas y Verduras del Mercado", contactName: "Don Wilmer", phone: "+51 955 333 444", paymentTerms: "CONTADO", deliveryDays: JSON.stringify([1, 2, 3, 4, 5, 6]), autoOrderEnabled: false } }),
    prisma.supplier.create({ data: { restaurantId: restaurant.id, name: "Backus Distribuciones", contactName: "Andrés Vega", phone: "+51 988 555 777", ruc: "20300300300", paymentTerms: "CREDITO_30", deliveryDays: JSON.stringify([3]), autoOrderEnabled: true } })
  ]);
  console.log(`✓ Created 4 suppliers`);

  // Ingredient categories
  const [catProteinas, catCarbos, catVerduras, catLacteos, catBebidas, catCondimentos, catEmpaque] = await Promise.all([
    prisma.ingredientCategory.create({ data: { restaurantId: restaurant.id, name: "Proteínas", displayOrder: 1 } }),
    prisma.ingredientCategory.create({ data: { restaurantId: restaurant.id, name: "Carbohidratos", displayOrder: 2 } }),
    prisma.ingredientCategory.create({ data: { restaurantId: restaurant.id, name: "Verduras y frutas", displayOrder: 3 } }),
    prisma.ingredientCategory.create({ data: { restaurantId: restaurant.id, name: "Lácteos y huevos", displayOrder: 4 } }),
    prisma.ingredientCategory.create({ data: { restaurantId: restaurant.id, name: "Bebidas", displayOrder: 5 } }),
    prisma.ingredientCategory.create({ data: { restaurantId: restaurant.id, name: "Condimentos y salsas", displayOrder: 6 } }),
    prisma.ingredientCategory.create({ data: { restaurantId: restaurant.id, name: "Empaques y otros", displayOrder: 7 } })
  ]);

  // Ingredients (insumos)
  const ingDefs = [
    // Proteínas
    { name: "Pollo entero", unit: "unidad", current: 28, min: 15, critical: 10, optimal: 60, costCents: 1850, cat: catProteinas, sup: proveedorAves, perish: true },
    { name: "Carne de res (lomo)", unit: "kg", current: 6.5, min: 5, critical: 3, optimal: 15, costCents: 4200, cat: catProteinas, sup: proveedorAbarrotes, perish: true },
    { name: "Corazón de res", unit: "kg", current: 3.2, min: 4, critical: 2, optimal: 10, costCents: 2800, cat: catProteinas, sup: proveedorAbarrotes, perish: true },
    { name: "Chorizo parrillero", unit: "unidad", current: 45, min: 20, critical: 10, optimal: 80, costCents: 350, cat: catProteinas, sup: proveedorAbarrotes, perish: true },
    { name: "Mollejitas", unit: "kg", current: 1.8, min: 2, critical: 1, optimal: 5, costCents: 1800, cat: catProteinas, sup: proveedorAves, perish: true },
    // Carbos
    { name: "Papas amarillas", unit: "kg", current: 38, min: 20, critical: 10, optimal: 80, costCents: 280, cat: catCarbos, sup: proveedorVerduras, perish: false },
    { name: "Yuca", unit: "kg", current: 12, min: 8, critical: 4, optimal: 25, costCents: 320, cat: catCarbos, sup: proveedorVerduras, perish: false },
    { name: "Pan francés", unit: "unidad", current: 80, min: 50, critical: 20, optimal: 200, costCents: 50, cat: catCarbos, sup: proveedorAbarrotes, perish: true },
    { name: "Arroz", unit: "kg", current: 22, min: 10, critical: 5, optimal: 40, costCents: 420, cat: catCarbos, sup: proveedorAbarrotes, perish: false },
    // Verduras
    { name: "Lechuga romana", unit: "unidad", current: 14, min: 10, critical: 5, optimal: 30, costCents: 250, cat: catVerduras, sup: proveedorVerduras, perish: true },
    { name: "Tomate", unit: "kg", current: 8, min: 6, critical: 3, optimal: 18, costCents: 380, cat: catVerduras, sup: proveedorVerduras, perish: true },
    { name: "Cebolla roja", unit: "kg", current: 11, min: 5, critical: 2, optimal: 20, costCents: 250, cat: catVerduras, sup: proveedorVerduras, perish: false },
    { name: "Limón", unit: "kg", current: 4.2, min: 5, critical: 2, optimal: 12, costCents: 380, cat: catVerduras, sup: proveedorVerduras, perish: true },
    { name: "Maíz morado", unit: "kg", current: 6, min: 4, critical: 2, optimal: 12, costCents: 580, cat: catVerduras, sup: proveedorAbarrotes, perish: false },
    { name: "Choclo", unit: "unidad", current: 22, min: 15, critical: 8, optimal: 40, costCents: 220, cat: catVerduras, sup: proveedorVerduras, perish: true },
    { name: "Palta", unit: "unidad", current: 18, min: 10, critical: 5, optimal: 30, costCents: 280, cat: catVerduras, sup: proveedorVerduras, perish: true },
    // Lácteos
    { name: "Queso fresco", unit: "kg", current: 1.5, min: 2, critical: 1, optimal: 5, costCents: 2200, cat: catLacteos, sup: proveedorAbarrotes, perish: true },
    { name: "Mantequilla", unit: "kg", current: 2.2, min: 1, critical: 0.5, optimal: 4, costCents: 3200, cat: catLacteos, sup: proveedorAbarrotes, perish: true },
    { name: "Leche", unit: "l", current: 8, min: 4, critical: 2, optimal: 15, costCents: 480, cat: catLacteos, sup: proveedorAbarrotes, perish: true },
    { name: "Crema de leche", unit: "l", current: 3, min: 2, critical: 1, optimal: 6, costCents: 850, cat: catLacteos, sup: proveedorAbarrotes, perish: true },
    // Bebidas
    { name: "Inca Kola 1.5L", unit: "unidad", current: 65, min: 40, critical: 20, optimal: 120, costCents: 750, cat: catBebidas, sup: proveedorBebidas, perish: false },
    { name: "Coca Cola personal", unit: "unidad", current: 95, min: 50, critical: 25, optimal: 150, costCents: 380, cat: catBebidas, sup: proveedorBebidas, perish: false },
    { name: "Cerveza Cusqueña 620ml", unit: "unidad", current: 85, min: 50, critical: 25, optimal: 150, costCents: 720, cat: catBebidas, sup: proveedorBebidas, perish: false },
    { name: "Agua mineral 625ml", unit: "unidad", current: 55, min: 40, critical: 20, optimal: 100, costCents: 220, cat: catBebidas, sup: proveedorBebidas, perish: false },
    // Condimentos
    { name: "Ají panca pasta", unit: "kg", current: 4.5, min: 3, critical: 1, optimal: 10, costCents: 2400, cat: catCondimentos, sup: proveedorAbarrotes, perish: false },
    { name: "Ají amarillo pasta", unit: "kg", current: 3.8, min: 3, critical: 1, optimal: 10, costCents: 2200, cat: catCondimentos, sup: proveedorAbarrotes, perish: false },
    { name: "Aceite vegetal", unit: "l", current: 18, min: 10, critical: 5, optimal: 40, costCents: 980, cat: catCondimentos, sup: proveedorAbarrotes, perish: false },
    { name: "Salsa BBQ", unit: "l", current: 4, min: 3, critical: 1, optimal: 8, costCents: 1800, cat: catCondimentos, sup: proveedorAbarrotes, perish: false },
    { name: "Mayonesa", unit: "kg", current: 5.5, min: 4, critical: 2, optimal: 12, costCents: 1400, cat: catCondimentos, sup: proveedorAbarrotes, perish: true },
    { name: "Sal", unit: "kg", current: 6, min: 3, critical: 1, optimal: 10, costCents: 180, cat: catCondimentos, sup: proveedorAbarrotes, perish: false },
    { name: "Canela", unit: "kg", current: 0.4, min: 0.3, critical: 0.1, optimal: 1, costCents: 8500, cat: catCondimentos, sup: proveedorAbarrotes, perish: false }
  ];

  const ingMap = new Map<string, string>();
  for (const ing of ingDefs) {
    const created = await prisma.ingredient.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: ing.cat.id,
        supplierId: ing.sup.id,
        name: ing.name,
        unit: ing.unit,
        currentStock: ing.current,
        minStock: ing.min,
        criticalStock: ing.critical,
        optimalStock: ing.optimal,
        costPerUnitCents: ing.costCents,
        avgCostPerUnitCents: ing.costCents,
        trackExpiration: ing.perish
      }
    });
    ingMap.set(ing.name, created.id);

    // For perishables, create an expiration lot
    if (ing.perish) {
      const days = ing.unit === "kg" || ing.unit === "l" ? 7 : 5;
      await prisma.expirationLot.create({
        data: {
          ingredientId: created.id,
          qty: ing.current,
          qtyRemaining: ing.current,
          unitCostCents: ing.costCents,
          receivedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          expirationDate: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
          status: "ACTIVE"
        }
      });
    }
  }
  console.log(`✓ Created ${ingDefs.length} ingredients (with expiration lots for perishables)`);

  // ═══════════════════════════════════════════════════════════
  //                Recipes (menu item ←→ ingredients)
  // ═══════════════════════════════════════════════════════════
  const menuItems = await prisma.menuItem.findMany();
  const item = (name: string) => menuItems.find(m => m.name === name)!;
  const ing = (name: string) => ingMap.get(name)!;

  const recipes: { menuName: string; uses: { name: string; qty: number; unit: string }[] }[] = [
    { menuName: "1/4 de Pollo a la Brasa", uses: [
      { name: "Pollo entero", qty: 0.25, unit: "unidad" },
      { name: "Papas amarillas", qty: 0.2, unit: "kg" },
      { name: "Lechuga romana", qty: 0.25, unit: "unidad" },
      { name: "Aceite vegetal", qty: 0.05, unit: "l" }
    ]},
    { menuName: "1/2 Pollo a la Brasa", uses: [
      { name: "Pollo entero", qty: 0.5, unit: "unidad" },
      { name: "Papas amarillas", qty: 0.3, unit: "kg" },
      { name: "Lechuga romana", qty: 0.4, unit: "unidad" },
      { name: "Aceite vegetal", qty: 0.08, unit: "l" }
    ]},
    { menuName: "Pollo Entero a la Brasa", uses: [
      { name: "Pollo entero", qty: 1, unit: "unidad" },
      { name: "Papas amarillas", qty: 0.6, unit: "kg" },
      { name: "Lechuga romana", qty: 0.7, unit: "unidad" },
      { name: "Aceite vegetal", qty: 0.12, unit: "l" }
    ]},
    { menuName: "Anticuchos de Corazón", uses: [
      { name: "Corazón de res", qty: 0.25, unit: "kg" },
      { name: "Ají panca pasta", qty: 0.04, unit: "kg" },
      { name: "Choclo", qty: 0.5, unit: "unidad" },
      { name: "Papas amarillas", qty: 0.15, unit: "kg" }
    ]},
    { menuName: "Parrilla Mixta Personal", uses: [
      { name: "Carne de res (lomo)", qty: 0.18, unit: "kg" },
      { name: "Chorizo parrillero", qty: 1, unit: "unidad" },
      { name: "Corazón de res", qty: 0.08, unit: "kg" },
      { name: "Papas amarillas", qty: 0.2, unit: "kg" },
      { name: "Yuca", qty: 0.15, unit: "kg" }
    ]},
    { menuName: "Alitas BBQ x10", uses: [
      { name: "Pollo entero", qty: 0.4, unit: "unidad" },
      { name: "Salsa BBQ", qty: 0.15, unit: "l" },
      { name: "Papas amarillas", qty: 0.18, unit: "kg" }
    ]},
    { menuName: "Mollejitas al Ajo", uses: [
      { name: "Mollejitas", qty: 0.22, unit: "kg" },
      { name: "Aceite vegetal", qty: 0.04, unit: "l" }
    ]},
    { menuName: "Salchipapa Familiar", uses: [
      { name: "Papas amarillas", qty: 0.5, unit: "kg" },
      { name: "Chorizo parrillero", qty: 2, unit: "unidad" },
      { name: "Aceite vegetal", qty: 0.08, unit: "l" },
      { name: "Mayonesa", qty: 0.04, unit: "kg" }
    ]},
    { menuName: "Sándwich de Pollo a la Brasa", uses: [
      { name: "Pan francés", qty: 1, unit: "unidad" },
      { name: "Pollo entero", qty: 0.18, unit: "unidad" },
      { name: "Lechuga romana", qty: 0.15, unit: "unidad" },
      { name: "Tomate", qty: 0.05, unit: "kg" },
      { name: "Mayonesa", qty: 0.02, unit: "kg" }
    ]},
    { menuName: "Ensalada César con Pollo", uses: [
      { name: "Lechuga romana", qty: 0.6, unit: "unidad" },
      { name: "Pollo entero", qty: 0.2, unit: "unidad" },
      { name: "Queso fresco", qty: 0.04, unit: "kg" }
    ]},
    { menuName: "Ensalada de la Casa", uses: [
      { name: "Lechuga romana", qty: 0.4, unit: "unidad" },
      { name: "Tomate", qty: 0.08, unit: "kg" },
      { name: "Palta", qty: 0.5, unit: "unidad" },
      { name: "Choclo", qty: 0.3, unit: "unidad" }
    ]},
    { menuName: "Papas Fritas", uses: [
      { name: "Papas amarillas", qty: 0.35, unit: "kg" },
      { name: "Aceite vegetal", qty: 0.06, unit: "l" }
    ]},
    { menuName: "Yuca Frita", uses: [
      { name: "Yuca", qty: 0.3, unit: "kg" },
      { name: "Aceite vegetal", qty: 0.05, unit: "l" }
    ]},
    { menuName: "Choclo con Queso", uses: [
      { name: "Choclo", qty: 1, unit: "unidad" },
      { name: "Queso fresco", qty: 0.06, unit: "kg" }
    ]},
    { menuName: "Chicha Morada · Jarra 1L", uses: [
      { name: "Maíz morado", qty: 0.15, unit: "kg" },
      { name: "Canela", qty: 0.005, unit: "kg" },
      { name: "Limón", qty: 0.05, unit: "kg" }
    ]},
    { menuName: "Limonada Frozen", uses: [
      { name: "Limón", qty: 0.18, unit: "kg" }
    ]},
    { menuName: "Inca Kola 1.5L", uses: [
      { name: "Inca Kola 1.5L", qty: 1, unit: "unidad" }
    ]},
    { menuName: "Coca Cola Personal", uses: [
      { name: "Coca Cola personal", qty: 1, unit: "unidad" }
    ]},
    { menuName: "Cerveza Cusqueña", uses: [
      { name: "Cerveza Cusqueña 620ml", qty: 1, unit: "unidad" }
    ]},
    { menuName: "Agua Sin Gas", uses: [
      { name: "Agua mineral 625ml", qty: 1, unit: "unidad" }
    ]}
  ];

  for (const r of recipes) {
    const m = item(r.menuName);
    if (!m) continue;
    for (const u of r.uses) {
      const i = ing(u.name);
      if (!i) continue;
      await prisma.recipeIngredient.create({
        data: { menuItemId: m.id, ingredientId: i, qty: u.qty, unit: u.unit }
      });
    }
  }
  console.log(`✓ Created recipes for ${recipes.length} menu items`);

  // ═══════════════════════════════════════════════════════════
  //                Sample Customers (CRM)
  // ═══════════════════════════════════════════════════════════
  await Promise.all([
    prisma.customer.create({ data: { restaurantId: restaurant.id, name: "Lucía Mendoza", dni: "44567890", email: "lmendoza@gmail.com", phone: "+51 988 111 222", totalVisits: 14, totalSpentCents: 89400, avgTicketCents: 6385, tags: JSON.stringify(["VIP", "FRECUENTE"]), preferences: JSON.stringify({ favorite: "1/2 Pollo a la Brasa", lang: "es" }) } }),
    prisma.customer.create({ data: { restaurantId: restaurant.id, name: "Roberto Silva", dni: "12345678", phone: "+51 999 555 444", totalVisits: 8, totalSpentCents: 42500, avgTicketCents: 5312, tags: JSON.stringify(["FRECUENTE"]), lastVisitAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000) } }),
    prisma.customer.create({ data: { restaurantId: restaurant.id, name: "Andrea Vega", email: "andre@empresa.com", totalVisits: 22, totalSpentCents: 184500, avgTicketCents: 8386, tags: JSON.stringify(["VIP", "FRECUENTE", "BUSINESS"]) } }),
    prisma.customer.create({ data: { restaurantId: restaurant.id, name: "Cliente esporádico", totalVisits: 2, totalSpentCents: 8900, avgTicketCents: 4450, tags: JSON.stringify(["RIESGO_FUGA"]), lastVisitAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } })
  ]);
  console.log(`✓ Created 4 demo customers`);

  console.log("\n✅ Seed completed.");
  console.log("\nLogin demo:");
  console.log("  Admin    → admin@labrasa.pe / demo1234");
  console.log("  Mozo     → maria@labrasa.pe / demo1234");
  console.log("  Cocina   → cocina@labrasa.pe / demo1234");
  console.log("  Caja     → caja@labrasa.pe / demo1234");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
