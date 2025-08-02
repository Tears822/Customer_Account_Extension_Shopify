const express = require('express');
const crypto = require('crypto');
const { supabase } = require('../config/supabase');

const router = express.Router();

// Verify Shopify webhook authenticity
function verifyShopifyWebhook(body, signature) {
  const shopifyWebhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!shopifyWebhookSecret) {
    console.error('SHOPIFY_WEBHOOK_SECRET not configured');
    return false;
  }

  const hmac = crypto.createHmac('sha256', shopifyWebhookSecret);
  hmac.update(body, 'utf8');
  const calculatedSignature = hmac.digest('base64');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'base64'),
    Buffer.from(calculatedSignature, 'base64')
  );
}

// Helper function to find or create user from Shopify customer
async function findOrCreateUser(shopifyCustomer) {
  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('shopify_customer_id', shopifyCustomer.id.toString())
    .single();

  if (existingUser) {
    return existingUser;
  }

  const { data: newUser, error } = await supabase
    .from('users')
    .insert({
      shopify_customer_id: shopifyCustomer.id.toString(),
      email: shopifyCustomer.email,
      first_name: shopifyCustomer.first_name || '',
      last_name: shopifyCustomer.last_name || '',
      phone_number: shopifyCustomer.phone || null,
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating user:', error);
    throw new Error('Failed to create user');
  }

  return newUser;
}

// Helper function to find plan by Shopify product/variant ID
async function findPlanByShopifyId(productId, variantId = null) {
  let query = supabase
    .from('plans')
    .select('*')
    .eq('shopify_product_id', productId.toString());

  if (variantId) {
    query = query.eq('shopify_variant_id', variantId.toString());
  }

  const { data: plan } = await query.single();
  return plan;
}

// Helper function to create student plan from purchase
async function createStudentPlan(purchase, student, plan) {
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + (plan.duration_days * 24 * 60 * 60 * 1000));

  const { data: studentPlan, error } = await supabase
    .from('student_plans')
    .insert({
      student_id: student.id,
      plan_id: plan.id,
      purchase_id: purchase.id,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      initial_credits: plan.credits * purchase.quantity,
      remaining_credits: plan.credits * purchase.quantity,
      is_unlimited: plan.is_unlimited,
      status: 'active'
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating student plan:', error);
    throw new Error('Failed to create student plan');
  }

  return studentPlan;
}

// Webhook Handler: Customer Creation/Update
router.post('/customers', async (req, res) => {
  try {
    const body = JSON.stringify(req.body);
    const signature = req.headers['x-shopify-hmac-sha256'];
    
    if (!verifyShopifyWebhook(body, signature)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const customer = req.body;
    
    // Update or create user
    const { error } = await supabase
      .from('users')
      .upsert({
        shopify_customer_id: customer.id.toString(),
        email: customer.email,
        first_name: customer.first_name || '',
        last_name: customer.last_name || '',
        phone_number: customer.phone || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'shopify_customer_id'
      });

    if (error) {
      console.error('Error upserting customer:', error);
      return res.status(500).json({ error: 'Error processing customer' });
    }

    res.json({ success: true, message: 'Customer processed successfully' });
  } catch (error) {
    console.error('Customer webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Webhook Handler: Order Creation (Plan Purchase)
router.post('/orders', async (req, res) => {
  try {
    const body = JSON.stringify(req.body);
    const signature = req.headers['x-shopify-hmac-sha256'];
    
    if (!verifyShopifyWebhook(body, signature)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const order = req.body;
    
    // Find or create user
    const user = await findOrCreateUser(order.customer);
    
    // Find or create student profile
    let { data: student } = await supabase
      .from('students')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!student) {
      const { data: newStudent, error } = await supabase
        .from('students')
        .insert({
          user_id: user.id,
          full_name: `${user.first_name} ${user.last_name}`.trim(),
          birthdate: '1990-01-01', // Default - user will update
          phone_number: user.phone_number
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating student:', error);
        return res.status(500).json({ error: 'Error creating student profile' });
      }
      student = newStudent;
    }

    // Process each line item that represents a class plan
    for (const lineItem of order.line_items) {
      const plan = await findPlanByShopifyId(lineItem.product_id, lineItem.variant_id);
      
      if (!plan) {
        console.log(`No plan found for product ${lineItem.product_id}, skipping...`);
        continue;
      }

      // Create plan purchase record
      const { data: purchase, error: purchaseError } = await supabase
        .from('plan_purchases')
        .insert({
          shopify_order_id: order.id.toString(),
          shopify_order_number: order.order_number?.toString(),
          user_id: user.id,
          student_id: student.id,
          plan_id: plan.id,
          quantity: lineItem.quantity,
          total_paid: parseFloat(lineItem.price) * lineItem.quantity,
          purchased_at: new Date(order.created_at).toISOString(),
          metadata: {
            order_name: order.name,
            line_item_id: lineItem.id,
            variant_title: lineItem.variant_title,
            product_title: lineItem.title
          }
        })
        .select()
        .single();

      if (purchaseError) {
        console.error('Error creating purchase:', purchaseError);
        continue;
      }

      // Create student plan (active credit balance)
      try {
        await createStudentPlan(purchase, student, plan);
        console.log(`Created student plan for purchase ${purchase.id}`);
      } catch (error) {
        console.error('Error creating student plan:', error);
      }
    }

    res.json({ success: true, message: 'Order processed successfully' });
  } catch (error) {
    console.error('Order webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Webhook Handler: Order Cancellation/Refund
router.post('/orders/cancelled', async (req, res) => {
  try {
    const body = JSON.stringify(req.body);
    const signature = req.headers['x-shopify-hmac-sha256'];
    
    if (!verifyShopifyWebhook(body, signature)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const order = req.body;
    
    // Find all purchases for this order
    const { data: purchases } = await supabase
      .from('plan_purchases')
      .select('*, student_plans(*)')
      .eq('shopify_order_id', order.id.toString());

    for (const purchase of purchases) {
      for (const studentPlan of purchase.student_plans) {
        // Mark student plan as cancelled/refunded
        await supabase
          .from('student_plans')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('id', studentPlan.id);

        // Create credit transaction for refund
        await supabase.rpc('create_credit_transaction', {
          p_student_plan_id: studentPlan.id,
          p_transaction_type: 'credit',
          p_amount: studentPlan.remaining_credits,
          p_reference_id: purchase.id,
          p_reference_type: 'refund',
          p_description: `Order ${order.name} cancelled/refunded`
        });

        // Cancel any active bookings using this plan
        const { data: activeBookings } = await supabase
          .from('bookings')
          .select('*')
          .eq('student_plan_id', studentPlan.id)
          .eq('status', 'active');

        for (const booking of activeBookings) {
          await supabase
            .from('bookings')
            .update({
              status: 'cancelled',
              cancelled_at: new Date().toISOString(),
              cancellation_reason: 'Order refunded',
              credit_refunded: true
            })
            .eq('id', booking.id);
        }
      }
    }

    res.json({ success: true, message: 'Order cancellation processed successfully' });
  } catch (error) {
    console.error('Order cancelled webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Webhook Handler: Product Update (Plan Sync)
router.post('/products', async (req, res) => {
  try {
    const body = JSON.stringify(req.body);
    const signature = req.headers['x-shopify-hmac-sha256'];
    
    if (!verifyShopifyWebhook(body, signature)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const product = req.body;
    
    // Check if this product has fitness class plan tags/metafields
    const isClassPlan = product.tags?.includes('class-plan') || 
                       product.product_type === 'Class Plan' ||
                       product.metafields?.some(m => m.key === 'is_class_plan');

    if (!isClassPlan) {
      return res.json({ success: true, message: 'Product is not a class plan, skipping' });
    }

    // Extract plan details from metafields or product data
    const extractPlanData = (variant) => {
      const credits = variant.metafields?.find(m => m.key === 'credits')?.value || 
                     parseInt(variant.title.match(/(\d+)/)?.[1]) || 10;
      const durationDays = variant.metafields?.find(m => m.key === 'duration_days')?.value || 30;
      const isUnlimited = variant.metafields?.find(m => m.key === 'is_unlimited')?.value === 'true' ||
                         variant.title.toLowerCase().includes('unlimited');

      return {
        credits: isUnlimited ? 999 : credits,
        duration_days: durationDays,
        is_unlimited: isUnlimited,
        price: parseFloat(variant.price)
      };
    };

    // Update or create plans for each variant
    for (const variant of product.variants) {
      const planData = extractPlanData(variant);
      
      await supabase
        .from('plans')
        .upsert({
          shopify_product_id: product.id.toString(),
          shopify_variant_id: variant.id.toString(),
          name: variant.title || product.title,
          description: product.body_html?.replace(/<[^>]*>/g, '') || '', // Strip HTML
          credits: planData.credits,
          duration_days: planData.duration_days,
          price: planData.price,
          is_unlimited: planData.is_unlimited,
          is_active: product.status === 'active',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'shopify_variant_id'
        });
    }

    res.json({ success: true, message: 'Product updated successfully' });
  } catch (error) {
    console.error('Product update webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Main webhook router function
router.post('/', async (req, res) => {
  const topic = req.headers['x-shopify-topic'];
  
  switch (topic) {
    case 'customers/create':
    case 'customers/update':
      return router.post('/customers', req, res);
    
    case 'orders/create':
    case 'orders/paid':
      return router.post('/orders', req, res);
    
    case 'orders/cancelled':
    case 'orders/refund':
      return router.post('/orders/cancelled', req, res);
    
    case 'products/create':
    case 'products/update':
      return router.post('/products', req, res);
    
    default:
      console.log(`Unhandled webhook topic: ${topic}`);
      return res.json({ success: true, message: 'Webhook topic not handled' });
  }
});

// Additional utility functions for manual operations

// Function to sync existing Shopify products as plans
router.post('/sync-products', async (req, res) => {
  try {
    const shopifyApiUrl = `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/2023-10/products.json`;
    const shopifyHeaders = {
      'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
      'Content-Type': 'application/json'
    };

    const response = await fetch(shopifyApiUrl, { headers: shopifyHeaders });
    const { products } = await response.json();

    let syncedCount = 0;
    for (const product of products) {
      // Only sync products tagged as class plans
      if (product.tags?.includes('class-plan') || product.product_type === 'Class Plan') {
        for (const variant of product.variants) {
          const credits = parseInt(variant.title.match(/(\d+)/)?.[1]) || 10;
          const isUnlimited = variant.title.toLowerCase().includes('unlimited');
          
          await supabase
            .from('plans')
            .upsert({
              shopify_product_id: product.id.toString(),
              shopify_variant_id: variant.id.toString(),
              name: variant.title || product.title,
              description: product.body_html?.replace(/<[^>]*>/g, '') || '',
              credits: isUnlimited ? 999 : credits,
              duration_days: 30, // Default
              price: parseFloat(variant.price),
              is_unlimited: isUnlimited,
              is_active: product.status === 'active'
            }, {
              onConflict: 'shopify_variant_id'
            });
          syncedCount++;
        }
      }
    }

    res.json({ 
      success: true, 
      message: 'Product sync completed successfully',
      syncedCount 
    });
  } catch (error) {
    console.error('Error syncing products:', error);
    res.status(500).json({ error: 'Error syncing products' });
  }
});

module.exports = router; 