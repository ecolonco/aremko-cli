# aremko-cli

Sistema híbrido (CLI + Web + API) de gestión inteligente para Aremko Spa Boutique.

## 🎯 Objetivo

Centralizar información fragmentada, automatizar tareas repetitivas y transicionar a una gestión impulsada por datos con un ROI de 52x.

## 🏗️ Arquitectura

- **Backend**: Go + Cobra CLI + REST API
- **Frontend**: Next.js + React + TailwindCSS
- **Base de datos**: PostgreSQL
- **Cache**: Redis (Fase 2)
- **Deployment**: Render (backend) + Vercel (frontend)

## 📁 Estructura del Proyecto

```
aremko-cli/
├── backend/           # Go CLI + API server
│   ├── cmd/          # CLI commands
│   ├── internal/     # Internal packages
│   ├── api/          # REST API handlers
│   └── pkg/          # Public packages
├── frontend/         # Next.js dashboard
│   ├── app/         # App router pages
│   ├── components/  # React components
│   └── lib/         # Utilities
└── docs/            # Documentation
```

## 🚀 Fases de Implementación

### Fase 1: MVP (2-3 semanas) - En Desarrollo
- ✅ Estructura base del proyecto
- 🔄 CLI con comandos básicos
- 🔄 Integración Meta Ads API
- 🔄 Brief semanal automatizado
- 🔄 Dashboard admin (Jorge)

### Fase 2: Automatización (2-3 semanas)
- Alertas en tiempo real
- Integración Google Ads + LinkedIn
- Monitoreo WhatsApp Business
- Dashboards por rol

### Fase 3: Intelligence (3-4 semanas)
- Competitive intelligence
- Predicciones con IA
- Sugerencias de contenido

### Fase 4: Optimización (Ongoing)
- App móvil nativa
- Workflows avanzados
- Multi-locación

## 💻 Desarrollo Local

### Backend (Go)
```bash
cd backend
go run main.go --help
```

### Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
```

## 📊 ROI Esperado

- **Ahorro de tiempo**: 60h/mes (de 15h/semana a 3h/semana)
- **Mejora en decisiones**: Incremento ROAS + precios dinámicos
- **ROI primer año**: 52x (~$6,000 USD de valor generado)
- **Inversión desarrollo**: $0 USD (tiempo de Jorge)
- **Costo operativo**: $7-49 USD/mes según fase

## 👥 Equipo

- **Jorge**: Desarrollo + Gerencia + Dashboard admin
- **Angélica**: Marketing + Contenido + Dashboard de contenido
- **Deborah**: Ventas + Dashboard de ventas
- **Ernesto**: Operaciones + Dashboard operativo

## 📝 Licencia

Propiedad de Aremko Spa Boutique - Uso interno
