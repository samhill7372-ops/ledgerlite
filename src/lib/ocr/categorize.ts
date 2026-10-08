import type { Category } from '@/types';

const RULES: [RegExp, Category][] = [
  [/restaurant|cafe|coffee|pizza|burger|biryani|swiggy|zomato|dine|kitchen|dhaba/, 'Food'],
  [/mart|grocer|bazaar|supermarket|reliance fresh|dmart|bigbasket|blinkit|zepto|vegetable|kirana/, 'Groceries'],
  [/uber|ola|rapido|metro|fuel|petrol|diesel|toll|parking|irctc|airlines|flight|bus|namma yatri/, 'Travel'],
  [/pharma|medical|chemist|hospital|clinic|apollo|medplus|1mg|pharmeasy/, 'Health'],
  [/electric|bescom|broadband|airtel|jio|vi\b|recharge|water|gas|rent|bill|emi/, 'Bills'],
  [/mall|store|fashion|amazon|flipkart|myntra|ajio|shoes|apparel|decathlon/, 'Shopping'],
];

export function guessCategory(text: string): Category {
  const t = text.toLowerCase();
  for (const [re, cat] of RULES) if (re.test(t)) return cat;
  return 'Other';
}
