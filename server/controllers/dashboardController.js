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
  const financial = req.user.role === 'admin' || req.user.role === 'financeiro';
  const scope = { companyId, ...(req.user.role === 'tecnico' ? { technicianId: req.user._id } : {}) };

  const [openOrders, closedOrders, revenueAgg, expensesAgg] = await Promise.all([
    ServiceOrder.countDocuments({ ...scope, status: { $in: ['aberta', 'em_andamento'] } }),
    ServiceOrder.countDocuments({ ...scope, status: 'concluida' }),
    financial ? FinancialEntry.aggregate([
      { $match: { companyId, type: 'receita', paidDate: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]) : Promise.resolve([]),
    financial ? FinancialEntry.aggregate([
      { $match: { companyId, type: 'despesa', paidDate: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]) : Promise.resolve([]),
  ]);

  res.json({
    openServiceOrders: openOrders,
    closedServiceOrders: closedOrders,
    revenueThisMonth: financial ? revenueAgg[0]?.total || 0 : null,
    expensesThisMonth: financial ? expensesAgg[0]?.total || 0 : null,
  });
});

module.exports = { summary };
