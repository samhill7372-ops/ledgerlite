import { describe, it, expect } from 'vitest';
import { parseSms } from './parse';

describe('parseSms', () => {
  it('reads a typical card-spend SMS', () => {
    const p = parseSms('Rs.540.00 spent on HDFC Card XX1234 at SWIGGY BANGALORE on 17-10-2026. Avl bal Rs.12,345.67');
    expect(p.amount).toBe(540);
    expect(p.vendor).toBe('SWIGGY BANGALORE');
    expect(p.date).toBe('2026-10-17');
    expect(p.debit).toBe(true);
  });
  it('reads a UPI debit with "to" and short year', () => {
    const p = parseSms('INR 1,250.50 debited from A/c XX9876 to BIG BAZAAR via UPI on 05/10/26. Ref 123456');
    expect(p.amount).toBe(1250.5);
    expect(p.vendor).toBe('BIG BAZAAR');
    expect(p.date).toBe('2026-10-05');
  });
  it('reads month-name dates and ₹', () => {
    const p = parseSms('Paid ₹85 to METRO on 17-Oct-26 via UPI');
    expect(p.amount).toBe(85);
    expect(p.vendor).toBe('METRO');
    expect(p.date).toBe('2026-10-17');
  });
  it('flags credits so the UI can warn', () => {
    const p = parseSms('Rs.5,000.00 credited to your A/c XX1234 on 17-10-2026 by NEFT');
    expect(p.debit).toBe(false);
    expect(p.amount).toBe(5000);
  });
  it('survives messages without vendor or date', () => {
    const p = parseSms('Rs 200 debited via UPI. Ref no 998877.');
    expect(p.amount).toBe(200);
    expect(p.vendor).toBe('');
    expect(p.date).toBeNull();
    expect(p.debit).toBe(true);
  });
  it('does not mistake account fragments for vendors', () => {
    const p = parseSms('Rs.99 debited to A/c XX4321 on 01-10-2026');
    expect(p.vendor).toBe('');
  });
  it('returns nulls for text with no money in it', () => {
    const p = parseSms('Your OTP is 123456. Do not share it.');
    expect(p.amount).toBeNull();
  });
  it('reads the HDFC UPI "Sent ... From ... To ... On" format (multi-line)', () => {
    const p = parseSms('Sent Rs.2500.00\nFrom HDFC Bank A/C *8019\nTo OXYGEN FUELS\nOn 10/10/26\nRef 131051566603\nNot You?\nCall 18002586161/SMS BLOCK UPI to 7308080808');
    expect(p.amount).toBe(2500);
    expect(p.vendor).toBe('OXYGEN FUELS');
    expect(p.date).toBe('2026-10-10');
    expect(p.debit).toBe(true);
  });
});
