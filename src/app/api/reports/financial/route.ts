import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const orders = await prisma.order.findMany({
      where: { status: "Delivered" },
      select: {
        price: true,
        costPrice: true,
        quantity: true,
        shippingCharge: true,
        customerShippingCharge: true,
        pageName: true,
        product: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Helper
    const revenue = (o: typeof orders[0]) => o.price * o.quantity;
    const cogs = (o: typeof orders[0]) => (o.costPrice || 0) * o.quantity;
    const shipping = (o: typeof orders[0]) => (o.shippingCharge || 0) - (o.customerShippingCharge || 0);
    const profit = (o: typeof orders[0]) => revenue(o) - cogs(o) - shipping(o);

    // Monthly sales (last 12 months)
    const monthlyMap: Record<string, { revenue: number; cost: number; profit: number; orders: number }> = {};
    orders.forEach((o) => {
      const key = new Date(o.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short" });
      if (!monthlyMap[key]) monthlyMap[key] = { revenue: 0, cost: 0, profit: 0, orders: 0 };
      monthlyMap[key].revenue += revenue(o);
      monthlyMap[key].cost += cogs(o);
      monthlyMap[key].profit += profit(o);
      monthlyMap[key].orders += 1;
    });
    const monthly = Object.entries(monthlyMap).map(([month, d]) => ({ month, ...d })).slice(-12);

    // Weekly sales (last 8 weeks)
    const weeklyMap: Record<string, { revenue: number; cost: number; profit: number; orders: number }> = {};
    orders.forEach((o) => {
      const d = new Date(o.createdAt);
      const startOfWeek = new Date(d);
      startOfWeek.setDate(d.getDate() - d.getDay());
      const key = startOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (!weeklyMap[key]) weeklyMap[key] = { revenue: 0, cost: 0, profit: 0, orders: 0 };
      weeklyMap[key].revenue += revenue(o);
      weeklyMap[key].cost += cogs(o);
      weeklyMap[key].profit += profit(o);
      weeklyMap[key].orders += 1;
    });
    const weekly = Object.entries(weeklyMap).map(([week, d]) => ({ week, ...d })).slice(-8);

    // Yearly sales
    const yearlyMap: Record<string, { revenue: number; cost: number; profit: number; orders: number }> = {};
    orders.forEach((o) => {
      const key = new Date(o.createdAt).getFullYear().toString();
      if (!yearlyMap[key]) yearlyMap[key] = { revenue: 0, cost: 0, profit: 0, orders: 0 };
      yearlyMap[key].revenue += revenue(o);
      yearlyMap[key].cost += cogs(o);
      yearlyMap[key].profit += profit(o);
      yearlyMap[key].orders += 1;
    });
    const yearly = Object.entries(yearlyMap).map(([year, d]) => ({ year, ...d }));

    // Fiscal year (Jul 16 - Jul 15)
    const getFiscalYear = (date: Date) => {
      const y = date.getFullYear();
      const fiscalStart = new Date(y, 6, 16); // July 16
      return date >= fiscalStart ? `${y}/${y + 1}` : `${y - 1}/${y}`;
    };
    const fiscalMap: Record<string, { revenue: number; cost: number; profit: number; orders: number }> = {};
    orders.forEach((o) => {
      const key = getFiscalYear(new Date(o.createdAt));
      if (!fiscalMap[key]) fiscalMap[key] = { revenue: 0, cost: 0, profit: 0, orders: 0 };
      fiscalMap[key].revenue += revenue(o);
      fiscalMap[key].cost += cogs(o);
      fiscalMap[key].profit += profit(o);
      fiscalMap[key].orders += 1;
    });
    const fiscal = Object.entries(fiscalMap).map(([fy, d]) => ({ fy, ...d }));

    // Store-wise
    const storeMap: Record<string, { revenue: number; cost: number; profit: number; orders: number }> = {};
    orders.forEach((o) => {
      const key = o.pageName || "Unknown";
      if (!storeMap[key]) storeMap[key] = { revenue: 0, cost: 0, profit: 0, orders: 0 };
      storeMap[key].revenue += revenue(o);
      storeMap[key].cost += cogs(o);
      storeMap[key].profit += profit(o);
      storeMap[key].orders += 1;
    });
    const storeWise = Object.entries(storeMap).map(([store, d]) => ({ store, ...d }))
      .sort((a, b) => b.revenue - a.revenue);

    // Loss making products
    const productMap: Record<string, { revenue: number; cost: number; profit: number; orders: number }> = {};
    orders.forEach((o) => {
      const key = o.product || "Unknown";
      if (!productMap[key]) productMap[key] = { revenue: 0, cost: 0, profit: 0, orders: 0 };
      productMap[key].revenue += revenue(o);
      productMap[key].cost += cogs(o);
      productMap[key].profit += profit(o);
      productMap[key].orders += 1;
    });
    const allProducts = Object.entries(productMap).map(([product, d]) => ({ product, ...d }));
    const lossProducts = allProducts.filter((p) => p.profit < 0).sort((a, b) => a.profit - b.profit);

    // Summary
    const totalRevenue = orders.reduce((s, o) => s + revenue(o), 0);
    const totalCost = orders.reduce((s, o) => s + cogs(o), 0);
    const totalProfit = orders.reduce((s, o) => s + profit(o), 0);
    const totalOrders = orders.length;

    return NextResponse.json({
      summary: { totalRevenue, totalCost, totalProfit, totalOrders },
      monthly,
      weekly,
      yearly,
      fiscal,
      storeWise,
      lossProducts,
      allProducts: allProducts.sort((a, b) => b.revenue - a.revenue).slice(0, 20),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch financial data" }, { status: 500 });
  }
}
