import { describe, it, expect, beforeEach } from 'vitest'
import { useCart } from './useCart.js'

// One shared cart per browser — reset between tests.
const cart = useCart()
beforeEach(() => cart.clear())

describe('useCart', () => {
  it('adds items and bumps quantity on repeat adds', () => {
    cart.add('a')
    cart.add('a')
    cart.add('b')
    expect(cart.qtyOf('a')).toBe(2)
    expect(cart.count.value).toBe(3)
  })

  it('toggle adds when absent and removes when present', () => {
    cart.toggle('a')
    expect(cart.inCart('a')).toBe(true)
    cart.toggle('a')
    expect(cart.inCart('a')).toBe(false)
  })

  it('setQty updates in place and removes at zero', () => {
    cart.add('a')
    cart.setQty('a', 5)
    expect(cart.qtyOf('a')).toBe(5)
    cart.setQty('a', 0)
    expect(cart.inCart('a')).toBe(false)
  })

  it('remove drops only the targeted line', () => {
    cart.add('a')
    cart.add('b')
    cart.remove('a')
    expect(cart.inCart('a')).toBe(false)
    expect(cart.qtyOf('b')).toBe(1)
  })
})
