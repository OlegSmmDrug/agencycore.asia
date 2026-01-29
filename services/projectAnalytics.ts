export const GLOBAL_RATES = {
  SMM: {
    post: 4000,
    reel: 8000,
    story: 3000,
    specDesign: 5000,
    monitoring: 15000,
    dubbing: 3000,
    scenario: 5000
  },
  PRODUCTION: {
    hourly: 10000
  }
};

export const calculateProjectPnL = (
  revenue: number,
  smmCost: number,
  productionCost: number,
  mediaSpend: number,
  unforeseenCost: number
) => {
  const totalExpenses = smmCost + productionCost + mediaSpend + unforeseenCost;
  const netProfit = revenue - totalExpenses;
  const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  return { totalExpenses, netProfit, margin };
};
