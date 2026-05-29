# Brief para agente Django — endpoint `monthly-by-product`

Espejo del endpoint existente `monthly-by-family` pero a nivel SKU.

## Endpoint

```
GET /ventas/api/aremko-cli/bookings/monthly-by-product/?months=24
```

- Auth: misma convención que `monthly-by-family` (sin auth interna, expuesto en la sub-API `aremko-cli`).
- `months`: 6, 12, 18 o 24 (default 24, máximo 36).

## Modelo asumido

Producto separado de Servicio. Vendidos a través de `DetalleCompra` / `LineaVenta` / como sea que se llame en el modelo actual — verificar contra `compras/models.py` (o `ventas/`). El revenue de un producto se calcula como:

```
revenue_producto = precio_unitario * cantidad
```

**NO se multiplica por cantidad_personas**. Eso aplica solo a Servicios (tinas, masajes con N personas). Un producto se vende N unidades a precio X.

## Filtros

- Solo productos con al menos 1 venta en el rango (descartar SKUs descontinuados que no aparecieron en los últimos N meses).
- Productos pueden ser ordenados por `total_revenue` desc en el `summary_by_product` para que el frontend muestre los mejores arriba.

## Shape de respuesta (espejo de monthly-by-family)

```json
{
  "months": 24,
  "first_month": "2024-06",
  "last_month": "2026-05",
  "data": [
    {
      "month": "2024-06",
      "month_label": "Jun 2024",
      "products": {
        "<product_id>": {
          "name": "Crema corporal lavanda 200ml",
          "count": 12,
          "revenue": 240000
        },
        "<product_id_2>": { "name": "...", "count": 5, "revenue": 75000 }
      },
      "total": { "count": 50, "revenue": 1200000 }
    },
    { "month": "2024-07", ... }
  ],
  "summary_by_product": {
    "<product_id>": {
      "name": "Crema corporal lavanda 200ml",
      "total_count": 200,
      "total_revenue": 5000000,
      "avg_monthly_revenue": 208333,
      "best_month": { "month": "2025-12", "revenue": 480000 },
      "worst_month": { "month": "2025-02", "revenue": 0 },
      "trend_slope_pct": -3.2
    }
  }
}
```

### Notas sobre cada campo

- `products` en `data[]`: dict por `product_id`. El frontend itera los IDs y obtiene `name`, `count`, `revenue` por mes.
- Si un producto no tuvo ventas en un mes, **omitir la entrada** (el frontend tratará la ausencia como 0). NO mandar `count: 0` para cada producto en cada mes — la matriz quedaría demasiado pesada con 30+ SKUs × 24 meses.
- `summary_by_product`: incluir TODOS los productos que tuvieron al menos 1 venta en los últimos `months` meses. Ordenamiento por `total_revenue` desc (Django hace el sort, el frontend lo respeta).
- `trend_slope_pct`: usar la misma fórmula que `monthly-by-family` (regresión lineal sobre revenue mensual, % anualizado). Si no hay suficientes datos (<6 meses con ventas), retornar `null`.
- `best_month` / `worst_month`: mismo shape que en familias (incluir `month` y `revenue`).

## Comportamiento ante descuentos

Mismo criterio que servicios: si Aremko modela descuentos con un "producto descuento" de `precio = -1`, su `revenue` aparece negativo en `total` y eso es correcto (el frontend ya muestra montos negativos en familia Otros sin problema).

## Performance

24 meses × N productos. Si hay >500 SKUs históricos, considerar:
- Paginar o cap en top 100 por revenue total.
- Crear índices `(producto_id, fecha_creacion)` en la tabla de líneas de venta si la query agrega lenta.

Si querés cap, exponerlo como query param `?top=100`. El default debería ser sin cap (devolver todos).

## Validación esperada

Smoke-test con curl una vez deployado:

```bash
curl -s "https://www.aremko.cl/ventas/api/aremko-cli/bookings/monthly-by-product/?months=12" \
  | jq '.summary_by_product | length, (.[] | {name, total_revenue, total_count}) | head -5'
```

Debería devolver lista no vacía y top 5 con sus revenues.

## Convenciones de proyecto a respetar

- Aremko CLI proxy DTO: si hay un proxy Go intermedio (no parece haber por la integración directa), no olvidar agregar el field a la struct DTO.
- Migrate Django post-deploy: si este endpoint requiere índices nuevos, flaggear `python manage.py migrate ventas` en el deploy a Render.
- Revenue: para Servicios se usa `precio × cantidad_personas`. Para productos, `precio × cantidad`. NO mezclar las fórmulas.

## Side-quest sugerido (no bloqueante)

Si querés enriquecer más adelante (Fase 2): agregar `category` o `family` por producto en el summary para que el frontend pueda agrupar por categoría además de ver SKU individual. Default por ahora: solo SKU.

---

# Adenda — Pedido de extensión `category` (post-entrega v1)

Endpoint v1 vivo y verificado. Pedido confirmado de Jorge: agregar el nombre de la categoría del producto al `summary_by_product` para habilitar filtros y agrupación en el frontend sin un segundo request.

## Cambio solicitado

Agregar el campo `category` a cada entrada de `summary_by_product`:

```json
"summary_by_product": {
  "<product_id>": {
    "name": "Crema corporal lavanda 200ml",
    "category": "Aromaterapia",   // ← nuevo
    "total_count": 200,
    "total_revenue": 5000000,
    "avg_monthly_revenue": 208333,
    "best_month":  { "month": "2025-12", "revenue": 480000 },
    "worst_month": { "month": "2025-02", "revenue": 0 },
    "trend_slope_pct": -3.2
  }
}
```

## Consideraciones

- Origen: `producto.categoria.nombre` (o como se llame la relación en el modelo actual de `compras`/`ventas`).
- Si el producto no tiene categoría asignada: devolver `null` o `"Sin categoría"`, el que sea más natural. El frontend agrupará todos los `null` bajo una sección "Sin categoría".
- Si la categoría está borrada (`categoria_id` huérfano): tratar igual que `null`.
- NO agregar `category` dentro de `data[i].products[<id>]` — el nombre y categoría del producto son estables a través del tiempo, repetirlo por mes infla el payload sin razón. Solo en `summary_by_product`.

## Impacto en aremko-cli

- Cliente Go: agregar campo opcional `Category *string` en `MonthlyProductSummary`. Si Django no lo manda todavía, el cliente sigue funcionando.
- Frontend: ningún cambio necesario para mostrar la tabla actual. Habilita la Fase 2 (filtros / agrupación).

## Estado

🟡 Pendiente: agente Django implementa, redeploy Render, smoke-test del campo `category`.

