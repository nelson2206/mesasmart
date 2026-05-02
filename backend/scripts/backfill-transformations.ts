/**
 * Backfill: añade IngredientTransformation a restaurantes existentes
 * sin borrar nada. Idempotente: si ya existen, no las duplica.
 *
 * Uso (Render Shell):
 *   cd backend && npx tsx scripts/backfill-transformations.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TRANSFORMATIONS = [
  { fromName: "Pescado bonito entero", toName: "Pescado sin vísceras", inputQty: 1.0, outputQty: 0.80, laborMinutes: 5, station: "frio" },
  { fromName: "Pescado sin vísceras",  toName: "Pescado fileteado",   inputQty: 1.0, outputQty: 0.75, laborMinutes: 8, station: "frio" },
  { fromName: "Pescado fileteado",     toName: "Pescado picado",      inputQty: 1.0, outputQty: 0.92, laborMinutes: 12, station: "prep" },
  { fromName: "Pollo entero",          toName: "Pollo trozado",       inputQty: 1.0, outputQty: 0.95, laborMinutes: 5, station: "frio" },
  { fromName: "Pollo trozado",         toName: "Pechugas deshuesadas",inputQty: 1.0, outputQty: 0.70, laborMinutes: 4, station: "frio" },
  { fromName: "Carne de res (lomo)",   toName: "Lomo limpio",         inputQty: 1.0, outputQty: 0.88, laborMinutes: 6, station: "frio" }
];

const INTERMEDIATE_INGS = [
  { name: "Pollo trozado",          unit: "kg", level: "INTERMEDIATE" as const },
  { name: "Pechugas deshuesadas",   unit: "kg", level: "PREPARED"     as const },
  { name: "Pescado sin vísceras",   unit: "kg", level: "INTERMEDIATE" as const },
  { name: "Pescado fileteado",      unit: "kg", level: "INTERMEDIATE" as const },
  { name: "Pescado picado",         unit: "kg", level: "PREPARED"     as const },
  { name: "Lomo limpio",            unit: "kg", level: "PREPARED"     as const }
];

async function main() {
  const restaurants = await prisma.restaurant.findMany();
  if (restaurants.length === 0) {
    console.log("⚠ No hay restaurantes. Corre primero el seed completo.");
    return;
  }

  for (const r of restaurants) {
    console.log(`\n▶ Restaurant: ${r.name} (${r.id})`);

    // 1. Asegurar categoría "Proteínas" y proveedor base
    let cat = await prisma.ingredientCategory.findFirst({
      where: { restaurantId: r.id, name: "Proteínas" }
    });
    if (!cat) {
      cat = await prisma.ingredientCategory.create({
        data: { restaurantId: r.id, name: "Proteínas", color: "#A0322B" }
      });
      console.log("  ✓ Creada categoría Proteínas");
    }

    let sup = await prisma.supplier.findFirst({ where: { restaurantId: r.id } });
    if (!sup) {
      sup = await prisma.supplier.create({
        data: { restaurantId: r.id, name: "Proveedor Base", contact: "—", phone: "—" }
      });
      console.log("  ✓ Creado proveedor base");
    }

    // 2. Asegurar ingredientes intermedios/preparados
    for (const ing of INTERMEDIATE_INGS) {
      const exists = await prisma.ingredient.findFirst({
        where: { restaurantId: r.id, name: ing.name }
      });
      if (!exists) {
        await prisma.ingredient.create({
          data: {
            restaurantId: r.id,
            categoryId: cat.id,
            supplierId: sup.id,
            name: ing.name,
            unit: ing.unit,
            current: 0,
            min: 0,
            critical: 0,
            optimal: 5,
            costCents: 0,
            perishable: true,
            level: ing.level
          }
        });
        console.log(`  ✓ Creado ingrediente intermedio: ${ing.name}`);
      }
    }

    // 3. Crear transformaciones (skip si ya existen)
    let created = 0;
    for (const t of TRANSFORMATIONS) {
      const fromIng = await prisma.ingredient.findFirst({
        where: { restaurantId: r.id, name: t.fromName }
      });
      const toIng = await prisma.ingredient.findFirst({
        where: { restaurantId: r.id, name: t.toName }
      });
      if (!fromIng || !toIng) {
        console.log(`  ⚠ Skip ${t.fromName} → ${t.toName} (ingrediente no encontrado)`);
        continue;
      }
      const dup = await prisma.ingredientTransformation.findFirst({
        where: {
          restaurantId: r.id,
          fromIngredientId: fromIng.id,
          toIngredientId: toIng.id
        }
      });
      if (dup) continue;

      const yieldPct = (t.outputQty / t.inputQty) * 100;
      const laborCostCents = Math.round(t.laborMinutes * 50);

      await prisma.ingredientTransformation.create({
        data: {
          restaurantId: r.id,
          fromIngredientId: fromIng.id,
          toIngredientId: toIng.id,
          inputQty: t.inputQty,
          outputQty: t.outputQty,
          yieldPct,
          laborMinutes: t.laborMinutes,
          laborCostCents,
          station: t.station
        }
      });
      created++;
      console.log(`  ✓ ${t.fromName} → ${t.toName} (yield ${yieldPct.toFixed(0)}%)`);
    }
    console.log(`  ✅ ${created} transformaciones nuevas creadas`);
  }
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
