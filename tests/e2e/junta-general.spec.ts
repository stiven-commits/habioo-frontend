import { expect, test, type Page } from '@playwright/test';

const mockJuntaGeneralApis = async (page: Page): Promise<void> => {
  await page.route('**/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: { id: 101, nombre: 'Administrador Junta Demo' },
        session: { role: 'Administrador' },
      }),
    });
  });

  await page.route('**/api/perfil', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'success',
        data: {
          rif: 'J987564321',
          tipo: 'Junta General',
          admin_nombre: 'Administrador Junta Demo',
          nombre_legal: 'Junta Demo General',
        },
      }),
    });
  });

  await page.route('**/juntas-generales/resumen', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'success',
        data: {
          juntas: [
            {
              miembro_id: 1,
              nombre_junta_individual: 'Torre Norte',
              rif: 'J111111111',
              vinculada: true,
              cuota_participacion: 50,
              saldo_usd_generado: 120,
              saldo_usd_pagado: 20,
              saldo_usd_pendiente: 100,
              saldo_bs_generado: 12000,
              saldo_bs_pagado: 2000,
              saldo_bs_pendiente: 10000,
              porcentaje_morosidad: 83.33,
              estado_cuenta: 'ABONADO',
            },
          ],
          metricas: {
            total_juntas: 2,
            total_vinculadas: 1,
            total_usd_generado: 240,
            total_usd_pagado: 120,
            total_usd_pendiente: 120,
            total_bs_generado: 24000,
            total_bs_pagado: 12000,
            total_bs_pendiente: 12000,
            porcentaje_morosidad_global: 50,
          },
        },
      }),
    });
  });

  await page.route('**/juntas-generales/miembros**', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: { id: 10 },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'success',
        data: [
          {
            id: 1,
            nombre_referencia: 'Torre Norte',
            rif: 'J111111111',
            cuota_participacion: 50,
            zona_id: null,
            zona_nombre: null,
            condominio_individual_id: 70,
            codigo_invitacion: null,
            codigo_expira_at: null,
            vinculado_at: null,
            activo: true,
            es_fantasma: false,
            has_historial_avisos: false,
          },
          {
            id: 2,
            nombre_referencia: 'Torre Sur',
            rif: 'J222222222',
            cuota_participacion: 50,
            zona_id: null,
            zona_nombre: null,
            condominio_individual_id: null,
            codigo_invitacion: 'SL302KTPR8',
            codigo_expira_at: '2026-04-17T00:00:00.000Z',
            vinculado_at: null,
            activo: true,
            es_fantasma: true,
            has_historial_avisos: false,
          },
        ],
      }),
    });
  });

  await page.route('**/zonas', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'success',
        zonas: [
          { id: 1, nombre: 'Zona Norte', activa: true },
          { id: 2, nombre: 'Zona Sur', activa: true },
        ],
      }),
    });
  });

  await page.route('**/juntas-generales/notificaciones**', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'success' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'success',
        data: [],
      }),
    });
  });

  await page.route('**/juntas-generales/auditoria**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'success',
        data: [],
      }),
    });
  });

  await page.route('**/juntas-generales/conciliacion**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'success',
        data: {
          metricas: {
            total_registros: 1,
            total_monto_usd: 120,
            total_monto_bs: 12000,
            total_pagado_usd: 20,
            total_pagado_bs: 2000,
            total_pendiente_usd: 100,
            total_pendiente_bs: 10000,
          },
          registros: [
            {
              detalle_id: 500,
              aviso_id: 101,
              mes_origen: '2026-04',
              miembro_id: 1,
              junta_nombre: 'Torre Norte',
              rif: 'J111111111',
              gasto_id: 901,
              concepto: 'Mantenimiento general',
              monto_usd: 120,
              monto_bs: 12000,
              pagado_usd: 20,
              pagado_bs: 2000,
              pendiente_usd: 100,
              pendiente_bs: 10000,
              estado_detalle: 'ABONADO',
              estado_conciliacion: 'ABONADO',
            },
          ],
        },
      }),
    });
  });
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('habioo_token', 'test-token');
    localStorage.setItem('habioo_user', JSON.stringify({ id: 101, nombre: 'Administrador Junta Demo' }));
    localStorage.setItem('habioo_session', JSON.stringify({ role: 'Administrador' }));
  });

  await mockJuntaGeneralApis(page);
});

test('renderiza la vista Junta General y sus bloques principales', async ({ page }) => {
  await page.goto('/junta-general');

  await expect(page.getByTestId('junta-general-page')).toBeVisible();
  await expect(page.getByTestId('junta-general-title')).toContainText('Junta General');
  await expect(page.getByTestId('registrar-junta-individual-card')).toBeVisible();
  await expect(page.getByTestId('estado-cuenta-junta-card')).toBeVisible();
  await expect(page.getByTestId('conciliacion-card')).toBeVisible();
  await expect(page.getByTestId('vinculacion-juntas-card')).toBeVisible();
  await expect(page.getByTestId('estado-cuenta-junta-card').getByText('Torre Norte').first()).toBeVisible();
});

test('permite escribir alicuota con coma en el formulario de registro', async ({ page }) => {
  await page.goto('/junta-general');

  const alicuotaInput = page.getByTestId('jg-input-alicuota');
  await alicuotaInput.fill('20,5');
  await expect(alicuotaInput).toHaveValue('20,5');
});

test('filtros de conciliacion responden sin romper la pantalla', async ({ page }) => {
  await page.goto('/junta-general');

  await page.getByTestId('jg-filter-estado').selectOption('ABONADO');
  await expect(page.getByText('Mantenimiento general')).toBeVisible();

  await page.getByTestId('jg-btn-limpiar-conciliacion').click();
  await expect(page.getByTestId('jg-filter-estado')).toHaveValue('');
});
