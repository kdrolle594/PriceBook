import { describe, it, expect } from 'vitest'
import { validity, migrateV1 } from './usePriceBook.js'

const NOW = '2026-07-09'

describe('validity', () => {
  it('is null without an end date', () => {
    expect(validity({ endDate: null }, NOW)).toBeNull()
    expect(validity({}, NOW)).toBeNull()
  })

  it('flags past end dates as expired', () => {
    expect(validity({ endDate: '2026-07-08' }, NOW)).toEqual({ state: 'expired', label: 'expired' })
  })

  it('counts down the last days of a sale', () => {
    expect(validity({ endDate: '2026-07-09' }, NOW)).toEqual({ state: 'ending', label: 'ends today' })
    expect(validity({ endDate: '2026-07-10' }, NOW)).toEqual({ state: 'ending', label: 'ends tomorrow' })
    expect(validity({ endDate: '2026-07-12' }, NOW)).toEqual({ state: 'ending', label: 'ends in 3 days' })
  })

  it('shows valid-thru for sales with more than 3 days left', () => {
    const v = validity({ endDate: '2026-07-20' }, NOW)
    expect(v.state).toBe('active')
    expect(v.label).toMatch(/^valid thru /)
  })
})

describe('migrateV1', () => {
  const v1 = {
    items: [
      {
        canonical: 'oat milk 1l', display: 'Oat Milk', size: '1L',
        history: [
          { store: 'Maxi', date: '2026-06-01', price: 3.5 },
          { store: 'Maxi', date: '2026-06-08', price: 3.0 },
        ],
      },
      {
        canonical: 'eggs dozen', display: 'Eggs', size: 'dozen',
        history: [
          { store: 'Maxi', date: '2026-06-01', price: 4.2 },
        ],
      },
    ],
    flyerCount: 2,
  }

  it('groups entries by store+date into synthetic flyers', () => {
    const { flyers } = migrateV1(v1)
    expect(flyers).toHaveLength(2)
    const june1 = flyers.find(f => f.startDate === '2026-06-01')
    expect(june1.store).toBe('Maxi')
    expect(june1.itemCount).toBe(2)
  })

  it('stamps every entry with its flyer id', () => {
    const { items, flyers } = migrateV1(v1)
    const june1 = flyers.find(f => f.startDate === '2026-06-01')
    expect(items[0].history[0].flyerId).toBe(june1.id)
    expect(items[1].history[0].flyerId).toBe(june1.id)
    expect(items[0].history[1].flyerId).not.toBe(june1.id)
  })

  it('normalizes missing endDate to null', () => {
    const { items } = migrateV1(v1)
    expect(items[0].history[0].endDate).toBeNull()
  })
})
