// Placeholder values to confirm with the café. Everything adjustable lives here.
export const CONFIG = {
  cafeName: 'Kandu Café',
  island: 'Dhangethi · Maldives',
  gstRate: 0.08,
  usdRate: 15.42, // MVR per 1 USD
  deliveryFee: 15, // MVR, flat
  bank: { bank: 'Bank of Maldives', name: 'Kandu Café Pvt Ltd', account: '7730 0001 2345 678' },
  tables: 12,
  defaultWait: 15, // minutes
  prayerMinutes: 15,
  transferConfirmSec: 25, // demo speed. Customers are told "usually within 5 minutes".
  boatDays: [2, 6], // supply boat from Malé: Tuesday and Saturday (0 = Sunday)
  safetyBuffer: 0.25,
  foodCostTarget: [28, 35], // % of sales
  restockContact: 'Aisha (manager)',
  // Known events that lift demand in the forecast.
  events: [
    { inDays: 2, label: 'Tour group at Kaani Palm Stay (18 guests)', lift: 0.35 },
    { inDays: 5, label: 'Island football final', lift: 0.25 },
  ],
};
