import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding MesaSmart database...");

  // Idempotent guard: skip if DB already has restaurants (prod safety)
  const existing = await prisma.restaurant.count();
  if (existing > 0 && process.env.SEED_FORCE !== "true") {
    console.log(`✓ DB already seeded (${existing} restaurants). Skipping. Set SEED_FORCE=true to re-seed.`);
    return;
  }

  // Clean (used for re-seeding)
  await prisma.modificationRequest.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.comprobante.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.call.deleteMany();
  await prisma.recipeIngredient.deleteMany();
  await prisma.inventoryCountLine.deleteMany();
  await prisma.inventoryCount.deleteMany();
  await prisma.goodsReceiptLine.deleteMany();
  await prisma.goodsReceipt.deleteMany();
  await prisma.transformationExecution.deleteMany();
  await prisma.ingredientTransformation.deleteMany();
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
  await prisma.auditLog.deleteMany();
  await prisma.restaurantPlan.deleteMany();
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
    prisma.user.create({ data: { restaurantId: restaurant.id, email: "admin@labrasa.pe", passwordHash: pwd, role: "ADMIN", name: "Marcos Vidal", avatarColor: "#C8941F", position: "Administrador", contractType: "FULL_TIME", monthlySalaryCents: 450000, expectedHoursPerWeek: 48, hiredAt: new Date("2022-03-01"), dni: "44567890" } }),
    prisma.user.create({ data: { restaurantId: restaurant.id, email: "maria@labrasa.pe", passwordHash: pwd, role: "WAITER", name: "María Quispe", avatarColor: "#A0322B", position: "Mozo/a", contractType: "FULL_TIME", monthlySalaryCents: 165000, expectedHoursPerWeek: 48, hiredAt: new Date("2023-06-15"), dni: "12345678" } }),
    prisma.user.create({ data: { restaurantId: restaurant.id, email: "juan@labrasa.pe", passwordHash: pwd, role: "WAITER", name: "Juan Cárdenas", avatarColor: "#C8941F", position: "Mozo/a", contractType: "FULL_TIME", monthlySalaryCents: 165000, expectedHoursPerWeek: 48, hiredAt: new Date("2023-09-01"), dni: "23456789" } }),
    prisma.user.create({ data: { restaurantId: restaurant.id, email: "carlos@labrasa.pe", passwordHash: pwd, role: "WAITER", name: "Carlos Mendoza", avatarColor: "#2D7D5A", position: "Mozo/a", contractType: "PART_TIME", monthlySalaryCents: 110000, expectedHoursPerWeek: 30, hiredAt: new Date("2024-01-10"), dni: "34567890" } }),
    prisma.user.create({ data: { restaurantId: restaurant.id, email: "cocina@labrasa.pe", passwordHash: pwd, role: "KITCHEN", name: "Enrique Ruiz", avatarColor: "#1F1A17", position: "Chef ejecutivo", contractType: "FULL_TIME", monthlySalaryCents: 380000, expectedHoursPerWeek: 54, hiredAt: new Date("2022-05-15"), dni: "45678901" } }),
    prisma.user.create({ data: { restaurantId: restaurant.id, email: "caja@labrasa.pe", passwordHash: pwd, role: "CASHIER", name: "Lucía Vargas", avatarColor: "#3B82F6", position: "Cajero/a", contractType: "FULL_TIME", monthlySalaryCents: 175000, expectedHoursPerWeek: 48, hiredAt: new Date("2023-11-20"), dni: "56789012" } }),
  ]);

  // Personal adicional sin login activo (solo nómina)
  const noLoginPwd = "$2b$10$NoLoginHash";
  await Promise.all([
    prisma.user.create({ data: { restaurantId: restaurant.id, email: "pedro-staff@labrasa.local", passwordHash: noLoginPwd, role: "KITCHEN", name: "Pedro Aguilar", avatarColor: "#7E2820", position: "Cocinero/a · Brasa", contractType: "FULL_TIME", monthlySalaryCents: 195000, expectedHoursPerWeek: 54, hiredAt: new Date("2023-04-20"), dni: "67890123" } }),
    prisma.user.create({ data: { restaurantId: restaurant.id, email: "rosa-staff@labrasa.local", passwordHash: noLoginPwd, role: "KITCHEN", name: "Rosa Mendoza", avatarColor: "#C4493A", position: "Ayudante de cocina", contractType: "FULL_TIME", monthlySalaryCents: 140000, expectedHoursPerWeek: 48, hiredAt: new Date("2024-02-01"), dni: "78901234" } }),
    prisma.user.create({ data: { restaurantId: restaurant.id, email: "sergio-staff@labrasa.local", passwordHash: noLoginPwd, role: "KITCHEN", name: "Sergio Pérez", avatarColor: "#2D7D5A", position: "Bartender", contractType: "PART_TIME", monthlySalaryCents: 130000, expectedHoursPerWeek: 36, hiredAt: new Date("2024-05-15"), dni: "89012345" } }),
    prisma.user.create({ data: { restaurantId: restaurant.id, email: "ana-staff@labrasa.local", passwordHash: noLoginPwd, role: "WAITER", name: "Ana Torres", avatarColor: "#3B82F6", position: "Limpieza", contractType: "PART_TIME", monthlySalaryCents: 105000, expectedHoursPerWeek: 30, hiredAt: new Date("2024-07-01"), dni: "90123456" } })
  ]);

  console.log(`✓ Created restaurant + 6 logging users + 4 staff (10 total para nómina)`);

  // ─────────── RESTAURANT PLAN ───────────
  await prisma.restaurantPlan.create({
    data: {
      restaurantId: restaurant.id,
      pos: true,
      inventory: true,
      transformations: true,
      multiLocation: false,
      pnl: true,
      campaigns: true,
      customerTablet: true,
      totem: false,
      ai: true
    }
  });
  console.log(`✓ Created RestaurantPlan (all modules enabled for demo)`);

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
    // Proteínas · Raw materials
    { name: "Pollo entero", unit: "unidad", current: 28, min: 15, critical: 10, optimal: 60, costCents: 1850, cat: catProteinas, sup: proveedorAves, perish: true, level: "RAW" },
    { name: "Pescado bonito entero", unit: "kg", current: 12, min: 8, critical: 5, optimal: 25, costCents: 1800, cat: catProteinas, sup: proveedorAbarrotes, perish: true, level: "RAW" },
    { name: "Carne de res (lomo)", unit: "kg", current: 6.5, min: 5, critical: 3, optimal: 15, costCents: 4200, cat: catProteinas, sup: proveedorAbarrotes, perish: true, level: "RAW" },
    { name: "Corazón de res", unit: "kg", current: 3.2, min: 4, critical: 2, optimal: 10, costCents: 2800, cat: catProteinas, sup: proveedorAbarrotes, perish: true, level: "PREPARED" },
    { name: "Chorizo parrillero", unit: "unidad", current: 45, min: 20, critical: 10, optimal: 80, costCents: 350, cat: catProteinas, sup: proveedorAbarrotes, perish: true, level: "PREPARED" },
    { name: "Mollejitas", unit: "kg", current: 1.8, min: 2, critical: 1, optimal: 5, costCents: 1800, cat: catProteinas, sup: proveedorAves, perish: true, level: "PREPARED" },
    // Intermediate products from transformations
    { name: "Pollo trozado", unit: "kg", current: 0, min: 0, critical: 0, optimal: 5, costCents: 0, cat: catProteinas, sup: proveedorAves, perish: true, level: "INTERMEDIATE" },
    { name: "Pechugas deshuesadas", unit: "kg", current: 0, min: 0, critical: 0, optimal: 8, costCents: 0, cat: catProteinas, sup: proveedorAves, perish: true, level: "PREPARED" },
    { name: "Pescado sin vísceras", unit: "kg", current: 0, min: 0, critical: 0, optimal: 10, costCents: 0, cat: catProteinas, sup: proveedorAbarrotes, perish: true, level: "INTERMEDIATE" },
    { name: "Pescado fileteado", unit: "kg", current: 0, min: 0, critical: 0, optimal: 8, costCents: 0, cat: catProteinas, sup: proveedorAbarrotes, perish: true, level: "PREPARED" },
    { name: "Pescado picado", unit: "kg", current: 0, min: 0, critical: 0, optimal: 6, costCents: 0, cat: catProteinas, sup: proveedorAbarrotes, perish: true, level: "PREPARED" },
    { name: "Lomo limpio", unit: "kg", current: 0, min: 0, critical: 0, optimal: 5, costCents: 0, cat: catProteinas, sup: proveedorAbarrotes, perish: true, level: "PREPARED" },
    // Carbos
    { name: "Papas amarillas", unit: "kg", current: 38, min: 20, critical: 10, optimal: 80, costCents: 280, cat: catCarbos, sup: proveedorVerduras, perish: false, level: "RAW" },
    { name: "Yuca", unit: "kg", current: 12, min: 8, critical: 4, optimal: 25, costCents: 320, cat: catCarbos, sup: proveedorVerduras, perish: false, level: "RAW" },
    { name: "Pan francés", unit: "unidad", current: 80, min: 50, critical: 20, optimal: 200, costCents: 50, cat: catCarbos, sup: proveedorAbarrotes, perish: true, level: "PREPARED" },
    { name: "Arroz", unit: "kg", current: 22, min: 10, critical: 5, optimal: 40, costCents: 420, cat: catCarbos, sup: proveedorAbarrotes, perish: false, level: "RAW" },
    // Verduras
    { name: "Lechuga romana", unit: "unidad", current: 14, min: 10, critical: 5, optimal: 30, costCents: 250, cat: catVerduras, sup: proveedorVerduras, perish: true, level: "RAW" },
    { name: "Tomate", unit: "kg", current: 8, min: 6, critical: 3, optimal: 18, costCents: 380, cat: catVerduras, sup: proveedorVerduras, perish: true, level: "RAW" },
    { name: "Cebolla roja", unit: "kg", current: 11, min: 5, critical: 2, optimal: 20, costCents: 250, cat: catVerduras, sup: proveedorVerduras, perish: false, level: "RAW" },
    { name: "Limón", unit: "kg", current: 4.2, min: 5, critical: 2, optimal: 12, costCents: 380, cat: catVerduras, sup: proveedorVerduras, perish: true, level: "RAW" },
    { name: "Maíz morado", unit: "kg", current: 6, min: 4, critical: 2, optimal: 12, costCents: 580, cat: catVerduras, sup: proveedorAbarrotes, perish: false, level: "RAW" },
    { name: "Choclo", unit: "unidad", current: 22, min: 15, critical: 8, optimal: 40, costCents: 220, cat: catVerduras, sup: proveedorVerduras, perish: true, level: "RAW" },
    { name: "Palta", unit: "unidad", current: 18, min: 10, critical: 5, optimal: 30, costCents: 280, cat: catVerduras, sup: proveedorVerduras, perish: true, level: "RAW" },
    // Lácteos
    { name: "Queso fresco", unit: "kg", current: 1.5, min: 2, critical: 1, optimal: 5, costCents: 2200, cat: catLacteos, sup: proveedorAbarrotes, perish: true, level: "RAW" },
    { name: "Mantequilla", unit: "kg", current: 2.2, min: 1, critical: 0.5, optimal: 4, costCents: 3200, cat: catLacteos, sup: proveedorAbarrotes, perish: true, level: "RAW" },
    { name: "Leche", unit: "l", current: 8, min: 4, critical: 2, optimal: 15, costCents: 480, cat: catLacteos, sup: proveedorAbarrotes, perish: true, level: "RAW" },
    { name: "Crema de leche", unit: "l", current: 3, min: 2, critical: 1, optimal: 6, costCents: 850, cat: catLacteos, sup: proveedorAbarrotes, perish: true, level: "RAW" },
    // Bebidas
    { name: "Inca Kola 1.5L", unit: "unidad", current: 65, min: 40, critical: 20, optimal: 120, costCents: 750, cat: catBebidas, sup: proveedorBebidas, perish: false, level: "PREPARED" },
    { name: "Coca Cola personal", unit: "unidad", current: 95, min: 50, critical: 25, optimal: 150, costCents: 380, cat: catBebidas, sup: proveedorBebidas, perish: false, level: "PREPARED" },
    { name: "Cerveza Cusqueña 620ml", unit: "unidad", current: 85, min: 50, critical: 25, optimal: 150, costCents: 720, cat: catBebidas, sup: proveedorBebidas, perish: false, level: "PREPARED" },
    { name: "Agua mineral 625ml", unit: "unidad", current: 55, min: 40, critical: 20, optimal: 100, costCents: 220, cat: catBebidas, sup: proveedorBebidas, perish: false, level: "PREPARED" },
    // Condimentos
    { name: "Ají panca pasta", unit: "kg", current: 4.5, min: 3, critical: 1, optimal: 10, costCents: 2400, cat: catCondimentos, sup: proveedorAbarrotes, perish: false, level: "RAW" },
    { name: "Ají amarillo pasta", unit: "kg", current: 3.8, min: 3, critical: 1, optimal: 10, costCents: 2200, cat: catCondimentos, sup: proveedorAbarrotes, perish: false, level: "RAW" },
    { name: "Aceite vegetal", unit: "l", current: 18, min: 10, critical: 5, optimal: 40, costCents: 980, cat: catCondimentos, sup: proveedorAbarrotes, perish: false, level: "RAW" },
    { name: "Salsa BBQ", unit: "l", current: 4, min: 3, critical: 1, optimal: 8, costCents: 1800, cat: catCondimentos, sup: proveedorAbarrotes, perish: false, level: "PREPARED" },
    { name: "Mayonesa", unit: "kg", current: 5.5, min: 4, critical: 2, optimal: 12, costCents: 1400, cat: catCondimentos, sup: proveedorAbarrotes, perish: true, level: "RAW" },
    { name: "Sal", unit: "kg", current: 6, min: 3, critical: 1, optimal: 10, costCents: 180, cat: catCondimentos, sup: proveedorAbarrotes, perish: false, level: "RAW" },
    { name: "Canela", unit: "kg", current: 0.4, min: 0.3, critical: 0.1, optimal: 1, costCents: 8500, cat: catCondimentos, sup: proveedorAbarrotes, perish: false, level: "RAW" }
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
        trackExpiration: ing.perish,
        level: ing.level ?? "RAW"
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
  //        Ingredient Transformations (Conversiones)
  // ═══════════════════════════════════════════════════════════
  const transformations = [
    // Pescado bonito: entero → sin vísceras (80% yield)
    {
      fromName: "Pescado bonito entero",
      toName: "Pescado sin vísceras",
      inputQty: 1.0,
      outputQty: 0.8,
      laborMinutes: 5,
      station: "frio"
    },
    // Pescado: sin vísceras → fileteado (75% of intermediate = 60% global)
    {
      fromName: "Pescado sin vísceras",
      toName: "Pescado fileteado",
      inputQty: 1.0,
      outputQty: 0.75,
      laborMinutes: 8,
      station: "frio"
    },
    // Pescado: filete → picado (92% of filete = 55% global)
    {
      fromName: "Pescado fileteado",
      toName: "Pescado picado",
      inputQty: 1.0,
      outputQty: 0.92,
      laborMinutes: 12,
      station: "prep"
    },
    // Pollo: entero → trozado (95% yield)
    {
      fromName: "Pollo entero",
      toName: "Pollo trozado",
      inputQty: 1.0,
      outputQty: 0.95,
      laborMinutes: 5,
      station: "frio"
    },
    // Pollo: trozado → pechugas deshuesadas (70% of trozado = 66.5% global)
    {
      fromName: "Pollo trozado",
      toName: "Pechugas deshuesadas",
      inputQty: 1.0,
      outputQty: 0.70,
      laborMinutes: 4,
      station: "frio"
    },
    // Lomo: entero → limpio (88% yield)
    {
      fromName: "Carne de res (lomo)",
      toName: "Lomo limpio",
      inputQty: 1.0,
      outputQty: 0.88,
      laborMinutes: 6,
      station: "frio"
    }
  ];

  for (const t of transformations) {
    const fromId = ingMap.get(t.fromName);
    const toId = ingMap.get(t.toName);
    if (!fromId || !toId) {
      console.warn(`⚠ Transformation ${t.fromName} → ${t.toName} skipped (ingredient not found)`);
      continue;
    }

    const yieldPct = (t.outputQty / t.inputQty) * 100;
    const laborCostCents = Math.round(t.laborMinutes * 50); // 50 cents per minute avg

    await prisma.ingredientTransformation.create({
      data: {
        restaurantId: restaurant.id,
        fromIngredientId: fromId,
        toIngredientId: toId,
        inputQty: t.inputQty,
        outputQty: t.outputQty,
        yieldPct,
        laborMinutes: t.laborMinutes,
        laborCostCents,
        station: t.station
      }
    });
  }
  console.log(`✓ Created ${transformations.length} ingredient transformations`);

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

  // ═══════════════════════════════════════════════════════════
  //          Loss Prevention · Cámaras + Reglas + Alertas
  // ═══════════════════════════════════════════════════════════
  const cameras = await Promise.all([
    prisma.camera.create({ data: { restaurantId: restaurant.id, name: "Cámara Caja Principal", location: "CAJA", status: "ONLINE", thumbnailUrl: "https://images.unsplash.com/photo-1556742393-d75f468bfcb0?auto=format&fit=crop&w=400&q=70" } }),
    prisma.camera.create({ data: { restaurantId: restaurant.id, name: "Cámara Cocina Brasa", location: "COCINA", status: "ONLINE", thumbnailUrl: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=400&q=70" } }),
    prisma.camera.create({ data: { restaurantId: restaurant.id, name: "Cámara Almacén", location: "ALMACEN", status: "ONLINE", thumbnailUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=400&q=70" } }),
    prisma.camera.create({ data: { restaurantId: restaurant.id, name: "Cámara Puerta Trasera", location: "PUERTA_TRASERA", status: "ONLINE", thumbnailUrl: "https://images.unsplash.com/photo-1568998270908-fe1f57c8f6e0?auto=format&fit=crop&w=400&q=70" } }),
    prisma.camera.create({ data: { restaurantId: restaurant.id, name: "Cámara Salón Principal", location: "SALON", status: "ONLINE", thumbnailUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=400&q=70" } }),
    prisma.camera.create({ data: { restaurantId: restaurant.id, name: "Cámara Barra", location: "BARRA", status: "ONLINE", thumbnailUrl: "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?auto=format&fit=crop&w=400&q=70" } })
  ]);
  console.log(`✓ Created ${cameras.length} security cameras`);

  // Reglas de detección por defecto (todas habilitadas)
  const ruleTypes = ["FAKE_RECEIPT", "THEFT_INVENTORY", "OPEN_REGISTER_NO_TX", "UNUSUAL_AREA", "UNRECORDED_CONSUMPTION", "TAMPERING"];
  for (const type of ruleTypes) {
    await prisma.securityRule.create({
      data: { restaurantId: restaurant.id, type, enabled: true, sensitivity: "MEDIUM" }
    });
  }
  console.log(`✓ Created ${ruleTypes.length} security rules`);

  // Alertas demo (mix de severidades, estados y tipos)
  const camCaja = cameras.find(c => c.location === "CAJA")!;
  const camCocina = cameras.find(c => c.location === "COCINA")!;
  const camAlmacen = cameras.find(c => c.location === "ALMACEN")!;
  const camPuerta = cameras.find(c => c.location === "PUERTA_TRASERA")!;
  const camBarra = cameras.find(c => c.location === "BARRA")!;
  const camSalon = cameras.find(c => c.location === "SALON")!;

  const now = Date.now();
  const ago = (mins: number) => new Date(now - mins * 60 * 1000);

  const demoAlerts = [
    {
      cameraId: camCaja.id,
      type: "FAKE_RECEIPT",
      severity: "HIGH",
      title: "Posible papel en blanco entregado al cliente",
      description: "El cajero entregó al cliente de la mesa 12 un papel sin elementos típicos de boleta SUNAT (sin QR, series ni logo oficial). Validar si la transacción fue registrada en POS.",
      aiRationale: "El frame muestra un papel de tamaño boleta sin marcas de impresión visibles en el área del logotipo y sin QR en la esquina inferior. POS no registró ticket para mesa 12 a esa hora.",
      aiConfidence: 0.87,
      detectedAt: ago(8),
      status: "PENDING",
      estimatedLossCents: 8950
    },
    {
      cameraId: camAlmacen.id,
      type: "THEFT_INVENTORY",
      severity: "CRITICAL",
      title: "Insumo retirado en mochila personal",
      description: "Empleado tomó botella de vino del estante de licores y la guardó en su mochila personal antes de retirarse al cambio de turno.",
      aiRationale: "Se observa al empleado tomando un objeto cilíndrico del estante 3 (zona vinos) y depositándolo en mochila roja a 21:34. No hay registro de mermas autorizadas en sistema.",
      aiConfidence: 0.91,
      detectedAt: ago(45),
      status: "PENDING",
      estimatedLossCents: 18500
    },
    {
      cameraId: camPuerta.id,
      type: "THEFT_INVENTORY",
      severity: "HIGH",
      title: "Salida sospechosa por puerta trasera 21:48",
      description: "Empleado salió por puerta de servicio cargando bolsa de tamaño inusual fuera del horario de despacho de proveedores.",
      aiRationale: "Salida registrada a 21:48. Bolsa visible de aprox. 60cm. No hay despacho programado para ese horario según calendario operativo.",
      aiConfidence: 0.78,
      detectedAt: ago(120),
      status: "REVIEWING",
      estimatedLossCents: 24000
    },
    {
      cameraId: camCaja.id,
      type: "OPEN_REGISTER_NO_TX",
      severity: "MEDIUM",
      title: "Caja abierta 14 segundos sin transacción",
      description: "Cajón de caja registradora abierto durante 14 segundos sin transacción asociada en POS. Última operación 6 minutos antes.",
      aiRationale: "Apertura del cajón detectada de 13:21 a 13:35. POS sin actividad en ventana ±2min. Cajero permaneció solo en zona durante ese intervalo.",
      aiConfidence: 0.74,
      detectedAt: ago(180),
      status: "PENDING",
      estimatedLossCents: 4200
    },
    {
      cameraId: camBarra.id,
      type: "UNRECORDED_CONSUMPTION",
      severity: "MEDIUM",
      title: "Bartender sirvió 2 tragos sin comanda",
      description: "Bartender sirvió 2 cocteles a personas en la barra sin que aparezca comanda en POS para esas posiciones.",
      aiRationale: "Preparación visible de 2 tragos a las 19:42. Posiciones B3 y B4 sin comanda activa. Personas en B3-B4 son nuevas (no estaban antes).",
      aiConfidence: 0.69,
      detectedAt: ago(360),
      status: "PENDING",
      estimatedLossCents: 5600
    },
    {
      cameraId: camCocina.id,
      type: "UNRECORDED_CONSUMPTION",
      severity: "LOW",
      title: "Consumo de bebida sin registro",
      description: "Empleado de cocina consumió bebida del refrigerador sin registrarla como consumo personal o merma.",
      aiRationale: "Apertura de refrigerador y consumo directo de botella. Sin registro en sistema de consumos personales (que sí está habilitado).",
      aiConfidence: 0.62,
      detectedAt: ago(540),
      status: "DISMISSED",
      reviewedAt: ago(420),
      actionTaken: "NO_ACTION",
      notes: "Verificado · era agua mineral cortesía staff. Política autorizada.",
      estimatedLossCents: 0
    },
    {
      cameraId: camSalon.id,
      type: "UNUSUAL_AREA",
      severity: "LOW",
      title: "Empleado de cocina en área de mesas vacías 5 min",
      description: "Empleado de cocina permaneció 5+ minutos en zona de mesas vacías sin tarea aparente durante turno de servicio.",
      aiRationale: "Empleado identificado como cocina (uniforme distintivo) en mesa 8 vacía. No hay solicitud de servicio activa en esa mesa.",
      aiConfidence: 0.55,
      detectedAt: ago(900),
      status: "DISMISSED",
      reviewedAt: ago(840),
      actionTaken: "NO_ACTION",
      notes: "Pausa autorizada · falsa alerta",
      estimatedLossCents: 0
    },
    {
      cameraId: camCaja.id,
      type: "FAKE_RECEIPT",
      severity: "HIGH",
      title: "Boleta entregada sin emisión registrada",
      description: "Cliente recibió papel tipo boleta pero sistema POS no registró emisión de comprobante en esa ventana de tiempo.",
      aiRationale: "Entrega de papel a cliente a las 12:48. POS sin emisión de boleta entre 12:46 y 12:50. Mesa 5 cerró cuenta sin ticket asociado en sistema.",
      aiConfidence: 0.83,
      detectedAt: ago(1380),
      status: "CONFIRMED",
      reviewedAt: ago(1200),
      actionTaken: "WRITTEN_WARNING",
      notes: "Confirmado en revisión. Cajero argumentó error técnico pero ya hay 2 incidentes similares en el mes. Memorando emitido.",
      estimatedLossCents: 12400
    }
  ];

  for (const a of demoAlerts) {
    await prisma.securityAlert.create({ data: { restaurantId: restaurant.id, ...a } });
  }
  console.log(`✓ Created ${demoAlerts.length} security alerts (demo mix)`);

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
