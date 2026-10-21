import { describe, it, expect } from 'vitest'
import { parseResponse, parseBoxes, attachBoxes } from './extractFlyer.js'

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

  it('skips a malformed item mid-stream and keeps the rest', () => {
    // unescaped inch-mark inside the size breaks the JSON before the end
    const broken = '{"s":"Maxi","d":"2026-07-03","e":"2026-07-09","i":[["a","A","1lb",2.5],["b","B","12" pizza",3.0],["c","C","2lb",4.0]]}'
    const out = parseResponse(broken)
    expect(out.s).toBe('Maxi')
    expect(out.i.map((x) => x[0])).toEqual(['a', 'c'])
  })

  it('skips an item with a bare 2/5.00 price and keeps the rest', () => {
    const broken = '{"s":"IGA","d":"2026-07-03","e":"","i":[["a","A","",2/5.00],["b","B","1lb",1.5]]}'
    const out = parseResponse(broken)
    expect(out.i).toHaveLength(1)
    expect(out.i[0][0]).toBe('b')
  })

  it('throws when nothing can be salvaged', () => {
    expect(() => parseResponse('total garbage')).toThrow('Could not read any items')
  })
})

describe('parseBoxes', () => {
  it('reads compact box rows, with or without fences', () => {
    expect(parseBoxes('[[0,10,20,30,40],[2,1,2,3,4]]')).toEqual([[0, 10, 20, 30, 40], [2, 1, 2, 3, 4]])
    expect(parseBoxes('```json\n[[1,5,6,7,8]]\n```')).toEqual([[1, 5, 6, 7, 8]])
  })

  it('drops malformed rows and junk replies', () => {
    expect(parseBoxes('[[0,1,2,3],[1,1,2,3,"x"],[2,1,2,3,4]]')).toEqual([[2, 1, 2, 3, 4]])
    expect(parseBoxes('no photos found')).toEqual([])
  })
})

describe('attachBoxes', () => {
  const items = [['a', 'A', '', 1], ['b', 'B', '', 2], ['c', 'C', '', 3]]

  it('appends each box to its item as 0–1000 units of the image', () => {
    const out = attachBoxes(items, [[1, 100, 50, 300, 150]], 2000, 1000)
    expect(out[1]).toEqual(['b', 'B', '', 2, 50, 50, 150, 150])
    expect(out[0]).toEqual(['a', 'A', '', 1])
  })

  it('ignores boxes for unknown items and second boxes for the same item', () => {
    const out = attachBoxes(items, [[9, 1, 1, 2, 2], [0, 0, 0, 100, 100], [0, 50, 50, 60, 60]], 100, 100)
    expect(out[0]).toEqual(['a', 'A', '', 1, 0, 0, 1000, 1000])
    expect(out).toHaveLength(3)
  })

  it('does not change the rows it was given', () => {
    attachBoxes(items, [[0, 0, 0, 10, 10]], 100, 100)
    expect(items[0]).toHaveLength(4)
  })
})
