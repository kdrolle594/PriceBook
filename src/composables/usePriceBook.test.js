import { describe, it, expect } from 'vitest'
import { validity, migrateV1, normalizeStore, bestOffer, shelfCheck, usePriceBook } from './usePriceBook.js'

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

describe('normalizeStore', () => {
  it('collapses whitespace, including non-breaking spaces from OCR', () => {
    expect(normalizeStore('  Super C ')).toBe('Super C')
  })

  it('reuses an existing store spelling on a case-insensitive match', () => {
    expect(normalizeStore('WALMART ', ['Walmart', 'Maxi'])).toBe('Walmart')
    expect(normalizeStore('maxi', ['Walmart', 'Maxi'])).toBe('Maxi')
  })

  it('keeps genuinely new stores as typed', () => {
    expect(normalizeStore('Metro', ['Walmart'])).toBe('Metro')
    expect(normalizeStore(null, ['Walmart'])).toBe('')
  })
})

describe('bestOffer', () => {
  it('picks the cheapest still-running sale', () => {
    const item = { history: [
      { store: 'Maxi', date: '2026-07-01', endDate: '2026-07-20', price: 3.0 },
      { store: 'IGA', date: '2026-07-05', endDate: '2026-07-12', price: 2.5 },
      { store: 'Metro', date: '2026-07-08', endDate: null, price: 2.0 },
    ] }
    const { entry, onSale } = bestOffer(item, NOW)
    expect(onSale).toBe(true)
    expect(entry.store).toBe('IGA')
  })

  it('falls back to the latest sighting when no sale is running', () => {
    const item = { history: [
      { store: 'Maxi', date: '2026-06-01', endDate: '2026-06-07', price: 1.0 },
      { store: 'IGA', date: '2026-06-20', endDate: null, price: 4.0 },
    ] }
    const { entry, onSale } = bestOffer(item, NOW)
    expect(onSale).toBe(false)
    expect(entry.store).toBe('IGA')
  })
})

describe('shown ordering', () => {
  const entry = (over = {}) => ({
    store: 'Maxi', date: '2026-06-01', endDate: null, price: 2, ...over,
  })
  const book = usePriceBook()

  it('puts items with an active sale first, soonest ending on top', () => {
    book.items.value = [
      { display: 'No sale', size: '', history: [entry()] },
      { display: 'Ends later', size: '', history: [entry({ endDate: '2999-02-01' })] },
      { display: 'Ends soon', size: '', history: [entry({ endDate: '2999-01-01' })] },
      { display: 'Expired', size: '', history: [entry({ endDate: '2000-01-01' })] },
    ]
    expect(book.shown.value.map(i => i.display))
      .toEqual(['Ends soon', 'Ends later', 'Expired', 'No sale'])
  })

  it('filters to active sales only', () => {
    book.filter.value = 'sale'
    expect(book.shown.value.map(i => i.display)).toEqual(['Ends soon', 'Ends later'])
    book.filter.value = 'all'
    book.items.value = []
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

describe('shelfCheck', () => {
  const item = (...prices) => ({
    history: prices.map((price, i) => ({ price, date: `2026-07-${String(i + 1).padStart(2, '0')}` })),
  })

  it('has no position for a single sighting', () => {
    expect(shelfCheck(item(3))).toMatchObject({ pct: null, tone: 'none', count: 1 })
  })

  it('centers a price that never changed', () => {
    expect(shelfCheck(item(3, 3))).toMatchObject({ pct: 0.5, tone: 'flat' })
  })

  it('places the latest price between the low and the high', () => {
    expect(shelfCheck(item(4, 2, 2))).toMatchObject({ pct: 0, tone: 'low', min: 2, max: 4 })
    expect(shelfCheck(item(2, 8, 3))).toMatchObject({ tone: 'good' })
    expect(shelfCheck(item(2, 8, 5))).toMatchObject({ pct: 0.5, tone: 'mid' })
    expect(shelfCheck(item(2, 8, 7))).toMatchObject({ tone: 'high', current: 7, verdict: 'Higher than usual' })
    expect(shelfCheck(item(2, 8))).toMatchObject({ pct: 1, verdict: 'Highest price seen' })
  })
})
