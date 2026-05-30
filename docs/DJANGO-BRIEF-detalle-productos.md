# Brief para agente Django — endpoint `detalle-productos`

Espejo de `/bookings/detalle/` (que ya existe para servicios) pero para
PRODUCTOS individuales. Necesario para que la "Consulta en lenguaje natural"
de la pestaña Ventas pueda responder preguntas como:
- "ventas de café marley en abril"
- "tablas de quesos vendidas el 15 de mayo"
- "qué productos consumió el cliente +56987654321 en mayo"
- "ventas de gift cards este año"

## Endpoint

```
GET /ventas/api/aremko-cli/bookings/detalle-productos/
```

## Query params (idéntico filtraje que detalle-servicios)

| Param | Tipo | Obligatorio | Default |
|---|---|---|---|
| `fecha_desde` | YYYY-MM-DD | sí (a menos que se filtre por cliente) | — |
| `fecha_hasta` | YYYY-MM-DD | sí (a menos que se filtre por cliente) | — |
| `producto` | string (substring case-insensitive del `producto.nombre`) | no | (todos) |
| `categoria` | string (substring del `producto.categoria.nombre`) | no | (todas) |
| `cliente` | telefono o email (substring) | no | — |
| `limit` | int | no | 500 |

Si `cliente` está presente y `fecha_desde/hasta` no, devolver todas las ventas
históricas del cliente. Esto reemplaza la fecha obligatoria.

## Shape de respuesta

```json
{
  "fecha_desde": "2026-05-01",
  "fecha_hasta": "2026-05-30",
  "filtros_aplicados": {
    "producto": "café",
    "categoria": null,
    "cliente": null
  },
  "total_revenue": 487500,
  "total_unidades": 142,
  "total_lineas": 89,
  "rows": [
    {
      "fecha": "2026-05-15",
      "cliente_nombre": "Juan Pérez",
      "cliente_telefono": "+56987654321",
      "venta_reserva_id": 12345,
      "producto_id": 7,
      "producto_nombre": "Cafe Marley Mediano-pequeño",
      "categoria": "Bebestibles",
      "cantidad": 2,
      "precio_unitario": 5000,
      "revenue": 10000,
      "metodo_pago": "Mercado Pago",
      "estado_pago": "pagado"
    }
  ]
}
```

## Reglas críticas

- **Revenue = precio_unitario × cantidad**. Misma fórmula que en `monthly-by-product`.
  NO multiplicar por cantidad_personas (eso aplica solo a servicios).
- Excluir líneas con `producto__isnull=True` (líneas huérfanas tras borrar SKU).
- Ordenar por `fecha DESC, venta_reserva_id DESC`.
- Si el cliente tiene varios telefonos/emails, matchear por substring en cualquiera.

## Detección de cliente

Mismo criterio que `detalle/`:
- Si `cliente` matchea un número de teléfono (con o sin +56), buscar por ese campo.
- Si es un email, buscar por email.
- Si es texto, intentar match sobre `nombre_completo` o `apellidos`.

## Validación esperada (post-deploy)

```bash
# Productos café en mayo 2026
curl -s "https://www.aremko.cl/ventas/api/aremko-cli/bookings/detalle-productos/?fecha_desde=2026-05-01&fecha_hasta=2026-05-30&producto=cafe" | jq '.total_revenue, .total_lineas, (.rows[0:3])'

# Gift cards de un cliente específico
curl -s "https://www.aremko.cl/ventas/api/aremko-cli/bookings/detalle-productos/?cliente=%2B56987654321&producto=gift" | jq

# Toda la categoría Comestibles en una fecha
curl -s "https://www.aremko.cl/ventas/api/aremko-cli/bookings/detalle-productos/?fecha_desde=2026-05-15&fecha_hasta=2026-05-15&categoria=comestibles" | jq '.total_revenue, .rows | length'
```

## Convenciones del proyecto a respetar

- Misma convención de URL que `detalle/`: namespace `aremko-cli`.
- Sin auth interna (consistencia con otros endpoints de la sub-API).
- Si el query agrega lento con muchos productos × muchos meses, considerar índice en
  `ReservaProducto(producto, venta_reserva)` (mencionado en el brief de
  `monthly-by-product`).

## Side-quest opcional

Si tiene poco costo: agregar `producto_id` en la respuesta (ya está propuesto arriba)
permite cruzar contra el endpoint `monthly-by-product` desde el dashboard sin
pasar por nombres ambiguos.

## Estado al cierre

- 🔴 Pendiente: implementar
- Aremko-cli lado: ya preparado (cliente Go + parser LLM con detección
  servicios/productos + toggle frontend). Cuando este endpoint responda 200,
  todo se activa automáticamente.
