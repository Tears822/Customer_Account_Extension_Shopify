const express = require('express');
const { supabase } = require('../config/supabase');
const { verifyShopifyCustomer } = require('../middleware/auth');

const router = express.Router();

// Get user's active plans and credits
router.get('/user-plans', verifyShopifyCustomer, async (req, res) => {
  try {
    const { shopifyCustomer } = req;
    
    // Get student record for the user
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', shopifyCustomer.id)
      .single();

    if (studentError || !student) {
      return res.status(404).json({
        error: 'Student profile not found',
        message: 'Please complete your student profile first'
      });
    }

    // Get active student plans with plan details
    const { data: studentPlans, error } = await supabase
      .from('student_plans')
      .select(`
        id,
        start_date,
        end_date,
        initial_credits,
        remaining_credits,
        is_unlimited,
        status,
        plan:plans(
          id,
          name,
          description,
          credits,
          duration_days,
          is_unlimited
        )
      `)
      .eq('student_id', student.id)
      .eq('status', 'active')
      .gte('end_date', new Date().toISOString().split('T')[0]);

    if (error) {
      console.error('Error fetching student plans:', error);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to fetch user plans'
      });
    }

    res.json({
      success: true,
      data: studentPlans || []
    });
  } catch (error) {
    console.error('Error in user-plans route:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error while fetching user plans'
    });
  }
});

// Get plan details by ID
router.get('/:planId', async (req, res) => {
  try {
    const { planId } = req.params;

    const { data: plan, error } = await supabase
      .from('plans')
      .select('*')
      .eq('id', planId)
      .eq('is_active', true)
      .single();

    if (error || !plan) {
      return res.status(404).json({
        error: 'Plan not found',
        message: 'The requested plan does not exist or is inactive'
      });
    }

    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    console.error('Error fetching plan:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error while fetching plan'
    });
  }
});

// Get all active plans (for purchase)
router.get('/', async (req, res) => {
  try {
    const { data: plans, error } = await supabase
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true });

    if (error) {
      console.error('Error fetching plans:', error);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to fetch plans'
      });
    }

    res.json({
      success: true,
      data: plans || []
    });
  } catch (error) {
    console.error('Error in plans route:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error while fetching plans'
    });
  }
});

// Get credit transaction history
router.get('/user-plans/transactions', verifyShopifyCustomer, async (req, res) => {
  try {
    const { shopifyCustomer } = req;
    
    // Get student record
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', shopifyCustomer.id)
      .single();

    if (studentError || !student) {
      return res.status(404).json({
        error: 'Student profile not found',
        message: 'Please complete your student profile first'
      });
    }

    // Get student plans
    const { data: studentPlans, error: plansError } = await supabase
      .from('student_plans')
      .select('id')
      .eq('student_id', student.id);

    if (plansError) {
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to fetch student plans'
      });
    }

    if (!studentPlans || studentPlans.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    const planIds = studentPlans.map(sp => sp.id);

    // Get credit transactions
    const { data: transactions, error } = await supabase
      .from('credit_transactions')
      .select(`
        id,
        transaction_type,
        amount,
        balance_before,
        balance_after,
        reference_type,
        description,
        created_at
      `)
      .in('student_plan_id', planIds)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching transactions:', error);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to fetch transaction history'
      });
    }

    res.json({
      success: true,
      data: transactions || []
    });
  } catch (error) {
    console.error('Error in transactions route:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error while fetching transactions'
    });
  }
});

module.exports = router; 