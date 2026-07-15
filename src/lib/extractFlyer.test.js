import { describe, it, expect } from 'vitest'
import { parseResponse } from './extractFlyer.js'

describe('parseResponse', () => {
  it('parses clean compact JSON', () => {
    const out = parseResponse('{"s":"Maxi","d":"2026-07-03","e":"2026-07-09","i":[["a","A","1lb",2.5]]}')
    expect(out.s).toBe('Maxi')
    expect(out.e).toBe('2026-07-09')
    expect(out.i).toHaveLength(1)
  })

  it('strips markdown fences and $ signs', () => {
    const out = parseResponse('```json\n{"s":"IGA","d":"2026-07-03","e":"","i":[["a","A","",$3.00]]}\n```')
    expect(out.i[0][3]).toBe(3)
  })

  it('salvages complete items from a truncated response', () => {
    const cut = '{"s":"Metro","d":"2026-07-03","e":"2026-07-09","i":[["a","A","1lb",2.5],["b","B","2lb",4.0],["c","C","3l'
    const out = parseResponse(cut)
    expect(out.i).toHaveLength(2)
    expect(out.i[1][0]).toBe('b')
  })

  it('throws when nothing can be salvaged', () => {
    expect(() => parseResponse('total garbage')).toThrow('Could not read any items')
  })
})
