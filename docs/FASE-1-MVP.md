# Fase 1: MVP - Documentación

## 🎉 Estado Actual

La Fase 1 del MVP de aremko-cli está **completada** con las siguientes funcionalidades:

### ✅ Backend (Go CLI)

#### Instalado y Funcionando
- **CLI funcional** con framework Cobra
- **Comando `brief`** para generar brief semanal automatizado
- **Integración Meta Ads API** con métricas en tiempo real
- **Sistema de configuración** con variables de entorno
- **Cálculos automáticos**: CTR, CPC, CPM
- **Recomendaciones inteligentes** basadas en rendimiento

#### Comandos Disponibles

```bash
# Ver versión
./backend/aremko --version

# Ver ayuda
./backend/aremko --help

# Generar brief semanal con datos de Meta Ads
./backend/aremko brief

# Ver ayuda del comando brief
./backend/aremko brief --help
```

#### Configuración Backend

1. Copiar el archivo de ejemplo:
```bash
cd backend
cp .env.example .env
```

2. Editar `.env` con tus credenciales:
```env
META_ACCESS_TOKEN=tu_token_aqui
META_AD_ACCOUNT_ID=act_tu_cuenta
ENABLE_META_ADS=true
```

El token de Meta ya está almacenado en el keychain de macOS bajo:
- Service: `aremko-meta`
- Account: `system_user_token`

3. Compilar el CLI:
```bash
go build -o aremko main.go
```

4. Ejecutar:
```bash
./aremko brief
```

### ✅ Frontend (Next.js Dashboard)

#### Instalado y Funcionando
- **Next.js 14** con App Router + TypeScript
- **TailwindCSS** para estilos modernos
- **Dashboard de Jorge** (vista gerencial)
- **Sidebar** con navegación personalizada por rol
- **Componentes reutilizables** (StatCard)
- **Datos de ejemplo** para Meta Ads y Reservas

#### Iniciar Frontend

```bash
cd frontend

# Modo desarrollo
npm run dev

# Abrir en el navegador
# http://localhost:3000
```

El frontend redirige automáticamente a `/dashboard/jorge`.

#### Estructura del Dashboard

```
/dashboard/jorge          - Dashboard principal (vista gerencial)
/dashboard/jorge/meta-ads - Análisis detallado de Meta Ads (próximamente)
/dashboard/jorge/analytics- Analytics general (próximamente)
/dashboard/jorge/brief    - Brief semanal interactivo (próximamente)
/dashboard/jorge/team     - Gestión del equipo (próximamente)
/dashboard/jorge/settings - Configuración (próximamente)
```

### 📊 Métricas Mostradas (MVP)

#### Meta Ads
- ✅ Gasto Total (USD)
- ✅ Impresiones
- ✅ Clicks
- ✅ CTR (Click-Through Rate)
- ✅ Trends (+/- porcentaje vs período anterior)

#### Reservas (datos mock)
- Reservas Totales
- Ingresos (CLP)
- Ticket Promedio (CLP)
- Trends

## 🚀 Próximos Pasos (Fase 2)

### Backend
- [ ] API REST para exponer datos al frontend
- [ ] Integración con Google Ads
- [ ] Integración con LinkedIn Ads
- [ ] Sistema de alertas en tiempo real
- [ ] Conexión a PostgreSQL

### Frontend
- [ ] Conectar dashboard con API real (reemplazar datos mock)
- [ ] Dashboards para Deborah, Angélica y Ernesto
- [ ] Sistema de autenticación real
- [ ] Gráficos interactivos con Recharts
- [ ] Página de Brief Semanal interactivo
- [ ] Panel de Meta Ads detallado

## 🔧 Arquitectura Técnica

### Stack Tecnológico
```
Backend:
- Go 1.21+
- Cobra CLI
- Meta Graph API v21.0
- godotenv (config)
- lib/pq (PostgreSQL)

Frontend:
- Next.js 14+ (App Router)
- React 19
- TypeScript 5
- TailwindCSS 4
- Heroicons
- Recharts (charts)
```

