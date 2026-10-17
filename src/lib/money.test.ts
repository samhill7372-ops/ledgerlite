import { describe, it, expect, afterEach } from 'vitest';
import { fmt, guessCurrency, setHomeCurrency, homeCurrency, round2, sum } from './money';

afterEach(() => setHomeCurrency('INR'));

describe('fmt', () => {
  it('groups INR by lakh and others by thousands', () => {
    expect(fmt(123456.5, 'INR')).toBe('₹1,23,456.5');
    expect(fmt(123456.5, 'USD')).toBe('$123,456.5');
    expect(fmt(2500, 'GBP')).toBe('£2,500');
  });
  it('drops decimals for JPY', () => {
    expect(fmt(1234.56, 'JPY')).toBe('¥1,235');
  });
  it('uses the home currency by default', () => {
    setHomeCurrency('USD');
    expect(homeCurrency()).toBe('USD');
    expect(fmt(99)).toBe('$99');
  });
});

describe('guessCurrency', () => {
  it('maps browser regions to currencies, defaulting to USD', () => {
    expect(guessCurrency('en-IN')).toBe('INR');
    expect(guessCurrency('en-US')).toBe('USD');
    expect(guessCurrency('en-GB')).toBe('GBP');
    expect(guessCurrency('fr-FR')).toBe('EUR');
    expect(guessCurrency('xx')).toBe('USD');
  });
});

describe('round2 / sum', () => {
  it('rounds to 2dp and sums', () => {
    expect(round2(10.005)).toBe(10.01);
    expect(sum([{ amount: 0.1 }, { amount: 0.2 }])).toBe(0.3);
  });
});
