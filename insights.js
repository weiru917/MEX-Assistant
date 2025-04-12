const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

// Enhanced analysis functions
function getTotalSales(merchantId, updated_orders) {
  if (!updated_orders || !Array.isArray(updated_orders)) {
    return 0;
  }
  
  return updated_orders
    .filter(tx => tx.merchant_id === merchantId)
    .reduce((total, tx) => total + parseFloat(tx.total_order_value || 0), 0);
}

function getSalesTrend(merchantId, updated_orders, period = 'daily') {
  if (!updated_orders || !Array.isArray(updated_orders)) {
    return [];
  }
  
  const trendMap = {};

  updated_orders
    .filter(tx => tx.merchant_id === merchantId && tx.order_time)
    .forEach(tx => {
      let dateKey;
      // Handle potential date format issues
      const dateStr = tx.order_time;
      const date = new Date(dateStr);
      
      if (isNaN(date.getTime())) {
        console.warn(`Invalid date: ${dateStr}`);
        return; // Skip this record
      }
      
      if (period === 'daily') {
        dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
      } else if (period === 'weekly') {
        // Get week number (1-52)
        const weekNum = Math.ceil((date.getDate() + (date.getDay() + 1)) / 7);
        dateKey = `Week ${weekNum}, ${date.getFullYear()}`;
      } else if (period === 'monthly') {
        dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
      
      const value = parseFloat(tx.order_value || 0);
      trendMap[dateKey] = (trendMap[dateKey] || 0) + value;
    });

  return Object.entries(trendMap)
    .sort(([a], [b]) => {
      if (period === 'daily') {
        return new Date(a) - new Date(b);
      }
      return a.localeCompare(b);
    })
    .map(([date, total]) => ({ date, total: parseFloat(total.toFixed(2)) }));
}

function getTopItems(merchantId, updated_orders, limit = 5) {
    if (!updated_orders || !Array.isArray(updated_orders)) {
      return [];
    }
  
    const itemFrequency = {};
  
    // Count frequency of each item sold by the merchant
    updated_orders
      .filter(tx => tx.merchant_id === merchantId && tx.item_id)
      .forEach(tx => {
        const itemId = tx.item_id;
        if (!itemFrequency[itemId]) {
          itemFrequency[itemId] = {
            count: 0,
            name: tx.item_name || 'Unknown Item',
            price: parseFloat(tx.item_price || 0)
          };
        }
        itemFrequency[itemId].count += 1;
      });
  
    // Convert to array and sort by count
    const topItemsDetails = Object.entries(itemFrequency)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, limit)
      .map(([itemId, data]) => ({
        id: itemId,
        name: data.name,
        price: data.price,
        count: data.count,
        revenue: parseFloat((data.price * data.count).toFixed(2))
      }));
  
    return topItemsDetails;
  }
  

function getOperationalInsights(merchantId, updated_orders) {
  if (!updated_orders || !Array.isArray(updated_orders)) {
    return {
      orderCount: 0,
      avgPrepTimeMinutes: 0,
      avgDeliveryTimeMinutes: 0,
      avgDriverWaitTimeMinutes: 0
    };
  }
  
  let totalOrders = 0;
  let totalPrepTime = 0; // Time between order and pickup
  let totalDeliveryTime = 0; // Time between pickup and delivery
  let totalDriverWaitTime = 0; // Time between driver arrival and pickup
  let validPrepTimes = 0;
  let validDeliveryTimes = 0;
  let validWaitTimes = 0;
  
  updated_orders
    .filter(tx => tx.merchant_id === merchantId)
    .forEach(tx => {
      totalOrders++;
      
      // Safely parse dates
      const orderTime = tx.order_time ? new Date(tx.order_time) : null;
      const driverArrivalTime = tx.driver_arrival_time ? new Date(tx.driver_arrival_time) : null;
      const pickupTime = tx.driver_pickup_time ? new Date(tx.driver_pickup_time) : null;
      const deliveryTime = tx.delivery_time ? new Date(tx.delivery_time) : null;
      
      // Skip invalid dates
      if (!orderTime || isNaN(orderTime.getTime())) return;
      
      // Calculate prep time (order to pickup) in minutes
      if (pickupTime && !isNaN(pickupTime.getTime())) {
        const prepTimeMinutes = (pickupTime - orderTime) / (1000 * 60);
        // Only count positive times to avoid data issues
        if (prepTimeMinutes > 0 && prepTimeMinutes < 120) { // < 2 hours to filter outliers
          totalPrepTime += prepTimeMinutes;
          validPrepTimes++;
        }
      }
      
      // Calculate delivery time (pickup to delivery) in minutes
      if (pickupTime && deliveryTime && !isNaN(deliveryTime.getTime())) {
        const deliveryTimeMinutes = (deliveryTime - pickupTime) / (1000 * 60);
        if (deliveryTimeMinutes > 0 && deliveryTimeMinutes < 120) {
          totalDeliveryTime += deliveryTimeMinutes;
          validDeliveryTimes++;
        }
      }
      
      // Calculate driver wait time if available
      if (driverArrivalTime && pickupTime && !isNaN(driverArrivalTime.getTime())) {
        const waitTimeMinutes = (pickupTime - driverArrivalTime) / (1000 * 60);
        if (waitTimeMinutes > 0 && waitTimeMinutes < 60) {
          totalDriverWaitTime += waitTimeMinutes;
          validWaitTimes++;
        }
      }
    });
  
  return {
    orderCount: totalOrders,
    avgPrepTimeMinutes: validPrepTimes > 0 ? parseFloat((totalPrepTime / validPrepTimes).toFixed(2)) : 0,
    avgDeliveryTimeMinutes: validDeliveryTimes > 0 ? parseFloat((totalDeliveryTime / validDeliveryTimes).toFixed(2)) : 0,
    avgDriverWaitTimeMinutes: validWaitTimes > 0 ? parseFloat((totalDriverWaitTime / validWaitTimes).toFixed(2)) : 0
  };
}

