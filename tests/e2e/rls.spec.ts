import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

/**
 * Prueba de cierre 3 de la Fase 1: con la llave pública no se puede escribir
 * ni leer nada privado. Si esto pasa a verde con un INSERT correcto, hay un
 * agujero de seguridad.
 */
const url = process.env.SUPABASE_URL
const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_KEY

test.describe('RLS', () => {
  test.skip(!url || !anonKey, 'Define SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY')

  const anon = () => createClient(url!, anonKey!)

  test('anon no puede insertar jugadores', async () => {
    const { error } = await anon().from('player').insert({ display_name: 'Intruso' })
    expect(error).not.toBeNull()
  })

  test('anon no puede leer la tabla player', async () => {
    const { data, error } = await anon().from('player').select('id').limit(1)
    expect(error ?? data?.length === 0).toBeTruthy()
  })

  test('anon no puede leer el banco de bits', async () => {
    const { data, error } = await anon().from('ledger_account').select('balance_bits').limit(1)
    expect(error ?? data?.length === 0).toBeTruthy()
  })

  test('anon sí puede leer el tier ranking público', async () => {
    const { error } = await anon().from('public_tier_ranking').select('display_name').limit(1)
    expect(error).toBeNull()
  })
})
