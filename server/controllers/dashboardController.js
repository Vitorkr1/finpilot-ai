const ServiceOrder = require('../models/ServiceOrder');
const FinancialEntry = require('../models/FinancialEntry');
const asyncHandler = require('../utils/asyncHandler');

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

const summary = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const monthStart = startOfMonth();

  const [openOrders, closedOrders, revenueAgg, expensesAgg] = await Promise.all([
    ServiceOrder.countDocuments({ companyId, status: { $in: ['aberta', 'em_andamento'] } }),
    ServiceOrder.countDocuments({ companyId, status: 'concluida' }),
    FinancialEntry.aggregate([
      { $match: { companyId, type: 'receita', paidDate: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    FinancialEntry.aggregate([
      { $match: { companyId, type: 'despesa', paidDate: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  res.json({
    openServiceOrders: openOrders,
    closedServiceOrders: closedOrders,
    revenueThisMonth: revenueAgg[0]?.total || 0,
    expensesThisMonth: expensesAgg[0]?.total || 0,
  });
});

module.exports = { summary };
