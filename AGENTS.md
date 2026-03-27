# AGENTS.md

## Frontend standards
- Stack principal: React + Tailwind CSS.
- Priorizar componentes reutilizables, accesibles y responsive.
- Usar composición antes que componentes gigantes.
- Mantener jerarquía visual clara y espaciado consistente.
- Evitar sobrecargar la UI con sombras, gradientes o animaciones innecesarias.
- Toda pantalla debe verse profesional, minimalista y lista para producción.

## React
- Preferir componentes funcionales.
- Mantener estado local simple; extraer lógica compleja a hooks.
- Props tipadas y componentes pequeños.
- No duplicar UI patterns; crear primitives reutilizables.

## Tailwind
- Usar utility classes limpias y consistentes.
- Reutilizar patrones con helpers o componentes.
- Mantener spacing scale consistente.
- Mobile-first.
- No mezclar estilos inline salvo necesidad real.

## UX/UI
- Priorizar legibilidad, contraste y claridad.
- Cada sección debe tener una sola función visual.
- Reducir ruido visual.
- Diseñar primero para escaneo rápido.
- Mantener apariencia premium y moderna.

## Definition of done
- Responsive en móvil, tablet y desktop.
- Accesible con labels, roles y focus states.
- Sin warnings de lint.
- Componentes listos para producción.