function getCuisinePerformance(merchantId, updated_orders) {
  if (!updated_orders || !Array.isArray(updated_orders)) {
    return [];
  }
  
  // Build a map of item_id to cuisine_tag
const itemCuisineMap = {};
updated_orders.forEach(item => {
  if (item.item_id) {
    itemCuisineMap[item.item_id] = item.cuisine_tag || 'Uncategorized';
  }
});

  
  // Count sales by cuisine
  const cuisineSales = {};
  updated_orders
    .filter(tx => tx.merchant_id === merchantId && tx.item_id)
    .forEach(tx => {
      const cuisine = itemCuisineMap[tx.item_id] || 'Uncategorized';
      cuisineSales[cuisine] = (cuisineSales[cuisine] || 0) + 1;
    });
  
  // Check if we have any data
  if (Object.keys(cuisineSales).length === 0) {
    return [];
  }
  
  return Object.entries(cuisineSales)
    .sort((a, b) => b[1] - a[1])
    .map(([cuisine, count]) => ({ cuisine, count, percentage: 0 }))
    .map(item => {
      const total = Object.values(cuisineSales).reduce((sum, val) => sum + val, 0);
      return {
        ...item,
        percentage: parseFloat(((item.count / total) * 100).toFixed(2))
      };
    });
}

// Main function to generate comprehensive insights
function generateMerchantInsights(merchantId, datasets) {
  if (!datasets || !merchantId) {
    throw new Error('Missing required parameters: merchantId or datasets');
  }

  const { merchants, items, transactionData, transactionItems, updated_orders} = datasets;
  
  if (!merchants || !items || !transactionData || !transactionItems || !updated_orders) {
    console.warn('Warning: One or more dataset is missing');
  }
  
  // Find merchant details
  const merchantInfo = merchants?.find(m => m.merchant_id === merchantId) || {};
  
  // Generate various insights with error handling
  let totalSales = 0;
  let dailySalesTrend = [];
  let weeklySalesTrend = [];
  let topItemsList = [];
  let operationalMetrics = { orderCount: 0, avgPrepTimeMinutes: 0, avgDeliveryTimeMinutes: 0, avgDriverWaitTimeMinutes: 0 };
  let cuisinePerformance = [];
  let orderCount = 0;
  
  try {
    totalSales = getTotalSales(merchantId, updated_orders);
    dailySalesTrend = getSalesTrend(merchantId, updated_orders, 'daily');
    weeklySalesTrend = getSalesTrend(merchantId, updated_orders, 'weekly');
    topItemsList = getTopItems(merchantId, updated_orders, 5);
    operationalMetrics = getOperationalInsights(merchantId, updated_orders);
    cuisinePerformance = getCuisinePerformance(merchantId, updated_orders);
    
    // Calculate additional metrics
    orderCount = updated_orders?.filter(tx => tx.merchant_id === merchantId)?.length || 0;
  } catch (error) {
    console.error('Error generating insights:', error);
  }
  
  const avgOrderValue = orderCount > 0 ? parseFloat((totalSales / orderCount).toFixed(2)) : 0;
  
  // Consolidate insights
  return {
    merchantId,
    merchantName: merchantInfo.merchant_name || 'Unknown Merchant',
    joinDate: merchantInfo.join_date || 'Unknown',
    cityId: merchantInfo.city_id || 'Unknown',
    summary: {
      totalSales: parseFloat(totalSales.toFixed(2)),
      totalOrders: orderCount,
      avgOrderValue,
      topSellingItem: topItemsList.length > 0 ? topItemsList[0].name : 'N/A'
    },
    operations: operationalMetrics,
    salesTrends: {
      daily: dailySalesTrend,
      weekly: weeklySalesTrend
    },
    topItems: topItemsList,
    cuisineInsights: cuisinePerformance
  };
}

// For backward compatibility with your existing code
function generateInsights(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    const itemCount = {};
    let totalSales = 0;
    const salesByDate = {};

    if (!fs.existsSync(filePath)) {
      return resolve(`
📊 No data available to generate insights.
Please check your configuration and try again.
      `.trim());
    }

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', () => {
        if (rows.length === 0) {
          return resolve(`
📊 No data found in the provided file.
Please check your data source and try again.
          `.trim());
        }

        rows.forEach(row => {
          const price = parseFloat(row.order_value || row.total_order_value || 0);
          const item = row.item_name || 'Unknown Item';
          const date = (row.order_time || 'Unknown').split(" ")[0];

          totalSales += price;
          itemCount[item] = (itemCount[item] || 0) + 1;
          salesByDate[date] = (salesByDate[date] || 0) + price;
        });

        const topItems = Object.entries(itemCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([item, count]) => `- ${item}: sold ${count} times`)
          .join('\n');

        const dailySales = Object.entries(salesByDate)
          .map(([date, total]) => `- ${date}: RM${total.toFixed(2)}`)
          .join('\n');

        const summary = `
📊 Here are your latest business insights:

🔸 Total Sales: RM${totalSales.toFixed(2)}
🔥 Top 3 Items:
${topItems}

📅 Sales by Date:
${dailySales}
        `.trim();

        resolve(summary);
      })
      .on('error', (err) => {
        console.error('Error reading CSV:', err);
        reject(err);
      });
  });
}

module.exports = {
  getTotalSales,
  getSalesTrend,
  getTopItems,
  getOperationalInsights,
  getCuisinePerformance,
  generateMerchantInsights,
  generateInsights
};