### Estructura de Directorios

```
aremko-cli/
├── backend/
│   ├── cmd/aremko/          # Comandos CLI
│   │   ├── root.go          # Comando raíz
│   │   └── brief.go         # Comando brief
│   ├── internal/
│   │   ├── api/             # REST API handlers (Fase 2)
│   │   ├── config/          # Configuración
│   │   ├── database/        # Database (Fase 2)
│   │   ├── meta/            # Cliente Meta Ads API
│   │   └── models/          # Modelos de datos (Fase 2)
│   ├── pkg/utils/           # Utilidades públicas
│   ├── main.go              # Punto de entrada
│   ├── go.mod               # Dependencias Go
│   └── .env                 # Variables de entorno
│
├── frontend/
│   ├── app/
│   │   ├── dashboard/
│   │   │   └── jorge/       # Dashboard de Jorge
│   │   ├── globals.css      # Estilos globales
│   │   ├── layout.tsx       # Layout raíz
│   │   └── page.tsx         # Homepage (redirect)
│   ├── components/
│   │   ├── layout/
│   │   │   └── Sidebar.tsx  # Navegación lateral
│   │   └── ui/
│   │       └── StatCard.tsx # Tarjeta de métricas
│   ├── lib/
│   │   └── types/
│   │       └── user.ts      # Tipos de usuarios
│   └── package.json
│
├── docs/
│   └── FASE-1-MVP.md        # Este documento
│
├── README.md                # README principal
└── .gitignore
```

## 📝 Cuentas de Meta Ads Detectadas

El sistema detectó 3 cuentas de anuncios asociadas al token:

1. **act_43311853** (Configurada por defecto)
2. act_323860814935576 - "Daniela Safira Almonacid Chávez"
3. act_455070225054110

Para cambiar la cuenta activa, edita `backend/.env`:
```env
META_AD_ACCOUNT_ID=act_TU_CUENTA_AQUI
```

## 🐛 Debugging

### Backend

```bash
# Ver logs detallados
./aremko brief -v

# Verificar configuración
cat backend/.env

# Verificar token en keychain
security find-generic-password -a 'system_user_token' -s 'aremko-meta' -w
```

### Frontend

```bash
# Ver logs de build
npm run build

# Limpiar cache
rm -rf .next
npm run build
```

## 💡 Tips de Desarrollo

1. **Desarrollo simultáneo**: Puedes correr backend y frontend al mismo tiempo en terminales separadas

2. **Hot reload**: El frontend se recarga automáticamente al hacer cambios

3. **Compilación rápida**: Go compila en segundos
   ```bash
   cd backend
   go build -o aremko main.go && ./aremko brief
   ```

4. **Verificar tipos**: TypeScript valida automáticamente
   ```bash
   cd frontend
   npm run build  # Verifica tipos
   ```

## 📞 Soporte

Para dudas o problemas:
- Revisa los logs del CLI
- Verifica que las credenciales de Meta estén correctas
- Asegúrate de tener Go 1.21+ y Node.js 18+ instalados

## ✨ Logros de la Fase 1

- ✅ Estructura completa del proyecto
- ✅ CLI funcional con comando brief
- ✅ Integración exitosa con Meta Ads API
- ✅ Dashboard web moderno y responsive
- ✅ Sistema de componentes reutilizables
- ✅ Arquitectura escalable para futuras fases
- ✅ Configuración de desarrollo lista
- ✅ Documentación completa

**Tiempo estimado de desarrollo**: 2-3 semanas ✅
**Tiempo real**: Completado en esta sesión 🚀

---

**¡La Fase 1 está lista para usar!** 🎉

Ahora puedes:
1. Ejecutar `./backend/aremko brief` para obtener tu brief semanal
2. Abrir `http://localhost:3000` para ver el dashboard web
3. Empezar a planificar la Fase 2 con más funcionalidades
